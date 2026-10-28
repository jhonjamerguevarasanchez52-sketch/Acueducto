const paymentModel = require('../models/paymentModel');
const invoiceModel = require('../models/invoiceModel');
const supabaseAdmin = require('../config/supabaseAdminClient');
const { confirmarPago } = require('../services/pagosService');
const { calcularFirmaIntegridad } = require('../utils/wompiFirma');
const { registrarAuditoria } = require('../utils/auditoria');
const { obtenerProblemaConfiguracion } = require('../utils/wompiConfig');
const { cotizarWompi } = require('../utils/wompiTarifa');
const recibosPagoService = require('../services/recibosPagoService');
const { errorInesperado, errorConsulta } = require('../utils/httpErrores');

const WOMPI_CURRENCY = process.env.WOMPI_CURRENCY || 'COP';
const ESTADOS_WOMPI_REINTENTABLES = new Set(['DECLINED', 'VOIDED', 'ERROR']);

// Métodos que un administrador puede usar al cargar un pago a nombre de alguien
const METODOS_ADMIN = ['efectivo', 'transferencia', 'otro'];

// Mensajes con los que el trigger procesar_pago_confirmado rechaza un pago.
// Son errores esperados del negocio (no fallos del servidor).
const RECHAZO_TRIGGER = /ya fue pagada|anulada|no coincide|no corresponde|no existe/i;

async function agregarUrlsRecibos(pagos = []) {
  return Promise.all(pagos.map(async (pago) => {
    if (pago.metodo !== 'fisico' || !pago.referencia) return pago;
    try {
      return { ...pago, recibo_url: await recibosPagoService.crearUrlRecibo(pago.referencia) };
    } catch (err) {
      console.error('[pagos] no se pudo generar enlace temporal del recibo:', err.message);
      return { ...pago, recibo_url: null };
    }
  }));
}

// ---------- USUARIO FINAL ----------

async function cotizacionWompi(req, res) {
  try {
    const { data: factura, error } = await invoiceModel.getOwn(req.params.facturaId, req.usuario.id, {
      columns: 'id, valor_total, estado', db: req.db,
    });
    if (error || !factura) return res.status(404).json({ error: 'Factura no encontrada o no te pertenece.' });
    if (factura.estado === 'pagada' || factura.estado === 'anulada') {
      return res.status(400).json({ error: 'Esta factura no se puede pagar.' });
    }
    return res.status(200).json(cotizarWompi(factura.valor_total));
  } catch (err) {
    return errorInesperado(res, err);
  }
}

// Ver mis pagos
async function misPagos(req, res) {
  const userId = req.usuario.id;

  try {
    const { data, error } = await paymentModel.listByProfile(userId, req.db);

    if (error) {
      return errorConsulta(res, error);
    }

    return res.status(200).json(await agregarUrlsRecibos(data || []));
  } catch (err) {
    return errorInesperado(res, err);
  }
}

