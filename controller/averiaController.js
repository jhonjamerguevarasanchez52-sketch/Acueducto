// Los controladores usan req.supabase (cliente ligado al token del usuario)
// para que la RLS se aplique en cada consulta.

const ESTADOS_VALIDOS = ['reportada', 'asignada', 'en_proceso', 'resuelta', 'cancelada'];

// POST / - usuario final reporta una avería
async function reportarAveria(req, res) {
  try {
    const perfilId = req.usuario.id;
    const zonaUsuario = req.usuario.zona;
    const { descripcion } = req.body;

    if (!descripcion || !descripcion.trim()) {
      return res.status(400).json({ error: 'La descripción es obligatoria' });
    }

    if (!zonaUsuario) {
      return res.status(400).json({ error: 'Tu perfil no tiene una zona asignada; contacta al administrador' });
    }

    const { data, error } = await req.supabase
      .from('breakdowns')
      .insert({
        perfil_id: perfilId,
        descripcion: descripcion.trim(),
        zona: zonaUsuario,
        estado: 'reportada',
        fecha_reporte: new Date().toISOString(),
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

    const { data, error } = await req.supabase
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

    const { data, error } = await req.supabase
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

// PUT /:id - fontanero actualiza el estado de una avería de su zona
async function actualizarAveria(req, res) {
  try {
    const fontaneroId = req.usuario.id;
    const zonaFontanero = req.usuario.zona;
    const { id } = req.params;
    const { estado } = req.body;

    if (!estado || !ESTADOS_VALIDOS.includes(estado)) {
      return res.status(400).json({ error: 'Estado inválido' });
    }

    if (!zonaFontanero) {
      return res.status(400).json({ error: 'El fontanero no tiene una zona asignada' });
    }

    // Comprobamos que la avería exista y sea de la zona del fontanero.
    const { data: averia, error: errorBusqueda } = await req.supabase
      .from('breakdowns')
      .select('id, zona')
      .eq('id', id)
      .maybeSingle();

    if (errorBusqueda) throw errorBusqueda;

    if (!averia) {
      return res.status(404).json({ error: 'Avería no encontrada' });
    }

    if (averia.zona !== zonaFontanero) {
      return res.status(403).json({ error: 'No puedes actualizar averías fuera de tu zona' });
    }

    const actualizacion = {
      estado,
      fontanero_id: fontaneroId,
    };

    if (estado === 'resuelta') {
      actualizacion.fecha_resolucion = new Date().toISOString();
    }

    const { data, error } = await req.supabase
      .from('breakdowns')
      .update(actualizacion)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.status(200).json({ data });
  } catch (err) {
    console.error('Error en actualizarAveria:', err.message);
    res.status(500).json({ error: 'Error al actualizar la avería' });
  }
}

module.exports = { reportarAveria, misAverias, averiasZona, actualizarAveria };
