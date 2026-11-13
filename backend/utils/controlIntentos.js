/**
 * Control de intentos fallidos para login y códigos de un solo uso
 * (verificación, recuperación de contraseña, ingreso con código).
 *
 * Los códigos son de 6 dígitos: sin un tope de intentos, un atacante podría
 * probarlos todos dentro de la ventana de validez. Aquí bloqueamos una
 * combinación (acción + correo) tras varios fallos seguidos.
 *
 * El estado se guarda en la tabla `auth_intentos` (migración
 * 20261030_mejoras_integrales.sql), así que sobrevive a los reinicios y
 * redeploys de Render. Si la base de datos no responde, se usa un almacén en
 * memoria para no dejar a nadie sin poder entrar por un fallo de red.
 */

const MAX_INTENTOS = 5;
const BLOQUEO_MS = 15 * 60 * 1000; // 15 minutos

function clave(accion, correo) {
  return `${accion}:${String(correo).toLowerCase().trim()}`;
}

function crearAlmacenMemoria() {
  const registro = new Map(); // clave -> { intentos, bloqueadoHasta }
  return {
    async bloqueadoHasta(k) {
      return registro.get(k)?.bloqueadoHasta || null;
    },
    async fallo(k) {
      const entrada = registro.get(k) || { intentos: 0, bloqueadoHasta: 0 };
      if (entrada.bloqueadoHasta && entrada.bloqueadoHasta <= Date.now()) {
        entrada.intentos = 0;
        entrada.bloqueadoHasta = 0;
      }
      entrada.intentos += 1;
      if (entrada.intentos >= MAX_INTENTOS) {
        entrada.bloqueadoHasta = Date.now() + BLOQUEO_MS;
        entrada.intentos = 0;
      }
      registro.set(k, entrada);
    },
    async limpiar(k) {
      registro.delete(k);
    },
  };
}

function crearAlmacenBaseDatos() {
  // Requerido de forma perezosa para que las pruebas que usan memoria no
  // necesiten credenciales de Supabase.
  const db = () => require('../config/supabaseAdminClient');
  return {
    async bloqueadoHasta(k) {
      const { data, error } = await db()
        .from('auth_intentos')
        .select('bloqueado_hasta')
        .eq('clave', k)
        .maybeSingle();
      if (error) throw error;
      return data?.bloqueado_hasta ? new Date(data.bloqueado_hasta).getTime() : null;
    },
    async fallo(k) {
      const { error } = await db().rpc('registrar_intento_fallido', {
        p_clave: k,
        p_max: MAX_INTENTOS,
        p_bloqueo_segundos: BLOQUEO_MS / 1000,
      });
      if (error) throw error;
    },
    async limpiar(k) {
      const { error } = await db().from('auth_intentos').delete().eq('clave', k);
      if (error) throw error;
    },
  };
}

const respaldo = crearAlmacenMemoria();
let almacen = crearAlmacenBaseDatos();

// Permite a las pruebas usar un almacén en memoria aislado.
function usarAlmacen(nuevo) {
  almacen = nuevo;
}

async function conRespaldo(operacion, k) {
  try {
    return await almacen[operacion](k);
  } catch (err) {
    console.error(`[intentos] base de datos no disponible (${operacion}); se usa memoria:`, err.message);
    return respaldo[operacion](k);
  }
}

/** Devuelve null si puede continuar, o los segundos que faltan si está bloqueado. */
async function segundosDeBloqueo(accion, correo) {
  const hasta = await conRespaldo('bloqueadoHasta', clave(accion, correo));
  if (!hasta) return null;
  const restanteMs = hasta - Date.now();
  return restanteMs > 0 ? Math.ceil(restanteMs / 1000) : null;
}

async function registrarFallo(accion, correo) {
  await conRespaldo('fallo', clave(accion, correo));
}

async function registrarExito(accion, correo) {
  await conRespaldo('limpiar', clave(accion, correo));
}

module.exports = {
  segundosDeBloqueo,
  registrarFallo,
  registrarExito,
  usarAlmacen,
  crearAlmacenMemoria,
  MAX_INTENTOS,
};
