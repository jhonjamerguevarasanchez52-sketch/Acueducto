const supabase = require('../config/supabaseClient.js');

// Ver mis facturas (usuario normal)
async function misFacturas(req, res) {
  const userId = req.usuario.id;

  try {
    const { data, error } = await supabase
      .from('invoices')
      .select('*')
      .eq('perfil_id', userId)
      .order('fecha_emision', { ascending: false });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: 'Error inesperado', detalle: err.message });
  }
}

// Ver una factura específica
async function verFactura(req, res) {
  const userId = req.usuario.id;
  const { id } = req.params;

  try {
    const { data, error } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', id)
      .eq('perfil_id', userId) // asegura que solo vea sus propias facturas
      .single();

    if (error) {
      return res.status(404).json({ error: 'Factura no encontrada' });
    }

    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: 'Error inesperado', detalle: err.message });
  }
}

module.exports = { misFacturas, verFactura };