// Registrar un pago (queda pendiente de confirmación: manual del admin o Wompi)
async function registrarPago(req, res) {
  const userId = req.usuario.id;
  const { factura_id, metodo, referencia } = req.body;

  if (!factura_id || !metodo) {
    return res.status(400).json({ error: 'Faltan campos obligatorios: factura_id, metodo' });
  }

  if (metodo !== 'wompi') {
    return res.status(400).json({ error: 'Para pagar físicamente debes adjuntar el recibo.' });
  }

  if (metodo === 'wompi') {
    const problemaConfiguracion = obtenerProblemaConfiguracion();
    if (problemaConfiguracion) {
      return res.status(503).json({ error: problemaConfiguracion });
    }
  }

  try {
    // Verifica que la factura le pertenezca al usuario antes de aceptar el pago
    const { data: factura, error: errorFactura } = await invoiceModel.getOwn(factura_id, userId, {
      columns: 'id, perfil_id, valor_total, estado',
      db: req.db,
    });

    if (errorFactura || !factura) {
      return res.status(404).json({ error: 'Factura no encontrada o no te pertenece' });
    }

    if (factura.estado === 'pagada') {
      return res.status(400).json({ error: 'Esta factura ya fue pagada' });
    }

    if (factura.estado === 'anulada') {
      return res.status(400).json({ error: 'Esta factura está anulada' });
    }

    const monto = Number(factura.valor_total);
    const cotizacion = cotizarWompi(monto);

    // Evita ensuciar el panel de pagos pendientes con duplicados por doble
    // clic o reintentos del frontend: solo un pago sin confirmar a la vez
    // por factura.
    const { data: pagoPendiente, error: errorPendiente } = await paymentModel.findPendingByInvoice(
      factura_id,
      req.db
    );

    if (errorPendiente) {
      return errorConsulta(res, errorPendiente);
    }

    let pago = null;
    if (pagoPendiente) {
      const puedeReanudarCheckout = metodo === 'wompi' &&
        pagoPendiente.metodo === 'wompi' &&
        [null, undefined, 'PENDING'].includes(pagoPendiente.estado_wompi);
      const wompiRechazado = pagoPendiente.metodo === 'wompi' &&
        ESTADOS_WOMPI_REINTENTABLES.has(pagoPendiente.estado_wompi);

      if (puedeReanudarCheckout) {
        if (Number(pagoPendiente.monto) !== monto ||
            Number(pagoPendiente.cargo_wompi || 0) !== cotizacion.cargoWompi) {
          return res.status(409).json({
            error: 'El valor de la factura cambió. Actualiza la factura antes de iniciar otro pago.',
          });
        }
        pago = pagoPendiente;
      } else if (!wompiRechazado) {
        return res.status(409).json({
          error: 'Ya existe un pago pendiente de confirmación para esta factura',
        });
      }
    }

    if (!pago) {
      const { data, error } = await paymentModel.create(
        {
          factura_id,
          perfil_id: userId,
          monto,
          cargo_wompi: cotizacion.cargoWompi,
          monto_total: cotizacion.totalCobrar,
          metodo,
          referencia,
          estado_wompi: 'PENDING',
        }
      );

      if (error) {
        // El índice único parcial de la base de datos es la protección final
        // contra dos solicitudes concurrentes. Si otra petición creó el pago
        // primero, reusamos ese checkout en vez de dejar al cliente en error.
        if (error.code === '23505') {
          const { data: pagoConcurrente, error: errorConcurrente } =
            await paymentModel.findPendingByInvoice(factura_id, req.db);
          if (errorConcurrente) return errorConsulta(res, errorConcurrente);
          if (!pagoConcurrente) return errorConsulta(res, error);

          const esMismoCheckout = metodo === 'wompi' &&
            pagoConcurrente.metodo === 'wompi' &&
            [null, undefined, 'PENDING'].includes(pagoConcurrente.estado_wompi) &&
            Number(pagoConcurrente.monto) === monto &&
            Number(pagoConcurrente.cargo_wompi || 0) === cotizacion.cargoWompi;

          if (!esMismoCheckout) {
            return res.status(409).json({
              error: 'Ya existe un pago pendiente de confirmación para esta factura',
            });
          }
          pago = pagoConcurrente;
        } else {
          return errorConsulta(res, error);
        }
      } else {
        pago = data;
      }
    }

    const respuesta = {
      message: 'Pago registrado, pendiente de confirmación',
      pago,
    };

    // Wompi signs the persisted payment ID and invoice amount server-side.
    if (metodo === 'wompi') {
      try {
        const amountInCents = Math.round(cotizacion.totalCobrar * 100);
        respuesta.wompi = {
          publicKey: process.env.WOMPI_PUBLIC_KEY,
          reference: pago.id,
          amountInCents,
          valorServicio: cotizacion.valorServicio,
          cargoWompi: cotizacion.cargoWompi,
          totalCobrar: cotizacion.totalCobrar,
          currency: WOMPI_CURRENCY,
          signature: calcularFirmaIntegridad({
            reference: pago.id,
            amountInCents,
            currency: WOMPI_CURRENCY,
          }),
        };
      } catch (firmaErr) {
        console.error('[pagos] no se pudo calcular la firma de integridad de Wompi:', firmaErr.message);
        return res.status(503).json({ error: 'No se pudo preparar el pago con Wompi.' });
      }
    }

    return res.status(201).json(respuesta);
  } catch (err) {
    return errorInesperado(res, err);
  }
}

