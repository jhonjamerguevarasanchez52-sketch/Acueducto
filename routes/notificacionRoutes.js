const express = require('express');
const router = express.Router();
const {
  misNotificaciones,
  contarNoLeidas,
  marcarLeida,
  marcarTodasLeidas,
  enviarNotificacion,
} = require('../controller/notificacionController');
const { verificarToken } = require('../middleware/authMiddleware');
const { verificarRol } = require('../middleware/roleMiddleware');

// --- Administrador ---
router.post('/', verificarToken, verificarRol('administrador'), enviarNotificacion);

// --- Usuario final ---
router.get('/', verificarToken, misNotificaciones);
router.get('/no-leidas', verificarToken, contarNoLeidas);
router.put('/marcar-todas', verificarToken, marcarTodasLeidas);
router.put('/:id/leida', verificarToken, marcarLeida);

module.exports = router;
