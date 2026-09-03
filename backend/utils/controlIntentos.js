/**
 * Control de intentos en memoria para códigos de un solo uso (verificación
 * de cuenta y recuperación de contraseña).
 *
 * Los códigos son de 6 dígitos: sin un tope de intentos, un atacante podría
 * probarlos todos dentro de la ventana de validez. Aquí bloqueamos una
 * combinación (acción + correo) tras varios fallos seguidos.
 *
 * Nota: el estado vive en memoria del proceso. Con una sola instancia (el
 * despliegue previsto en Railway) es suficiente; si algún día se escala a
 * varias instancias, esto debería moverse a la base de datos o a Redis.
 */
const MAX_INTENTOS = 5;
const BLOQUEO_MS = 15 * 60 * 1000; // 15 minutos

const registro = new Map(); // clave -> { intentos, bloqueadoHasta }

function clave(accion, correo) {
  return `${accion}:${String(correo).toLowerCase().trim()}`;
}

/** Lanza null si puede continuar, o devuelve los segundos que faltan si está bloqueado. */
function segundosDeBloqueo(accion, correo) {
  const entrada = registro.get(clave(accion, correo));
  if (!entrada || !entrada.bloqueadoHasta) return null;
  const restanteMs = entrada.bloqueadoHasta - Date.now();
  if (restanteMs <= 0) {
    registro.delete(clave(accion, correo));
    return null;
  }
  return Math.ceil(restanteMs / 1000);
}

function registrarFallo(accion, correo) {
  const k = clave(accion, correo);
  const entrada = registro.get(k) || { intentos: 0, bloqueadoHasta: 0 };
  entrada.intentos += 1;
  if (entrada.intentos >= MAX_INTENTOS) {
    entrada.bloqueadoHasta = Date.now() + BLOQUEO_MS;
    entrada.intentos = 0;
  }
  registro.set(k, entrada);
}

function registrarExito(accion, correo) {
  registro.delete(clave(accion, correo));
}

module.exports = { segundosDeBloqueo, registrarFallo, registrarExito, MAX_INTENTOS };
