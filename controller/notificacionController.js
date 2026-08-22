const supabase = require('../config/supabaseClient.js');

// Ver todas mis notificaciones
async function misNotificaciones(req, res) {
  const userId = req.usuario.id;

  try {
    const { data, error } = await supabase
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
    const { count, error } = await supabase
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
    const { data, error } = await supabase
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
    const { error } = await supabase
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

module.exports = { misNotificaciones, contarNoLeidas, marcarLeida, marcarTodasLeidas };