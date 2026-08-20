const supabase = require('../config/supabaseClient');

// POST / - usuario final reporta una avería
async function reportarAveria(req, res) {
  try {
    const perfilId = req.usuario.id;
    const zonaUsuario = req.usuario.zona;
    const { descripcion } = req.body;

    if (!descripcion) {
      return res.status(400).json({ error: 'La descripción es obligatoria' });
    }

    const { data, error } = await supabase
      .from('breakdowns')
      .insert({
        perfil_id: perfilId,
        descripcion,
        zona: zonaUsuario,
        estado: 'reportada',
        fecha_reporte: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({ data });
  } catch (err) {
    console.error('Error en reportarAveria:', err.message);
    res.status(500).json({ error: 'Error al reportar la avería' });
  }
}

// GET /mis-averias - averías reportadas por el usuario autenticado
async function misAverias(req, res) {
  try {
    const perfilId = req.usuario.id;

    const { data, error } = await supabase
      .from('breakdowns')
      .select('*')
      .eq('perfil_id', perfilId)
      .order('fecha_reporte', { ascending: false });

    if (error) throw error;

    res.status(200).json({ data });
  } catch (err) {
    console.error('Error en misAverias:', err.message);
    res.status(500).json({ error: 'Error al obtener tus averías' });
  }
}

// GET /zona - averías de la zona del fontanero autenticado
async function averiasZona(req, res) {
  try {
    const zonaFontanero = req.usuario.zona;

    if (!zonaFontanero) {
      return res.status(400).json({ error: 'El fontanero no tiene una zona asignada' });
    }

    const { data, error } = await supabase
      .from('breakdowns')
      .select('*')
      .eq('zona', zonaFontanero)
      .order('fecha_reporte', { ascending: false });

    if (error) throw error;

    res.status(200).json({ data });
  } catch (err) {
    console.error('Error en averiasZona:', err.message);
    res.status(500).json({ error: 'Error al obtener averías de la zona' });
  }
}

// PUT /:id - fontanero actualiza el estado de una avería
async function actualizarAveria(req, res) {
  try {
    const fontaneroId = req.usuario.id;
    const { id } = req.params;
    const { estado } = req.body;

    const estadosValidos = ['reportada', 'asignada', 'en_proceso', 'resuelta', 'cancelada'];
    if (!estado || !estadosValidos.includes(estado)) {
      return res.status(400).json({ error: 'Estado inválido' });
    }

    const actualizacion = {
      estado,
      fontanero_id: fontaneroId
    };

    if (estado === 'resuelta') {
      actualizacion.fecha_resolucion = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('breakdowns')
      .update(actualizacion)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    if (!data) {
      return res.status(404).json({ error: 'Avería no encontrada' });
    }

    res.status(200).json({ data });
  } catch (err) {
    console.error('Error en actualizarAveria:', err.message);
    res.status(500).json({ error: 'Error al actualizar la avería' });
  }
}

module.exports = { reportarAveria, misAverias, averiasZona, actualizarAveria };