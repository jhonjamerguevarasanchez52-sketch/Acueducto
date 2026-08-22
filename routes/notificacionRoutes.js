const express = require('express');
const router = express.Router();
const {
  misNotificaciones,
  contarNoLeidas,
  marcarLeida,
  marcarTodasLeidas,
} = require('../controller/notificacionController.js');
const { verificarToken } = require('../middleware/authMiddleware.js');

router.get('/', verificarToken, misNotificaciones);
router.get('/no-leidas', verificarToken, contarNoLeidas);
router.put('/:id/leida', verificarToken, marcarLeida);
router.put('/marcar-todas', verificarToken, marcarTodasLeidas);

module.exports = router;