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
const { limiteAuth, limiteAuthIp } = require('../middleware/rateLimit');
const { verificarToken } = require('../middleware/authMiddleware');

// Renovar la sesión no adivina nada (el refresh token es largo y aleatorio) y
// la app y el panel lo hacen cada hora: queda fuera del límite estricto para
// no bloquear a todos los que comparten la IP. Sigue bajo el límite general.
router.post('/renovar-sesion', renovarSesion);

// El resto de rutas de autenticación pasan por el límite estricto de intentos
// (por IP + correo) y por un techo por IP.
router.use(limiteAuthIp, limiteAuth);

// No hay auto-registro: las cuentas las crea el administrador desde el panel.
router.post('/login', iniciarSesion);

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
