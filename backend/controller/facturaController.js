const invoiceModel = require('../models/invoiceModel');
const paymentModel = require('../models/paymentModel');
const profileModel = require('../models/profileModel');
const { notificar } = require('../utils/notificar');
const { enviarCorreo } = require('../config/mailer');
const { errorInesperado, errorConsulta } = require('../utils/httpErrores');

function formatearMoneda(valor) {
  return Number(valor).toLocaleString('es-CO');
}

async function enviarCorreoFactura({ correo, nombre, periodo, valorTotal, fechaVencimiento }) {
  if (!correo) return;
  try {
    await enviarCorreo({
      to: correo,
      subject: `Nueva factura - periodo ${periodo} - Acueducto Campoamor`,
      html: `<p>Hola ${nombre || ''},</p>
             <p>Se generó tu factura del periodo <strong>${periodo}</strong> por un valor de
             <strong>$${formatearMoneda(valorTotal)}</strong>.</p>
             ${fechaVencimiento ? `<p>Fecha límite de pago: ${new Date(fechaVencimiento).toLocaleDateString('es-CO')}.</p>` : ''}
             <p>Puedes consultar el detalle desde la aplicación de Acueducto Campoamor.</p>`,
    });
  } catch (mailErr) {
    console.error('Error enviando correo de factura:', mailErr.message);
  }
}

// ---------- USUARIO FINAL ----------

// Ver mis facturas
async function misFacturas(req, res) {
  const userId = req.usuario.id;

  try {
    const { data, error } = await invoiceModel.listByProfile(userId, req.db);

    if (error) {
      return errorConsulta(res, error);
    }

    return res.status(200).json(data);
  } catch (err) {
    return errorInesperado(res, err);
  }
}

// Ver una factura específica (propia)
async function verFactura(req, res) {
  const userId = req.usuario.id;
  const { id } = req.params;

  try {
    // getOwn asegura que solo vea sus propias facturas
    const { data, error } = await invoiceModel.getOwn(id, userId, { db: req.db });

    if (error) {
      return res.status(404).json({ error: 'Factura no encontrada' });
    }

    return res.status(200).json(data);
  } catch (err) {
    return errorInesperado(res, err);
  }
}

// ---------- ADMINISTRADOR ----------

// Listar todas las facturas, con filtros opcionales ?estado= y ?perfil_id=
async function listarFacturas(req, res) {
  const { estado, perfil_id, limit, offset } = req.query;

  try {
    const { data, error } = await invoiceModel.list({ estado, perfil_id, limit, offset });
    if (error) return errorConsulta(res, error);

    return res.status(200).json(data);
  } catch (err) {
    return errorInesperado(res, err);
  }
}

// Emitir una factura para un usuario
async function crearFactura(req, res) {
  const { perfil_id, periodo, valor_total, fecha_vencimiento, observacion } = req.body;

  if (!perfil_id || !periodo || valor_total === undefined) {
    return res.status(400).json({
      error: 'perfil_id, periodo y valor_total son obligatorios',
    });
  }

  if (!Number.isFinite(Number(valor_total)) || Number(valor_total) <= 0) {
    return res.status(400).json({ error: 'valor_total debe ser mayor que cero' });
  }

  try {
    // Verificamos que el usuario destino exista
    const { data: perfil, error: perfilError } = await profileModel.getById(perfil_id, {
      columns: 'id, nombre, correo',
    });

    if (perfilError || !perfil) {
      return res.status(404).json({ error: 'El usuario indicado no existe' });
    }

    const { data, error } = await invoiceModel.create({
      perfil_id,
      periodo,
      valor_total,
      fecha_vencimiento,
      observacion,
    });

    if (error) return errorConsulta(res, error);

    await notificar(
      perfil_id,
      `Se generó tu factura del periodo ${periodo} por $${valor_total}.`,
      'factura'
    );

    await enviarCorreoFactura({
      correo: perfil.correo,
      nombre: perfil.nombre,
      periodo,
      valorTotal: valor_total,
      fechaVencimiento: fecha_vencimiento,
    });

    return res.status(201).json({ message: 'Factura creada', factura: data });
  } catch (err) {
    return errorInesperado(res, err);
  }
}

// Actualizar el estado de una factura (pendiente | pagada | anulada | vencida)
async function actualizarFactura(req, res) {
  const { id } = req.params;
  const { estado, valor_total, fecha_vencimiento, observacion } = req.body;

  const estadosValidos = ['pendiente', 'pagada', 'anulada', 'vencida'];
  if (estado && !estadosValidos.includes(estado)) {
    return res.status(400).json({ error: 'Estado inválido' });
  }

  const cambios = {};
  if (estado) cambios.estado = estado;
  if (valor_total !== undefined) cambios.valor_total = valor_total;
  if (fecha_vencimiento !== undefined) cambios.fecha_vencimiento = fecha_vencimiento;
  if (observacion !== undefined) cambios.observacion = observacion;

  if (Object.keys(cambios).length === 0) {
    return res.status(400).json({ error: 'No hay campos para actualizar' });
  }

  try {
    const { data, error } = await invoiceModel.update(id, cambios);

    if (error || !data) {
      return res.status(404).json({ error: 'Factura no encontrada' });
    }

    return res.status(200).json({ message: 'Factura actualizada', factura: data });
  } catch (err) {
    return errorInesperado(res, err);
  }
}

// Eliminar una factura (solo si no tiene pagos registrados; si ya tiene
// pagos, se debe anular con actualizarFactura en vez de borrarla, para no
// perder el historial de pagos).
async function eliminarFactura(req, res) {
  const { id } = req.params;

  try {
    const { count, error: errorPagos } = await paymentModel.countByInvoice(id);

    if (errorPagos) return errorConsulta(res, errorPagos);

    if (count > 0) {
      return res.status(409).json({
        error: 'No se puede eliminar una factura con pagos registrados. Anúlala en su lugar.',
      });
    }

    const { data, error } = await invoiceModel.remove(id);

    if (error || !data) {
      return res.status(404).json({ error: 'Factura no encontrada' });
    }

    return res.status(200).json({ message: 'Factura eliminada', factura: data });
  } catch (err) {
    return errorInesperado(res, err);
  }
}

module.exports = {
  misFacturas,
  verFactura,
  listarFacturas,
  crearFactura,
  actualizarFactura,
  eliminarFactura,
};
