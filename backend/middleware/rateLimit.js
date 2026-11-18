const { rateLimit, ipKeyGenerator } = require('express-rate-limit');

const QUINCE_MINUTOS = 15 * 60 * 1000;

// En la vereda es común que muchas personas salgan a Internet con la misma IP
// pública del operador (CGNAT). Por eso los límites no pueden ser solo por IP:
// unos pocos usuarios agotarían el cupo de todos los demás.

function claveIp(req) {
  return ipKeyGenerator(req.ip || '');
}

function correoDelCuerpo(req) {
  const correo = req.body && typeof req.body.correo === 'string' ? req.body.correo : '';
  return correo.trim().toLowerCase().slice(0, 254);
}

// Límite general para toda la API: protege ante abuso y bucles del cliente.
// Es holgado porque una sola IP puede representar a muchos usuarios.
const limiteGeneral = rateLimit({
  windowMs: QUINCE_MINUTOS,
  limit: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas peticiones. Intenta de nuevo más tarde.' },
});

// Límite estricto de autenticación, por IP + correo: frena la fuerza bruta
// contra una cuenta sin bloquear a los vecinos que comparten la IP. El
// bloqueo persistente por correo (tabla auth_intentos) sigue actuando aparte.
const limiteAuth = rateLimit({
  windowMs: QUINCE_MINUTOS,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const correo = correoDelCuerpo(req);
    return correo ? `${claveIp(req)}|${correo}` : claveIp(req);
  },
  message: { error: 'Demasiados intentos. Espera unos minutos antes de volver a intentar.' },
});

// Techo por IP para las rutas de autenticación: evita que alguien pruebe
// muchos correos distintos desde una misma conexión.
const limiteAuthIp = rateLimit({
  windowMs: QUINCE_MINUTOS,
  limit: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos desde esta conexión. Espera unos minutos antes de volver a intentar.' },
});

// Límite del chatbot: cada mensaje cuesta tokens de Groq. Con sesión se cuenta
// por usuario; sin sesión, por IP (con un cupo menor). Debe ir DESPUÉS de la
// autenticación (opcional u obligatoria) para conocer al usuario.
const limiteChat = rateLimit({
  windowMs: QUINCE_MINUTOS,
  limit: (req) => (req.usuario ? 30 : 20),
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req.usuario?.id ? `usuario:${req.usuario.id}` : `ip:${claveIp(req)}`),
  message: { error: 'Demasiados mensajes al asistente. Espera unos minutos antes de volver a intentar.' },
});

module.exports = { limiteGeneral, limiteAuth, limiteAuthIp, limiteChat, correoDelCuerpo };
