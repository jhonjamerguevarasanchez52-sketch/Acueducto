const express = require('express');
const router = express.Router();
const { misPagos, registrarPago } = require('../controller/pagoController.js');
const { verificarToken } = require('../middleware/authMiddleware.js');

router.get('/', verificarToken, misPagos);
router.post('/', verificarToken, registrarPago);

module.exports = router;