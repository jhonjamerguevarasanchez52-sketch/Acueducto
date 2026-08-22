const express = require('express');
const router = express.Router();
const { verTarifas, tarifaVigente, crearTarifa } = require('../controller/tarifaController.js');
const { verificarToken } = require('../middleware/authMiddleware.js');

router.get('/', verificarToken, verTarifas);
router.get('/vigente', verificarToken, tarifaVigente);
router.post('/', verificarToken, crearTarifa);

module.exports = router;