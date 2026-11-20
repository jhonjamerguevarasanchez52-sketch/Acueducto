const express = require('express');
const router = express.Router();
const {
  crearUsuario,
  verTodosUsuarios,
  verUsuario,
  cambiarRol,
  editarUsuario,
  cambiarEstadoUsuario,
  eliminarUsuario,
  verUsuariosEliminados,
  reenviarAvisoEliminacion,
  generarPazYSalvo,
  verPazYSalvos,
  descargarPazYSalvo,
  reenviarPazYSalvo,
  generarCertificadoPertenenciaUsuario,
} = require('../controller/adminController');
const { verificarToken } = require('../middleware/authMiddleware');
const verificarAdmin = require('../middleware/adminMiddleware');

// Todo el módulo de administración requiere token + rol administrador
router.use(verificarToken, verificarAdmin);

router.post('/usuarios', crearUsuario);
router.get('/usuarios/:userId/certificado-pertenencia', generarCertificadoPertenenciaUsuario);
router.get('/usuarios', verTodosUsuarios);
router.get('/usuarios-eliminados', verUsuariosEliminados);
router.post('/usuarios-eliminados/:archiveId/reintentar-correo', reenviarAvisoEliminacion);
router.get('/paz-y-salvo', verPazYSalvos);
router.post('/paz-y-salvo', generarPazYSalvo);
router.get('/paz-y-salvo/:certificateId/descargar', descargarPazYSalvo);
router.post('/paz-y-salvo/:certificateId/reintentar-correo', reenviarPazYSalvo);
router.get('/usuarios/:userId', verUsuario);
router.put('/usuarios/:userId', editarUsuario);
router.put('/usuarios/:userId/rol', cambiarRol);
router.put('/usuarios/:userId/estado', cambiarEstadoUsuario);
router.delete('/usuarios/:userId', eliminarUsuario);

module.exports = router;
