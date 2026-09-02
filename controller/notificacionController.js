const supabaseAdmin = require('../config/supabaseAdminClient');
const { notificar } = require('../utils/notificar');

// ---------- USUARIO FINAL ----------

// Ver todas mis notificaciones
async function misNotificaciones(req, res) {
  const userId = req.usuario.id;

  try {
    const { data, error } = await req.db
      .from('notifications')
      .select('*')
      .eq('perfil_id', userId)
      .order('fecha', { ascending: false });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: 'Error inesperado', detalle: err.message });
  }
}

// Contar mis notificaciones no leídas
async function contarNoLeidas(req, res) {
  const userId = req.usuario.id;

  try {
    const { count, error } = await req.db
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('perfil_id', userId)
      .eq('estado', 'no_leido');

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ noLeidas: count });
  } catch (err) {
    return res.status(500).json({ error: 'Error inesperado', detalle: err.message });
  }
}

// Marcar una notificación como leída
async function marcarLeida(req, res) {
  const userId = req.usuario.id;
  const { id } = req.params;

  try {
    const { data, error } = await req.db
      .from('notifications')
      .update({ estado: 'leido' })
      .eq('id', id)
      .eq('perfil_id', userId)
      .select()
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'Notificación no encontrada' });
    }

    return res.status(200).json({ message: 'Notificación marcada como leída', notificacion: data });
  } catch (err) {
    return res.status(500).json({ error: 'Error inesperado', detalle: err.message });
  }
}

// Marcar TODAS mis notificaciones como leídas
async function marcarTodasLeidas(req, res) {
  const userId = req.usuario.id;

  try {
    const { error } = await req.db
      .from('notifications')
      .update({ estado: 'leido' })
      .eq('perfil_id', userId)
      .eq('estado', 'no_leido');

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ message: 'Todas las notificaciones marcadas como leídas' });
  } catch (err) {
    return res.status(500).json({ error: 'Error inesperado', detalle: err.message });
  }
}

// ---------- ADMINISTRADOR ----------

// Enviar una notificación a un usuario, o a todos (perfil_id: "todos")
async function enviarNotificacion(req, res) {
  const { perfil_id, mensaje, tipo } = req.body;

  if (!perfil_id || !mensaje) {
    return res.status(400).json({ error: 'perfil_id y mensaje son obligatorios' });
  }

  try {
    if (perfil_id === 'todos') {
      const { data: perfiles, error: perfilesError } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('activo', true);

      if (perfilesError) return res.status(500).json({ error: perfilesError.message });

      const filas = perfiles.map((p) => ({
        perfil_id: p.id,
        mensaje,
        tipo: tipo || 'general',
        estado: 'no_leido',
        fecha: new Date().toISOString(),
      }));

      const { error } = await supabaseAdmin.from('notifications').insert(filas);
      if (error) return res.status(500).json({ error: error.message });

      return res.status(201).json({ message: `Notificación enviada a ${filas.length} usuarios` });
    }

    await notificar(perfil_id, mensaje, tipo || 'general');
    return res.status(201).json({ message: 'Notificación enviada' });
  } catch (err) {
    return res.status(500).json({ error: 'Error inesperado', detalle: err.message });
  }
}

module.exports = {
  misNotificaciones,
  contarNoLeidas,
  marcarLeida,
  marcarTodasLeidas,
  enviarNotificacion,
};
