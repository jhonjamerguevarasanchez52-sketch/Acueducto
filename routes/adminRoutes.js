const express = require('express');
const router = express.Router();
const { cambiarRol, verTodosUsuarios } = require('../controller/adminController.js');
const { verificarToken } = require('../middleware/authMiddleware.js');
const verificarAdmin = require('../middleware/adminMiddleware.js');

router.get('/usuarios', verificarToken, verificarAdmin, verTodosUsuarios);
router.put('/usuarios/:userId/rol', verificarToken, verificarAdmin, cambiarRol);

module.exports = router;