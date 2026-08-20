const express = require('express');
const router = express.Router();
const { misPagos, registrarPago } = require('../controller/pagoController');
const verificarToken = require('../middleware/authMiddleware');

router.get('/', verificarToken, misPagos);
router.post('/', verificarToken, registrarPago);

module.exports = router;