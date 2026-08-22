const express = require('express');
const router = express.Router();
const { misCortes, estadoServicio, todosCortes } = require('../controller/corteController.js');
const { verificarToken } = require('../middleware/authMiddleware.js');

router.get('/mis-cortes', verificarToken, misCortes);
router.get('/estado', verificarToken, estadoServicio);
router.get('/', verificarToken, todosCortes);

module.exports = router;