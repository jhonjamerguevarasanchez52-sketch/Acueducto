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
const { limiteAuth } = require('../middleware/rateLimit');

// Todas las rutas de autenticación pasan por el límite estricto de intentos.
router.use(limiteAuth);

router.post('/registro', registrar);
router.post('/login', iniciarSesion);

// Verificación de cuenta
router.post('/verificar', verificarCuenta);
router.post('/reenviar-codigo', reenviarCodigoVerificacion);

// Recuperación de contraseña
router.post('/solicitar-recuperacion', solicitarRecuperacion);
router.post('/resetear-password', resetearPassword);

module.exports = router;
