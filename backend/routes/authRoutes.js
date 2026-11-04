const express = require('express');
const router = express.Router();
const {
  iniciarSesion,
  solicitarCodigoAcceso,
  ingresarConCodigo,
  renovarSesion,
  verificarCuenta,
  reenviarCodigoVerificacion,
  cambiarPasswordPropio,
  solicitarRecuperacion,
  resetearPassword,
} = require('../controller/authController');
const { limiteAuth } = require('../middleware/rateLimit');
const { verificarToken } = require('../middleware/authMiddleware');

// Todas las rutas de autenticación pasan por el límite estricto de intentos.
router.use(limiteAuth);

// No hay auto-registro: las cuentas las crea el administrador desde el panel.
router.post('/login', iniciarSesion);
router.post('/renovar-sesion', renovarSesion);

// Ingreso sin contraseña: código de 6 dígitos enviado al correo.
router.post('/codigo-acceso', solicitarCodigoAcceso);
router.post('/ingresar-con-codigo', ingresarConCodigo);

// Verificación de cuenta (solo para cuentas antiguas sin verificar).
router.post('/verificar', verificarCuenta);
router.post('/reenviar-codigo', reenviarCodigoVerificacion);

// Cambio de contraseña propia (requiere sesión activa; usado tras el primer
// login con una contraseña temporal generada por un administrador)
router.post('/cambiar-password', verificarToken, cambiarPasswordPropio);

// Recuperación de contraseña
router.post('/solicitar-recuperacion', solicitarRecuperacion);
router.post('/resetear-password', resetearPassword);

module.exports = router;
