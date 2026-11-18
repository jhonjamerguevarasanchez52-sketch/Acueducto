const crypto = require('crypto');

/**
 * Caché corto en memoria de sesiones ya validadas.
 *
 * Sin él, cada petición autenticada hace dos viajes a Supabase antes de
 * responder (validar el token en Auth y leer el perfil). Una pantalla de la
 * app dispara varias peticiones seguidas, así que esa latencia se multiplica.
 *
 * - La clave es el hash del token: el token en sí no se guarda.
 * - Cada entrada vive como máximo TTL_MS y nunca más allá del vencimiento
 *   del propio token (campo `exp` del JWT).
 * - Cuando un administrador cambia el rol, el estado o los datos de alguien,
 *   se llama a invalidarUsuario() para que el cambio aplique de inmediato.
 */
const TTL_MS = 30 * 1000;
const MAX_ENTRADAS = 1000;

const entradas = new Map();

function claveDe(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

// Lee `exp` del JWT sin verificar la firma: solo se usa para acortar la vida
// de la entrada, nunca para dar acceso (eso lo decide Supabase al validar).
function vencimientoToken(token) {
  try {
    const payload = JSON.parse(Buffer.from(String(token).split('.')[1], 'base64url').toString('utf8'));
    return Number.isFinite(payload.exp) ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

function obtener(token, ahora = Date.now()) {
  const clave = claveDe(token);
  const entrada = entradas.get(clave);
  if (!entrada) return null;
  if (entrada.expira <= ahora) {
    entradas.delete(clave);
    return null;
  }
  return entrada.valor;
}

function guardar(token, valor, ahora = Date.now()) {
  const vence = vencimientoToken(token);
  const expira = Math.min(ahora + TTL_MS, vence ?? Infinity);
  if (expira <= ahora) return;

  if (entradas.size >= MAX_ENTRADAS) {
    // Map conserva el orden de inserción: se descarta la entrada más antigua.
    entradas.delete(entradas.keys().next().value);
  }
  entradas.set(claveDe(token), { valor, expira, usuarioId: valor?.perfil?.id ?? null });
}

function invalidarUsuario(usuarioId) {
  if (!usuarioId) return;
  for (const [clave, entrada] of entradas) {
    if (entrada.usuarioId === usuarioId) entradas.delete(clave);
  }
}

function limpiar() {
  entradas.clear();
}

module.exports = { obtener, guardar, invalidarUsuario, limpiar, TTL_MS, MAX_ENTRADAS };
