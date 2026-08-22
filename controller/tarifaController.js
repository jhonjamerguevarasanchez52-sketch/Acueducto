const supabase = require('../config/supabaseClient.js');

// Ver todas las tarifas
async function verTarifas(req, res) {
  try {
    const { data, error } = await supabase
      .from('rates')
      .select('*')
      .order('vigente_desde', { ascending: false });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: 'Error inesperado', detalle: err.message });
  }
}

// Ver la tarifa residencial vigente actualmente
async function tarifaVigente(req, res) {
  const hoy = new Date().toISOString().split('T')[0];

  try {
    const { data, error } = await supabase
      .from('rates')
      .select('*')
      .eq('tipo', 'residencial')
      .lte('vigente_desde', hoy)
      .or(`vigente_hasta.is.null,vigente_hasta.gte.${hoy}`)
      .order('vigente_desde', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      return res.status(404).json({ error: 'No hay tarifa vigente configurada' });
    }

    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: 'Error inesperado', detalle: err.message });
  }
}

// Crear una nueva tarifa (solo administrador — RLS lo garantiza igual)
async function crearTarifa(req, res) {
  const { tipo, cuota_fija, vigente_desde, vigente_hasta } = req.body;

  if (!cuota_fija || !vigente_desde) {
    return res.status(400).json({ error: 'cuota_fija y vigente_desde son obligatorios' });
  }

  try {
    const { data, error } = await supabase
      .from('rates')
      .insert({
        tipo: tipo || 'residencial',
        cuota_fija,
        vigente_desde,
        vigente_hasta: vigente_hasta || null,
      })
      .select()
      .single();

    if (error) {
      return res.status(403).json({ error: 'No tienes permiso para crear tarifas' });
    }

    return res.status(201).json({ message: 'Tarifa creada con éxito', tarifa: data });
  } catch (err) {
    return res.status(500).json({ error: 'Error inesperado', detalle: err.message });
  }
}

module.exports = { verTarifas, tarifaVigente, crearTarifa };