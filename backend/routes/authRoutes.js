const express = require('express');
const router = express.Router();
const {
  iniciarSesion,
  verificarCuenta,
  reenviarCodigoVerificacion,
  solicitarRecuperacion,
  resetearPassword,
} = require('../controller/authController');
const { limiteAuth } = require('../middleware/rateLimit');

// Todas las rutas de autenticación pasan por el límite estricto de intentos.
router.use(limiteAuth);

// No hay auto-registro: las cuentas las crea el administrador con
// `scripts/crearUsuario.js`. Por eso no se expone ninguna ruta de registro.
router.post('/login', iniciarSesion);

// Verificación de cuenta
router.post('/verificar', verificarCuenta);
router.post('/reenviar-codigo', reenviarCodigoVerificacion);

// Recuperación de contraseña
router.post('/solicitar-recuperacion', solicitarRecuperacion);
router.post('/resetear-password', resetearPassword);

module.exports = router;
