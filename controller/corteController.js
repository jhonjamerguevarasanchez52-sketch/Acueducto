// Ver mis cortes de servicio (usuario normal)
async function misCortes(req, res) {
  const userId = req.usuario.id;

  try {
    const { data, error } = await req.supabase
      .from('service_outages')
      .select('*')
      .eq('perfil_id', userId)
      .order('fecha_corte', { ascending: false });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: 'Error inesperado', detalle: err.message });
  }
}

// Ver si mi servicio está activo actualmente
async function estadoServicio(req, res) {
  const userId = req.usuario.id;

  try {
    const { data, error } = await req.supabase
      .from('service_outages')
      .select('*')
      .eq('perfil_id', userId)
      .eq('estado', 'activo')
      .order('fecha_corte', { ascending: false })
      .limit(1);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    const corte = data && data.length > 0 ? data[0] : null;

    return res.status(200).json({
      servicioCortado: !!corte,
      corte,
    });
  } catch (err) {
    return res.status(500).json({ error: 'Error inesperado', detalle: err.message });
  }
}

// Ver todos los cortes (admin/fontanero)
async function todosCortes(req, res) {
  try {
    const { data, error } = await req.supabase
      .from('service_outages')
      .select('*')
      .order('fecha_corte', { ascending: false });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: 'Error inesperado', detalle: err.message });
  }
}

module.exports = { misCortes, estadoServicio, todosCortes };
