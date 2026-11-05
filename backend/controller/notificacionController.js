const notificationModel = require('../models/notificationModel');
const profileModel = require('../models/profileModel');
const { enviarAvisosCorreo } = require('../services/avisosCorreo');
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
    // RLS no permite DELETE a la app: el filtro por perfil_id del modelo es
    // lo que garantiza que solo se borre una notificación propia.
    const { data, error } = await notificationModel.removeOwn(id, userId);

    if (error || !data) {
      return res.status(404).json({ error: 'Notificación no encontrada' });
    }

    return res.status(200).json({ message: 'Notificación eliminada', notificacion: data });
  } catch (err) {
    return errorInesperado(res, err);
  }
}

// ---------- ADMINISTRADOR ----------

// La app agrupa y colorea los avisos por tipo; uno desconocido se vería roto.
const TIPOS_AVISO = ['general', 'servicio', 'factura', 'corte', 'averia'];
const MAX_MENSAJE_AVISO = 1000;

// Enviar una notificación a un usuario, o a todos (perfil_id: "todos")
async function enviarNotificacion(req, res) {
  const { perfil_id = 'todos', mensaje, tipo = 'general', enviar_correo = false } = req.body;

  if (typeof mensaje !== 'string' || !mensaje.trim()) {
    return res.status(400).json({ error: 'El mensaje es obligatorio' });
  }
  if (mensaje.trim().length > MAX_MENSAJE_AVISO) {
    return res.status(400).json({ error: `El mensaje admite máximo ${MAX_MENSAJE_AVISO} caracteres.` });
  }
  if (!TIPOS_AVISO.includes(tipo)) {
    return res.status(400).json({ error: `Tipo de aviso inválido. Usa: ${TIPOS_AVISO.join(', ')}` });
  }
  if (req.usuario.rol === 'fontanero' && perfil_id !== 'todos') {
    return res.status(403).json({ error: 'El fontanero solo puede enviar avisos generales' });
  }
  if (enviar_correo && req.usuario.rol !== 'administrador') {
    return res.status(403).json({ error: 'Solo un administrador puede enviar avisos por correo' });
  }

  try {
    if (perfil_id === 'todos') {
      const { data: perfiles, error: perfilesError } = await profileModel.listRegisteredUsersForNotifications();

      if (perfilesError) return errorConsulta(res, perfilesError);
      if (!perfiles.length) return res.status(404).json({ error: 'No hay usuarios registrados para notificar' });

      const { error } = await notificationModel.createMany(
        perfiles.map((p) => p.id),
        { mensaje: mensaje.trim(), tipo }
      );
      if (error) return errorConsulta(res, error);

      const resultadoCorreo = enviar_correo ? await enviarAvisosCorreo(perfiles, mensaje.trim()) : null;

      return res.status(201).json({ message: "Aviso enviado a " + perfiles.length + " usuarios registrados.", usuarios_notificados: perfiles.length, ...(resultadoCorreo ? { correos_enviados: resultadoCorreo.enviados, correos_fallidos: resultadoCorreo.fallidos } : {}) });
    }

    const { data, error } = await notificationModel.create({ perfil_id, mensaje: mensaje.trim(), tipo });

    if (error) return errorConsulta(res, error);

    let resultadoCorreo = null;
    if (enviar_correo) {
      const { data: perfil, error: perfilError } = await profileModel.getById(perfil_id, {
        columns: 'id, nombre, correo, rol',
      });
      if (perfilError || !perfil) {
        resultadoCorreo = { enviados: 0, fallidos: 1 };
      } else {
        resultadoCorreo = await enviarAvisosCorreo([perfil], mensaje.trim());
      }
    }

    return res.status(201).json({ message: "Aviso enviado.", notificacion: data, ...(resultadoCorreo ? { correos_enviados: resultadoCorreo.enviados, correos_fallidos: resultadoCorreo.fallidos } : {}) });
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
