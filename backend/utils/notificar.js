const notificationModel = require('../models/notificationModel');

/**
 * Crea una notificación para un usuario. Pensada para llamarse desde el
 * backend cuando ocurre un evento relevante (nueva factura, pago confirmado,
 * corte de servicio, avería actualizada, etc.).
 *
 * No lanza: si falla, registra el error y sigue, para no tumbar la
 * operación principal por un problema de notificación.
 */
async function notificar(perfilId, mensaje, tipo = 'general') {
  try {
    const { error } = await notificationModel.insert({ perfil_id: perfilId, mensaje, tipo });
    if (error) console.error('Error creando notificación:', error.message);
  } catch (err) {
    console.error('Error inesperado creando notificación:', err.message);
  }
}

module.exports = { notificar };
