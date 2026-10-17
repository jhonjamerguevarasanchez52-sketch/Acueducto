const paymentModel = require('../models/paymentModel');
const invoiceModel = require('../models/invoiceModel');
const { confirmarPago } = require('../services/pagosService');
const { calcularFirmaIntegridad } = require('../utils/wompiFirma');
const { errorInesperado, errorConsulta } = require('../utils/httpErrores');

const WOMPI_CURRENCY = process.env.WOMPI_CURRENCY || 'COP';
const ESTADOS_WOMPI_REINTENTABLES = new Set(['DECLINED', 'VOIDED', 'ERROR']);

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

// Confirmar un pago manualmente (efectivo, transferencia, etc.)
async function confirmarPagoManual(req, res) {
  const { id } = req.params;

  try {
    const resultado = await confirmarPago(id, { metodo_confirmacion: 'manual' });

    if (!resultado.ok) {
      const status = resultado.error === 'Pago no encontrado' ? 404 : 500;
      return res.status(status).json({ error: resultado.error });
    }

    return res.status(200).json({ message: 'Pago confirmado', pago: resultado.pago });
  } catch (err) {
    return errorInesperado(res, err);
  }
}

// Eliminar un pago registrado por error. Si ya fue confirmado, no se
// permite borrarlo directamente porque la factura asociada ya quedó marcada
// como pagada con base en él; primero hay que revertir esa confirmación.
async function eliminarPago(req, res) {
  const { id } = req.params;

  try {
    const { data: pago, error: errorBusqueda } = await paymentModel.getById(id, 'id, confirmado');

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

    return res.status(200).json({ message: 'Pago eliminado', pago: data });
  } catch (err) {
    return errorInesperado(res, err);
  }
}

module.exports = { misPagos, registrarPago, listarPagos, confirmarPagoManual, eliminarPago };
