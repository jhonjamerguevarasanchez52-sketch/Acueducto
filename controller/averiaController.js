const supabaseAdmin = require('../config/supabaseAdminClient');
const { notificar } = require('../utils/notificar');

const ESTADOS_VALIDOS = ['reportada', 'en_proceso', 'resuelta', 'cancelada'];

// ---------- USUARIO FINAL ----------

// POST / - el usuario reporta una avería
async function reportarAveria(req, res) {
  try {
    const perfilId = req.usuario.id;
    const zonaUsuario = req.usuario.zona;
    const { descripcion } = req.body;

    if (!descripcion || !descripcion.trim()) {
      return res.status(400).json({ error: 'La descripción es obligatoria' });
    }

    const { data, error } = await req.db
      .from('breakdowns')
      .insert({
        perfil_id: perfilId,
        descripcion: descripcion.trim(),
        zona: zonaUsuario || null,
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

    const { data, error } = await req.db
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

// ---------- FONTANERO ----------

// GET / - el fontanero (único) ve TODAS las averías.
// La `zona` identifica la ubicación del beneficiario, no una zona de
// asignación, así que no se filtra por ella.
async function listarAverias(req, res) {
  try {
    const { estado } = req.query;

    let query = supabaseAdmin
      .from('breakdowns')
      .select('*')
      .order('fecha_reporte', { ascending: false });

    if (estado) query = query.eq('estado', estado);

    const { data, error } = await query;
    if (error) throw error;

    res.status(200).json({ data });
  } catch (err) {
    console.error('Error en listarAverias:', err.message);
    res.status(500).json({ error: 'Error al obtener las averías' });
  }
}

// PUT /:id - el fontanero actualiza el estado de una avería
async function actualizarAveria(req, res) {
  try {
    const fontaneroId = req.usuario.id;
    const { id } = req.params;
    const { estado, nota } = req.body;

    if (!estado || !ESTADOS_VALIDOS.includes(estado)) {
      return res.status(400).json({
        error: `Estado inválido. Usa: ${ESTADOS_VALIDOS.join(', ')}`,
      });
    }

    const actualizacion = { estado, fontanero_id: fontaneroId };
    if (nota !== undefined) actualizacion.nota_fontanero = nota;
    if (estado === 'resuelta') {
      actualizacion.fecha_resolucion = new Date().toISOString();
    }

    const { data, error } = await supabaseAdmin
      .from('breakdowns')
      .update(actualizacion)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    if (!data) {
      return res.status(404).json({ error: 'Avería no encontrada' });
    }

    await notificar(
      data.perfil_id,
      `El estado de tu avería reportada cambió a "${estado}".`,
      'averia'
    );

    res.status(200).json({ data });
  } catch (err) {
    console.error('Error en actualizarAveria:', err.message);
    res.status(500).json({ error: 'Error al actualizar la avería' });
  }
}

module.exports = { reportarAveria, misAverias, listarAverias, actualizarAveria };
