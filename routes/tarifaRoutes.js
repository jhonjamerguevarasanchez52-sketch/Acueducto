const express = require('express');
const router = express.Router();
const { verTarifas, tarifaVigente, crearTarifa } = require('../controller/tarifaController');
const verificarToken = require('../middleware/authMiddleware');

router.get('/', verificarToken, verTarifas);
router.get('/vigente', verificarToken, tarifaVigente);
router.post('/', verificarToken, crearTarifa);

module.exports = router;