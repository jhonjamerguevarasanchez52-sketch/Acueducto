const supabase = require('../config/supabaseClient');

// Reportar una nueva avería (cualquier usuario autenticado)
async function reportarAveria(req, res) {
  const userId = req.usuario.id;
  const { descripcion, zona } = req.body;

  if (!descripcion) {
    return res.status(400).json({ error: 'La descripción es obligatoria' });
  }

  try {
    const { data, error } = await supabase
      .from('averias')
      .insert({
        perfil_id: userId,
        descripcion,
        zona: zona || null,
        estado: 'reportada',
      })
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.status(201).json({ message: 'Avería reportada con éxito', averia: data });
  } catch (err) {
    return res.status(500).json({ error: 'Error inesperado', detalle: err.message });
  }
}

// Ver mis averías reportadas (usuario normal)
async function misAverias(req, res) {
  const userId = req.usuario.id;

  try {
    const { data, error } = await supabase
      .from('averias')
      .select('*')
      .eq('perfil_id', userId)
      .order('fecha_reporte', { ascending: false });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: 'Error inesperado', detalle: err.message });
  }
}

// Ver averías de mi zona (fontanero) — RLS ya filtra automáticamente
async function averiasZona(req, res) {
  try {
    const { data, error } = await supabase
      .from('averias')
      .select('*')
      .order('fecha_reporte', { ascending: false });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: 'Error inesperado', detalle: err.message });
  }
}

// Actualizar estado de una avería (solo fontanero/administrador, según RLS)
async function actualizarAveria(req, res) {
  const userId = req.usuario.id;
  const { id } = req.params;
  const { estado, fontanero_id } = req.body;

  const estadosValidos = ['reportada', 'asignada', 'en_proceso', 'resuelta', 'cancelada'];
  if (estado && !estadosValidos.includes(estado)) {
    return res.status(400).json({ error: 'Estado inválido' });
  }

  const datosActualizar = {};
  if (estado) datosActualizar.estado = estado;
  if (fontanero_id) datosActualizar.fontanero_id = fontanero_id;
  if (estado === 'resuelta') datosActualizar.fecha_resolucion = new Date().toISOString();

  if (Object.keys(datosActualizar).length === 0) {
    return res.status(400).json({ error: 'No hay campos para actualizar' });
  }

  try {
    const { data, error } = await supabase
      .from('averias')
      .update(datosActualizar)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      // Si RLS bloquea (no es fontanero/admin), Supabase devuelve error o data vacía
      return res.status(403).json({ error: 'No tienes permiso para actualizar esta avería' });
    }

    return res.status(200).json({ message: 'Avería actualizada', averia: data });
  } catch (err) {
    return res.status(500).json({ error: 'Error inesperado', detalle: err.message });
  }
}

module.exports = { reportarAveria, misAverias, averiasZona, actualizarAveria };