const express = require('express');
const router = express.Router();
const { misFacturas, verFactura } = require('../controller/facturaController');
const { verificarToken } = require('../middleware/authMiddleware'); // con llaves

router.get('/', verificarToken, misFacturas);
router.get('/:id', verificarToken, verFactura);

module.exports = router;