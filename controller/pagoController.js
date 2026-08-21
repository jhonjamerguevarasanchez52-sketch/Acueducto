const supabase = require('../config/supabaseClient');

// Ver mis pagos
async function misPagos(req, res) {
  const userId = req.usuario.id;

  try {
    const { data, error } = await supabase
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

// Registrar un nuevo pago
async function registrarPago(req, res) {
  const userId = req.usuario.id;
  const { factura_id, monto, metodo, referencia } = req.body;

  if (!factura_id || !monto || !metodo) {
    return res.status(400).json({ error: 'Faltan campos obligatorios: factura_id, monto, metodo' });
  }

  try {
    // Verifica que la factura le pertenezca al usuario antes de aceptar el pago
    const { data: factura, error: errorFactura } = await supabase
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

    // confirmado: false por defecto -> un administrador lo confirma después
    const { data, error } = await supabase
      .from('payments')
      .insert({
        factura_id,
        perfil_id: userId,
        monto,
        metodo,
        referencia: referencia || null,
        confirmado: false,
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

module.exports = { misPagos, registrarPago };