// Registra el pago físico únicamente cuando se recibe un comprobante de imagen.
async function registrarPagoFisicoConRecibo(req, res) {
  const userId = req.usuario.id;
  const facturaId = req.params.facturaId;
  const bytes = req.body;
  const contentType = String(req.headers['content-type'] || '').split(';')[0].toLowerCase();

  if (!Buffer.isBuffer(bytes) || bytes.length === 0) {
    return res.status(400).json({ error: 'Selecciona una imagen del recibo para continuar.' });
  }
  if (bytes.length > recibosPagoService.MAX_BYTES) {
    return res.status(413).json({ error: 'El recibo debe pesar máximo 5 MB.' });
  }
  if (!recibosPagoService.MIME_TYPES.includes(contentType)) {
    return res.status(415).json({ error: 'El recibo debe ser una imagen JPG, PNG o WEBP.' });
  }

  const esJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const esPng = bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const esWebp = bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
  const tipoValido = (contentType === 'image/jpeg' && esJpeg) ||
    (contentType === 'image/png' && esPng) ||
    (contentType === 'image/webp' && esWebp);
  if (!tipoValido) {
    return res.status(400).json({ error: 'El archivo no coincide con el formato de imagen indicado.' });
  }

  try {
    const { data: factura, error: errorFactura } = await invoiceModel.getOwn(facturaId, userId, {
      columns: 'id, perfil_id, valor_total, estado',
      db: req.db,
    });
    if (errorFactura || !factura) {
      return res.status(404).json({ error: 'Factura no encontrada o no te pertenece.' });
    }
    if (factura.estado === 'pagada') return res.status(400).json({ error: 'Esta factura ya fue pagada.' });
    if (factura.estado === 'anulada') return res.status(400).json({ error: 'Esta factura está anulada.' });

    const { data: pendiente, error: errorPendiente } = await paymentModel.findPendingByInvoice(facturaId, req.db);
    if (errorPendiente) return errorConsulta(res, errorPendiente);
    if (pendiente) {
      return res.status(409).json({ error: 'Ya existe un pago pendiente de revisión para esta factura.' });
    }

    const { path, error: errorSubida } = await recibosPagoService.subirRecibo({
      perfilId: userId,
      facturaId,
      bytes,
      contentType,
    });
    if (errorSubida) {
      console.error('[pagos] error guardando recibo:', errorSubida.message);
      return res.status(502).json({ error: 'No se pudo guardar el recibo. Intenta de nuevo.' });
    }

    // La factura ya se validó como propia con req.db; la escritura va por el
    // cliente de servicio porque la app no tiene permiso de insertar pagos.
    const { data: pago, error: errorPago } = await paymentModel.create({
      factura_id: facturaId,
      perfil_id: userId,
      monto: factura.valor_total,
      metodo: 'fisico',
      referencia: path,
    });

    if (errorPago) {
      await recibosPagoService.eliminarRecibo(path);
      return errorConsulta(res, errorPago);
    }

    return res.status(201).json({
      message: 'Recibo enviado. El pago queda pendiente de revisión.',
      pago,
    });
  } catch (err) {
    return errorInesperado(res, err);
  }
}

// ---------- ADMINISTRADOR ----------

// Listar pagos, con filtro opcional ?confirmado=true|false y ?perfil_id=
async function listarPagos(req, res) {
  const { confirmado, perfil_id, limit, offset } = req.query;

  try {
    const { data, error } = await paymentModel.list({ confirmado, perfil_id, limit, offset });
    if (error) return errorConsulta(res, error);

    return res.status(200).json(await agregarUrlsRecibos(data || []));
  } catch (err) {
    return errorInesperado(res, err);
  }
}

// Listar los pagos que pasaron por Wompi (tienen transacción o estado de Wompi).
// Filtros opcionales: ?estado_wompi=APPROVED|DECLINED|VOIDED|ERROR|APPROVED_NO_APLICADO|MONTO_INVALIDO
// y ?perfil_id=. Paginación con ?limit= (máx. 200) y ?offset=.
async function listarPagosWompi(req, res) {
  const { estado_wompi, perfil_id } = req.query;
  const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
  const offset = Math.max(Number(req.query.offset) || 0, 0);

  try {
    let consulta = supabaseAdmin
      .from('payments')
      .select('*')
      .or('transaccion_id.not.is.null,estado_wompi.not.is.null')
      .range(offset, offset + limit - 1);

    if (estado_wompi) consulta = consulta.eq('estado_wompi', estado_wompi);
    if (perfil_id) consulta = consulta.eq('perfil_id', perfil_id);

    const { data, error } = await consulta;
    if (error) return errorConsulta(res, error);

    return res.status(200).json(data);
  } catch (err) {
    return errorInesperado(res, err);
  }
}

// Confirmar un pago manualmente (efectivo, transferencia, etc.).
// La factura, la notificación y la reconexión del servicio las hace el
// trigger de la base de datos al pasar el pago a confirmado.
async function confirmarPagoManual(req, res) {
  const { id } = req.params;

  try {
    const resultado = await confirmarPago(id, { metodo_confirmacion: 'manual' });

    if (!resultado.ok) {
      let status = 500;
      if (resultado.error === 'Pago no encontrado') status = 404;
      else if (RECHAZO_TRIGGER.test(resultado.error)) status = 409;

      return res.status(status).json({ error: resultado.error });
    }

    await registrarAuditoria({
      adminId: req.usuario.id,
      accion: 'pago_confirmado_manual',
      tabla: 'payments',
      registroId: id,
      detalle: {
        perfil_id: resultado.pago?.perfil_id || null,
        factura_id: resultado.pago?.factura_id || null,
        monto: resultado.pago?.monto || null,
        metodo: resultado.pago?.metodo || null,
      },
    });

    return res.status(200).json({ message: 'Pago confirmado', pago: resultado.pago });
  } catch (err) {
    return errorInesperado(res, err);
  }
}

