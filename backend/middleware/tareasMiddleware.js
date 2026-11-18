const crypto = require('crypto');
const { verificarToken } = require('./authMiddleware');

/**
 * Permite el paso a las tareas automáticas de dos formas:
 *  - pg_cron (o cualquier programador) con el encabezado x-cron-secret igual
 *    a la variable de entorno CRON_SECRET (el mismo secreto de /api/interno);
 *  - un administrador con sesión, para correrlas a mano desde el panel.
 */
function secretoValido(recibido) {
  const esperado = process.env.CRON_SECRET;
  if (!esperado || !recibido) return false;
  // Se comparan los hash para que la longitud no se filtre por tiempo.
  const a = crypto.createHash('sha256').update(String(recibido)).digest();
  const b = crypto.createHash('sha256').update(esperado).digest();
  return crypto.timingSafeEqual(a, b);
}

function verificarTarea(req, res, next) {
  if (secretoValido(req.headers['x-cron-secret'])) return next();

  return verificarToken(req, res, () => {
    if (req.usuario?.rol !== 'administrador') {
      return res.status(403).json({ error: 'Solo un administrador puede ejecutar las tareas.' });
    }
    return next();
  });
}

module.exports = { verificarTarea, secretoValido };
