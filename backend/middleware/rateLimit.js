const rateLimit = require('express-rate-limit');

// Límite general para toda la API: protege ante abuso y bucles del cliente.
const limiteGeneral = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas peticiones. Intenta de nuevo más tarde.' },
});

// Límite estricto para autenticación: frena fuerza bruta en login,
// verificación de código y recuperación de contraseña.
const limiteAuth = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos. Espera unos minutos antes de volver a intentar.' },
});

module.exports = { limiteGeneral, limiteAuth };