// Cargar un pago en nombre de un usuario (efectivo, transferencia u otro) y
// confirmarlo en el mismo paso. El monto siempre es el valor real de la
// factura; nunca se toma del cuerpo de la petición.
async function registrarPagoAdmin(req, res) {
  const { factura_id, metodo = 'efectivo', referencia } = req.body;

  if (!factura_id) {
    return res.status(400).json({ error: 'Falta el campo obligatorio: factura_id' });
  }

  if (!METODOS_ADMIN.includes(metodo)) {
    return res.status(400).json({ error: 'Método inválido. Usa: efectivo, transferencia u otro' });
  }

  try {
    const { data: factura, error: errorFactura } = await supabaseAdmin
      .from('invoices')
      .select('id, perfil_id, valor_total, estado')
      .eq('id', factura_id)
      .maybeSingle();

    if (errorFactura) return errorConsulta(res, errorFactura);
    if (!factura) return res.status(404).json({ error: 'Factura no encontrada' });

    if (factura.estado === 'pagada') {
      return res.status(409).json({ error: 'Esta factura ya fue pagada' });
    }
    if (factura.estado === 'anulada') {
      return res.status(409).json({ error: 'Esta factura está anulada' });
    }

    // El trigger trg_forzar_pago_no_confirmado obliga a que todo pago nazca
    // sin confirmar, así que se crea primero y se confirma justo después.
    const { data: pago, error: errorPago } = await supabaseAdmin
      .from('payments')
      .insert({
        factura_id,
        perfil_id: factura.perfil_id,
        monto: factura.valor_total,
        cargo_wompi: 0,
        monto_total: factura.valor_total,
        metodo,
        referencia: referencia || null,
        registrado_por: req.usuario.id,
      })
      .select()
      .single();

    if (errorPago) return errorConsulta(res, errorPago);

    const resultado = await confirmarPago(pago.id, { metodo_confirmacion: 'manual' });

    if (!resultado.ok) {
      // No dejamos un pago pendiente huérfano si la confirmación falló.
      await supabaseAdmin.from('payments').delete().eq('id', pago.id);

      const status = RECHAZO_TRIGGER.test(resultado.error) ? 409 : 500;
      return res.status(status).json({ error: resultado.error });
    }

    await registrarAuditoria({
      adminId: req.usuario.id,
      accion: 'pago_cargado_admin',
      tabla: 'payments',
      registroId: pago.id,
      detalle: {
        perfil_id: factura.perfil_id,
        factura_id,
        monto: factura.valor_total,
        metodo,
        referencia: referencia || null,
      },
    });

    return res.status(201).json({ message: 'Pago registrado y confirmado', pago: resultado.pago });
  } catch (err) {
    return errorInesperado(res, err);
  }
}

// Eliminar un pago registrado por error. Si ya fue confirmado, no se
// permite borrarlo porque la factura asociada ya quedó marcada como pagada
// con base en él.
async function eliminarPago(req, res) {
  const { id } = req.params;

  try {
    const { data: pago, error: errorBusqueda } = await paymentModel.getById(
      id,
      'id, confirmado, perfil_id, factura_id, monto, metodo, referencia'
    );

    if (errorBusqueda || !pago) {
      return res.status(404).json({ error: 'Pago no encontrado' });
    }

    if (pago.confirmado) {
      return res.status(409).json({
        error: 'No se puede eliminar un pago ya confirmado, porque la factura quedó marcada como pagada con base en él.',
      });
    }

    const { data, error } = await paymentModel.remove(id);

    if (error || !data) {
      return res.status(404).json({ error: 'Pago no encontrado' });
    }

    await registrarAuditoria({
      adminId: req.usuario.id,
      accion: 'pago_eliminado',
      tabla: 'payments',
      registroId: id,
      detalle: {
        perfil_id: pago.perfil_id,
        factura_id: pago.factura_id,
        monto: pago.monto,
        metodo: pago.metodo,
      },
    });
    if (pago.metodo === 'fisico') await recibosPagoService.eliminarRecibo(pago.referencia);

    return res.status(200).json({ message: 'Pago eliminado', pago: data });
  } catch (err) {
    return errorInesperado(res, err);
  }
}

module.exports = {
  cotizacionWompi,
  misPagos,
  registrarPago,
  registrarPagoFisicoConRecibo,
  listarPagos,
  listarPagosWompi,
  confirmarPagoManual,
  registrarPagoAdmin,
  eliminarPago,
};
