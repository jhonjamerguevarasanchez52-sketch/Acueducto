const supabaseAdmin = require('../config/supabaseAdminClient');
const { confirmarPago } = require('../services/pagosService');

// ---------- USUARIO FINAL ----------

// Ver mis pagos
async function misPagos(req, res) {
  const userId = req.usuario.id;

  try {
    const { data, error } = await req.db
      .from('payments')
      .select('*')
      .eq('perfil_id', userId)
      .order('fecha_pago', { ascending: false });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: 'Error inesperado', detalle: err.message });
  }
}

// Registrar un pago (queda pendiente de confirmación: manual del admin o Wompi)
async function registrarPago(req, res) {
  const userId = req.usuario.id;
  const { factura_id, monto, metodo, referencia } = req.body;

  if (!factura_id || !monto || !metodo) {
    return res.status(400).json({ error: 'Faltan campos obligatorios: factura_id, monto, metodo' });
  }

  if (Number(monto) <= 0) {
    return res.status(400).json({ error: 'El monto debe ser mayor que cero' });
  }

  try {
    // Verifica que la factura le pertenezca al usuario antes de aceptar el pago
    const { data: factura, error: errorFactura } = await req.db
      .from('invoices')
      .select('id, perfil_id, valor_total, estado')
      .eq('id', factura_id)
      .eq('perfil_id', userId)
      .single();

    if (errorFactura || !factura) {
      return res.status(404).json({ error: 'Factura no encontrada o no te pertenece' });
    }

    if (factura.estado === 'pagada') {
      return res.status(400).json({ error: 'Esta factura ya fue pagada' });
    }

    if (factura.estado === 'anulada') {
      return res.status(400).json({ error: 'Esta factura está anulada' });
    }

    const { data, error } = await req.db
      .from('payments')
      .insert({
        factura_id,
        perfil_id: userId,
        monto,
        metodo,
        referencia: referencia || null,
        confirmado: false,
        fecha_pago: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.status(201).json({
      message: 'Pago registrado, pendiente de confirmación',
      pago: data,
    });
  } catch (err) {
    return res.status(500).json({ error: 'Error inesperado', detalle: err.message });
  }
}

// ---------- ADMINISTRADOR ----------

// Listar pagos, con filtro opcional ?confirmado=true|false y ?perfil_id=
async function listarPagos(req, res) {
  const { confirmado, perfil_id } = req.query;

  try {
    let query = supabaseAdmin
      .from('payments')
      .select('*')
      .order('fecha_pago', { ascending: false });

    if (confirmado === 'true') query = query.eq('confirmado', true);
    if (confirmado === 'false') query = query.eq('confirmado', false);
    if (perfil_id) query = query.eq('perfil_id', perfil_id);

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });

    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: 'Error inesperado', detalle: err.message });
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
    return res.status(500).json({ error: 'Error inesperado', detalle: err.message });
  }
}

module.exports = { misPagos, registrarPago, listarPagos, confirmarPagoManual };
