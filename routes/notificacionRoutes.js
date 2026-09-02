const express = require('express');
const router = express.Router();
const {
  misNotificaciones,
  contarNoLeidas,
  marcarLeida,
  marcarTodasLeidas,
} = require('../controller/notificacionController');
const { verificarToken } = require('../middleware/authMiddleware');

router.get('/', verificarToken, misNotificaciones);
router.get('/no-leidas', verificarToken, contarNoLeidas);

// Las rutas literales van antes que las paramétricas para evitar colisiones.
router.put('/marcar-todas', verificarToken, marcarTodasLeidas);
router.put('/:id/leida', verificarToken, marcarLeida);

module.exports = router;
