const paymentModel = require('../models/paymentModel');
const invoiceModel = require('../models/invoiceModel');
const supabaseAdmin = require('../config/supabaseAdminClient');
const { confirmarPago } = require('../services/pagosService');
const { calcularFirmaIntegridad } = require('../utils/wompiFirma');
const { registrarAuditoria } = require('../utils/auditoria');
const { errorInesperado, errorConsulta } = require('../utils/httpErrores');

const WOMPI_CURRENCY = process.env.WOMPI_CURRENCY || 'COP';
const ESTADOS_WOMPI_REINTENTABLES = new Set(['DECLINED', 'VOIDED', 'ERROR']);

// Métodos que un administrador puede usar al cargar un pago a nombre de alguien
const METODOS_ADMIN = ['efectivo', 'transferencia', 'otro'];

// Mensajes con los que el trigger procesar_pago_confirmado rechaza un pago.
// Son errores esperados del negocio (no fallos del servidor).
const RECHAZO_TRIGGER = /ya fue pagada|anulada|no coincide|no corresponde|no existe/i;

// ---------- USUARIO FINAL ----------

// Ver mis pagos
async function misPagos(req, res) {
  const userId = req.usuario.id;

  try {
    const { data, error } = await paymentModel.listByProfile(userId, req.db);

    if (error) {
      return errorConsulta(res, error);
    }

    return res.status(200).json(data);
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

  if (metodo === 'wompi' && !process.env.WOMPI_INTEGRITY_KEY) {
    return res.status(503).json({ error: 'El pago en línea no está configurado.' });
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

    const monto = factura.valor_total;

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
        pagoPendiente.metodo === 'wompi' && !pagoPendiente.estado_wompi;
      const wompiRechazado = pagoPendiente.metodo === 'wompi' &&
        ESTADOS_WOMPI_REINTENTABLES.has(pagoPendiente.estado_wompi);

      if (puedeReanudarCheckout) {
        if (Number(pagoPendiente.monto) !== Number(monto)) {
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
        { factura_id, perfil_id: userId, monto, metodo, referencia },
        req.db
      );

      if (error) {
        return errorConsulta(res, error);
      }

      pago = data;
    }

    const respuesta = {
      message: 'Pago registrado, pendiente de confirmación',
      pago,
    };

    // Wompi signs the persisted payment ID and invoice amount server-side.
    if (metodo === 'wompi') {
      try {
        const amountInCents = Math.round(Number(monto) * 100);
        respuesta.wompi = {
          reference: pago.id,
          amountInCents,
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

// ---------- ADMINISTRADOR ----------

// Listar pagos, con filtro opcional ?confirmado=true|false y ?perfil_id=
async function listarPagos(req, res) {
  const { confirmado, perfil_id, limit, offset } = req.query;

  try {
    const { data, error } = await paymentModel.list({ confirmado, perfil_id, limit, offset });
    if (error) return errorConsulta(res, error);

    return res.status(200).json(data);
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
    const resultado = await confirmarPago(id);

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
        metodo,
        referencia: referencia || null,
        registrado_por: req.usuario.id,
      })
      .select()
      .single();

    if (errorPago) return errorConsulta(res, errorPago);

    const resultado = await confirmarPago(pago.id);

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
      'id, confirmado, perfil_id, factura_id, monto, metodo'
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

    return res.status(200).json({ message: 'Pago eliminado', pago: data });
  } catch (err) {
    return errorInesperado(res, err);
  }
}

module.exports = {
  misPagos,
  registrarPago,
  listarPagos,
  listarPagosWompi,
  confirmarPagoManual,
  registrarPagoAdmin,
  eliminarPago,
};