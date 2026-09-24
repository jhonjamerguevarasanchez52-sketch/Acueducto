const notificationModel = require('../models/notificationModel');
const profileModel = require('../models/profileModel');
const { errorInesperado, errorConsulta } = require('../utils/httpErrores');

// ---------- USUARIO FINAL ----------

// Ver todas mis notificaciones
async function misNotificaciones(req, res) {
  const userId = req.usuario.id;

  try {
    const { data, error } = await notificationModel.listByProfile(userId, req.db);

    if (error) {
      return errorConsulta(res, error);
    }

    return res.status(200).json(data);
  } catch (err) {
    return errorInesperado(res, err);
  }
}

// Contar mis notificaciones no leídas
async function contarNoLeidas(req, res) {
  const userId = req.usuario.id;

  try {
    const { count, error } = await notificationModel.countUnread(userId, req.db);

    if (error) {
      return errorConsulta(res, error);
    }

    return res.status(200).json({ noLeidas: count });
  } catch (err) {
    return errorInesperado(res, err);
  }
}

// Marcar una notificación como leída
async function marcarLeida(req, res) {
  const userId = req.usuario.id;
  const { id } = req.params;

  try {
    const { data, error } = await notificationModel.markRead(id, userId, req.db);

    if (error || !data) {
      return res.status(404).json({ error: 'Notificación no encontrada' });
    }

    return res.status(200).json({ message: 'Notificación marcada como leída', notificacion: data });
  } catch (err) {
    return errorInesperado(res, err);
  }
}

// Marcar TODAS mis notificaciones como leídas
async function marcarTodasLeidas(req, res) {
  const userId = req.usuario.id;

  try {
    const { error } = await notificationModel.markAllRead(userId, req.db);

    if (error) {
      return errorConsulta(res, error);
    }

    return res.status(200).json({ message: 'Todas las notificaciones marcadas como leídas' });
  } catch (err) {
    return errorInesperado(res, err);
  }
}

// Eliminar una notificación propia
async function eliminarNotificacion(req, res) {
  const userId = req.usuario.id;
  const { id } = req.params;

  try {
    const { data, error } = await notificationModel.removeOwn(id, userId, req.db);

    if (error || !data) {
      return res.status(404).json({ error: 'Notificación no encontrada' });
    }

    return res.status(200).json({ message: 'Notificación eliminada', notificacion: data });
  } catch (err) {
    return errorInesperado(res, err);
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
      const { data: perfiles, error: perfilesError } = await profileModel.listActiveIds();

      if (perfilesError) return errorConsulta(res, perfilesError);

      const { error } = await notificationModel.createMany(
        perfiles.map((p) => p.id),
        { mensaje, tipo }
      );
      if (error) return errorConsulta(res, error);

      return res.status(201).json({ message: `Notificación enviada a ${perfiles.length} usuarios` });
    }

    const { data, error } = await notificationModel.create({ perfil_id, mensaje, tipo });

    if (error) return errorConsulta(res, error);

    return res.status(201).json({ message: 'Notificación enviada', notificacion: data });
  } catch (err) {
    return errorInesperado(res, err);
  }
}

module.exports = {
  misNotificaciones,
  contarNoLeidas,
  marcarLeida,
  marcarTodasLeidas,
  eliminarNotificacion,
  enviarNotificacion,
};
