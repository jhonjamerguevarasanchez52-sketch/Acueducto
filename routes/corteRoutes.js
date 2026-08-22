const express = require('express');
const router = express.Router();
const { misCortes, estadoServicio, todosCortes } = require('../controller/corteController');
const { verificarToken } = require('../middleware/authMiddleware');

router.get('/mis-cortes', verificarToken, misCortes);
router.get('/estado', verificarToken, estadoServicio);
router.get('/', verificarToken, todosCortes);

module.exports = router;