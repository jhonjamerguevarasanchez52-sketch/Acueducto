const express = require('express');
const router = express.Router();
const { verTarifas, tarifaVigente, crearTarifa } = require('../controller/tarifaController');
const { verificarToken } = require('../middleware/authMiddleware');
const { verificarRol } = require('../middleware/roleMiddleware');

router.get('/', verificarToken, verTarifas);
router.get('/vigente', verificarToken, tarifaVigente);
router.post('/', verificarToken, verificarRol('administrador'), crearTarifa);

module.exports = router;
