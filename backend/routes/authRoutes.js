const express = require('express');
const router = express.Router();

const {
  iniciarSesion,
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

// No hay auto-registro: las cuentas las crea el administrador con
// `scripts/crearUsuario.js`. Por eso no se expone ninguna ruta de registro.
router.post('/login', iniciarSesion);

// TODO: login con Google pendiente de reimplementar con Supabase
// (signInWithIdToken). El controlador anterior (controller/google.js)
// dependía de Mongoose y jsonwebtoken, que ya no forman parte del proyecto.

// Verificación de cuenta
router.post('/verificar', verificarCuenta);
router.post('/reenviar-codigo', reenviarCodigoVerificacion);

// Cambio de contraseña propia (requiere sesión activa; usado tras el primer
// login con una contraseña temporal generada por un administrador)
router.post('/cambiar-password', verificarToken, cambiarPasswordPropio);

// Recuperación de contraseña
router.post('/solicitar-recuperacion', solicitarRecuperacion);
router.post('/resetear-password', resetearPassword);

module.exports = router;

