const express = require('express');
const router = express.Router();
const { cambiarRol, verTodosUsuarios } = require('../controller/adminController');
const { verificarToken } = require('../middleware/authMiddleware');
const { verificarAdmin } = require('../middleware/adminMiddleware');

router.get('/usuarios', verificarToken, verificarAdmin, verTodosUsuarios);
router.put('/usuarios/:userId/rol', verificarToken, verificarAdmin, cambiarRol);

module.exports = router;
