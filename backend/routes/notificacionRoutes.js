const express = require('express');
const router = express.Router();
const {
  misNotificaciones,
  contarNoLeidas,
  marcarLeida,
  marcarTodasLeidas,
  eliminarNotificacion,
  enviarNotificacion,
} = require('../controller/notificacionController');
const { verificarToken } = require('../middleware/authMiddleware');
const { verificarRol } = require('../middleware/roleMiddleware');

// Administrador y fontanero pueden publicar avisos generales del servicio.
router.post('/', verificarToken, verificarRol('administrador', 'fontanero'), enviarNotificacion);

// --- Usuario final ---
router.get('/', verificarToken, misNotificaciones);
router.get('/no-leidas', verificarToken, contarNoLeidas);
router.put('/marcar-todas', verificarToken, marcarTodasLeidas);
router.put('/:id/leida', verificarToken, marcarLeida);
router.delete('/:id', verificarToken, eliminarNotificacion);

module.exports = router;
