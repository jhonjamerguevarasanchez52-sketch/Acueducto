const express = require('express');
const { timingSafeEqual } = require('crypto');
const router = express.Router();
const { limpiarAudiosVencidos } = require('../services/audiosAveriaService');
const { errorInesperado } = require('../utils/httpErrores');

// Rutas para tareas programadas (pg_cron de Supabase). No usan sesión de
// usuario: se autentican con el header `x-cron-secret` = CRON_SECRET.
function verificarSecretoCron(req, res, next) {
  const esperado = process.env.CRON_SECRET;
  if (!esperado) {
    return res.status(503).json({ error: 'Las tareas programadas no están configuradas.' });
  }
  const recibido = Buffer.from(String(req.headers['x-cron-secret'] || ''));
  const secreto = Buffer.from(esperado);
  if (recibido.length !== secreto.length || !timingSafeEqual(recibido, secreto)) {
    return res.status(401).json({ error: 'No autorizado' });
  }
  return next();
}

router.post('/limpiar-audios', verificarSecretoCron, async (req, res) => {
  try {
    const resumen = await limpiarAudiosVencidos();
    if (resumen.errores.length) console.error('[limpiar-audios]', resumen.errores.join(' | '));
    return res.status(resumen.errores.length ? 500 : 200).json(resumen);
  } catch (err) {
    return errorInesperado(res, err);
  }
});

module.exports = router;
