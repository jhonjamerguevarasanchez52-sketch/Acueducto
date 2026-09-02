const express = require('express');
const router = express.Router();
const {
  verTodosUsuarios,
  verUsuario,
  cambiarRol,
  editarUsuario,
  cambiarEstadoUsuario,
} = require('../controller/adminController');
const { verificarToken } = require('../middleware/authMiddleware');
const verificarAdmin = require('../middleware/adminMiddleware');

// Todo el módulo de administración requiere token + rol administrador
router.use(verificarToken, verificarAdmin);

router.get('/usuarios', verTodosUsuarios);
router.get('/usuarios/:userId', verUsuario);
router.put('/usuarios/:userId', editarUsuario);
router.put('/usuarios/:userId/rol', cambiarRol);
router.put('/usuarios/:userId/estado', cambiarEstadoUsuario);

module.exports = router;
