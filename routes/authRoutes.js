
const express = require('express');
const router = express.Router();
const {
  registrar,
  iniciarSesion,
  verificarCuenta,
  reenviarCodigoVerificacion,
  solicitarRecuperacion,
  resetearPassword,
} = require('../controller/authController');
 
router.post('/registro', registrar);
router.post('/login', iniciarSesion);
 
// Verificación de cuenta
router.post('/verificar', verificarCuenta);
router.post('/reenviar-codigo', reenviarCodigoVerificacion);
 
// Recuperación de contraseña
router.post('/solicitar-recuperacion', solicitarRecuperacion);
router.post('/resetear-password', resetearPassword);
 
module.exports = router;