const supabaseAdmin = require('../config/supabaseAdminClient');
const { notificar } = require('../utils/notificar');
const { enviarCorreo } = require('../config/mailer');
const { errorInesperado, errorConsulta } = require('../utils/httpErrores');
const { aplicarPaginacion } = require('../utils/paginacion');

const ESTADOS_VALIDOS = ['reportada', 'en_proceso', 'resuelta', 'cancelada'];

// Avisa por correo al/los fontanero(s) activos de una nueva avería reportada.
// No lanza: si falla el envío, se registra el error y se sigue, para no
// tumbar el reporte de la avería por un problema de correo.
async function avisarFontaneroPorCorreo(averia) {
  try {
    const { data: fontaneros, error } = await supabaseAdmin
      .from('profiles')
      .select('correo')
      .eq('rol', 'fontanero')
      .eq('activo', true);

    if (error) throw error;
    if (!fontaneros || fontaneros.length === 0) return;

    const html = `<p>Se reportó una nueva avería:</p>
      <p><strong>Descripción:</strong> ${averia.descripcion}</p>
      ${averia.zona ? `<p><strong>Zona:</strong> ${averia.zona}</p>` : ''}
      <p><strong>Fecha:</strong> ${new Date(averia.fecha_reporte).toLocaleString('es-CO')}</p>`;

    await Promise.all(
      fontaneros.map((f) =>
        enviarCorreo({
          to: f.correo,
          subject: 'Nueva avería reportada - Acueducto Campoamor',
          html,
        })
      )
    );
  } catch (err) {
    console.error('Error avisando al fontanero por correo:', err.message);
  }
}

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

    if (error) return errorConsulta(res, error);

    await avisarFontaneroPorCorreo(data);

    res.status(201).json({ data });
  } catch (err) {
    return errorInesperado(res, err);
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

    if (error) return errorConsulta(res, error);

    res.status(200).json({ data });
  } catch (err) {
    return errorInesperado(res, err);
  }
}

// ---------- FONTANERO ----------

// GET / - el fontanero (único) ve TODAS las averías.
// La `zona` identifica la ubicación del beneficiario, no una zona de
// asignación, así que no se filtra por ella.
async function listarAverias(req, res) {
  try {
    const { estado, limit, offset } = req.query;

    let query = supabaseAdmin
      .from('breakdowns')
      .select('*')
      .order('fecha_reporte', { ascending: false });

    if (estado) query = query.eq('estado', estado);
    query = aplicarPaginacion(query, { limit, offset });

    const { data, error } = await query;
    if (error) return errorConsulta(res, error);

    res.status(200).json({ data });
  } catch (err) {
    return errorInesperado(res, err);
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

    if (error) return errorConsulta(res, error);
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
    return errorInesperado(res, err);
  }
}

// DELETE /:id - el fontanero o el administrador borran un reporte
// erróneo o duplicado.
async function eliminarAveria(req, res) {
  try {
    const { id } = req.params;

    const { data, error } = await supabaseAdmin
      .from('breakdowns')
      .delete()
      .eq('id', id)
      .select()
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'Avería no encontrada' });
    }

    res.status(200).json({ message: 'Avería eliminada', data });
  } catch (err) {
    return errorInesperado(res, err);
  }
}

module.exports = { reportarAveria, misAverias, listarAverias, actualizarAveria, eliminarAveria };
