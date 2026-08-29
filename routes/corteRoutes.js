const express = require('express');
const router = express.Router();
const { misCortes, estadoServicio, todosCortes } = require('../controller/corteController');
const { verificarToken } = require('../middleware/authMiddleware');
const { verificarRol } = require('../middleware/roleMiddleware');

router.get('/mis-cortes', verificarToken, misCortes);
router.get('/estado', verificarToken, estadoServicio);
router.get('/', verificarToken, verificarRol('administrador', 'fontanero'), todosCortes);

module.exports = router;
