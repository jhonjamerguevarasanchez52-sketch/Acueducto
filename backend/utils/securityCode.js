const crypto = require('crypto');

function generarCodigoSeguridad() {
  return crypto.randomInt(100000, 1000000).toString();
}

// Los códigos de 6 dígitos (acceso, verificación y recuperación) no se guardan
// en claro: se guarda un HMAC-SHA256 atado al perfil y firmado con un secreto
// que solo conoce el servidor. Si alguien llegara a leer la tabla profiles, no
// podría usar ni adivinar los códigos sin ese secreto (un hash simple de un
// número de 6 dígitos se rompe probando el millón de opciones).
const PREFIJO = 'h1:';

function secretoCodigos() {
  const secreto = process.env.CODIGOS_SECRET || process.env.SUPABASE_SERVICE_KEY;
  if (!secreto) throw new Error('Falta CODIGOS_SECRET (o SUPABASE_SERVICE_KEY) para proteger los códigos.');
  return secreto;
}

function protegerCodigo(perfilId, codigo) {
  const firma = crypto
    .createHmac('sha256', secretoCodigos())
    .update(`${perfilId}:${String(codigo).trim()}`)
    .digest('hex');
  return `${PREFIJO}${firma}`;
}

function iguales(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

// Compara el código que escribió la persona con el guardado. Acepta también
// los códigos en claro que existían antes de este cambio (duran 15 minutos),
// para no invalidar a quien pidió uno justo durante el despliegue.
function codigoCoincide(perfilId, guardado, recibido) {
  const texto = String(recibido ?? '').trim();
  if (!guardado || !/^\d{6}$/.test(texto)) return false;
  if (String(guardado).startsWith(PREFIJO)) {
    return iguales(guardado, protegerCodigo(perfilId, texto));
  }
  return iguales(guardado, texto);
}

module.exports = { generarCodigoSeguridad, protegerCodigo, codigoCoincide };
