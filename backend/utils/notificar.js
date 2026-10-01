const notificationModel = require('../models/notificationModel');

/**
 * Create an in-app notification without failing the main operation.
 * Returns whether the notification was successfully saved.
 */
async function notificar(perfilId, mensaje, tipo = 'general') {
  try {
    const { error } = await notificationModel.insert({ perfil_id: perfilId, mensaje, tipo });
    if (error) {
      console.error('Error creando notificacion:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Error inesperado creando notificacion:', err.message);
    return false;
  }
}

module.exports = { notificar };
