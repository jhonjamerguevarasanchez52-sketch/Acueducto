const supabaseAdmin = require('../config/supabaseAdminClient'); // Cliente admin (ignora RLS); es el que se usa por defecto
const { COLUMNAS_PERFIL_PUBLICO } = require('../utils/perfilCampos'); // Columnas del perfil seguras para exponer
const { aplicarPaginacion } = require('../utils/paginacion');
const cacheSesiones = require('../utils/cacheSesiones');

// Acceso a la tabla "profiles". Todas las funciones devuelven { data, error } tal como
// lo entrega Supabase; el controller decide qué responder.
// Las que reciben `db` pueden ejecutarse con el cliente del usuario (req.db, respeta RLS).

const TABLE = 'profiles';

// Un perfil por id. Por defecto devuelve solo las columnas públicas.
function getById(id, { columns = COLUMNAS_PERFIL_PUBLICO, db = supabaseAdmin } = {}) {
  return db.from(TABLE).select(columns).eq('id', id).single();
}

// Un perfil por correo (el correo ya debe venir normalizado).
function findByEmail(correo, columns) {
  return supabaseAdmin.from(TABLE).select(columns).eq('correo', correo).single();
}

// Listado con filtros opcionales { rol, activo: 'true' | 'false' } y paginación { limit, offset }.
function list({ rol, activo, limit, offset } = {}) {
  let query = supabaseAdmin.from(TABLE).select(COLUMNAS_PERFIL_PUBLICO).order('created_at', { ascending: false });

  if (rol) query = query.eq('rol', rol);
  if (activo === 'true') query = query.eq('activo', true);
  if (activo === 'false') query = query.eq('activo', false);

  return aplicarPaginacion(query, { limit, offset });
}

// Ids de todos los perfiles activos (para notificaciones masivas).
function listActiveIds() {
  return supabaseAdmin.from(TABLE).select('id').eq('activo', true);
}

function listActiveForBilling() {
  // La facturación mensual y su correo incluyen a todos los perfiles activos,
  // también administradores y fontaneros. created_at permite no facturar un
  // mes a quien se afilió después de que ese mes terminó.
  return supabaseAdmin.from(TABLE).select('id, nombre, correo, created_at').eq('activo', true);
}

// "  Vereda  Alta " y "vereda alta" son la misma zona: así se escribió a mano
// en distintos momentos (panel, importación de usuarios, la app).
function normalizarZona(zona) {
  return String(zona ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .trim().replace(/\s+/g, ' ').toLowerCase();
}

// Perfiles activos de una zona (o de todo el acueducto si zona es null), para
// avisar de un corte programado. La zona se compara normalizada.
async function listActiveByZone(zona) {
  if (!zona) return supabaseAdmin.from(TABLE).select('id, nombre, correo').eq('activo', true);
  const { data, error } = await supabaseAdmin
    .from(TABLE)
    .select('id, nombre, correo, zona')
    .eq('activo', true)
    .not('zona', 'is', null);
  if (error) return { data: null, error };
  const buscada = normalizarZona(zona);
  const perfiles = (data || [])
    .filter((perfil) => normalizarZona(perfil.zona) === buscada)
    .map(({ id, nombre, correo }) => ({ id, nombre, correo }));
  return { data: perfiles, error: null };
}

// Zonas registradas (sin repetir, aunque difieran en mayúsculas o espacios),
// para los selectores del panel.
async function listZones() {
  const { data, error } = await supabaseAdmin.from(TABLE).select('zona').not('zona', 'is', null);
  if (error) return { data: null, error };
  const porClave = new Map();
  for (const fila of data || []) {
    const texto = String(fila.zona).trim().replace(/\s+/g, ' ');
    const clave = normalizarZona(texto);
    if (clave && !porClave.has(clave)) porClave.set(clave, texto);
  }
  return { data: [...porClave.values()].sort((a, b) => a.localeCompare(b, 'es')), error: null };
}

// Destinatarios de un aviso general. Las cuentas desactivadas no pueden
// entrar a la app, así que no reciben avisos ni correos.
function listRegisteredUsersForNotifications() {
  return supabaseAdmin.from(TABLE).select('id, nombre, correo, rol').eq('activo', true);
}

function create(datos) {
  return supabaseAdmin.from(TABLE).insert(datos);
}

// Actualiza y devuelve el perfil con sus columnas públicas. La hora de la
// última autoedición (updated_at) la sella el trigger de la base de datos
// sellar_edicion_perfil_propio cuando el cambio lo hace el propio usuario.
//
// Toda escritura en un perfil invalida las sesiones en caché de esa persona
// (utils/cacheSesiones.js), para que un cambio de rol, estado o zona aplique
// desde la siguiente petición.
async function update(id, cambios, db = supabaseAdmin) {
  const resultado = await db.from(TABLE).update(cambios).eq('id', id).select(COLUMNAS_PERFIL_PUBLICO).single();
  cacheSesiones.invalidarUsuario(id);
  return resultado;
}

// Borra un código de un solo uso SOLO si sigue siendo el mismo que se validó.
// Si dos peticiones llegan a la vez con el mismo código, solo una lo consume.
// `campos` = { columna del código, columna de su expiración }.
// Devuelve { consumido: boolean, error }.
async function consumeCode(id, { columna, columnaExpiracion }, valorGuardado) {
  const { data, error } = await supabaseAdmin
    .from(TABLE)
    .update({ [columna]: null, [columnaExpiracion]: null })
    .eq('id', id)
    .eq(columna, valorGuardado)
    .select('id');
  cacheSesiones.invalidarUsuario(id);
  return { consumido: !error && Array.isArray(data) && data.length > 0, error };
}

// Actualiza sin devolver el registro (códigos de verificación, banderas internas...).
async function saveFields(id, cambios) {
  const resultado = await supabaseAdmin.from(TABLE).update(cambios).eq('id', id);
  cacheSesiones.invalidarUsuario(id);
  return resultado;
}

// El acueducto tiene un único fontanero: baja a "usuario" a quien lo sea, salvo `except`.
async function demotePlumbers(except) {
  let query = supabaseAdmin.from(TABLE).update({ rol: 'usuario' }).eq('rol', 'fontanero');
  if (except) query = query.neq('id', except);
  const resultado = await query;
  // No se sabe de antemano a quién se degradó: se vacía todo el caché.
  cacheSesiones.limpiar();
  return resultado;
}

// Asigna el único fontanero del acueducto en una sola transacción (función SQL
// asignar_fontanero, migración 20261110): el anterior baja a "usuario" y el
// nuevo sube a la vez, así nunca queda el acueducto sin fontanero por un fallo
// a mitad. Devuelve { data: perfil | null, error }.
async function assignPlumber(id) {
  const { data, error } = await supabaseAdmin.rpc('asignar_fontanero', { p_perfil_id: id });
  cacheSesiones.limpiar();
  if (error && ['PGRST202', '42883'].includes(error.code)) {
    // Base de datos sin la migración 20261110: se hace en dos pasos.
    console.warn('[perfiles] falta la función asignar_fontanero; aplica la migración 20261110.');
    const { data: destino, error: errorDestino } = await getById(id, { columns: 'id' });
    if (errorDestino || !destino) return { data: null, error: null };
    const { error: errorDegradacion } = await demotePlumbers(id);
    if (errorDegradacion) return { data: null, error: errorDegradacion };
    return update(id, { rol: 'fontanero' });
  }
  if (error) return { data: null, error };
  const perfil = Array.isArray(data) ? data[0] : data;
  if (!perfil) return { data: null, error: null };
  // La función devuelve la fila completa (con los códigos de un solo uso):
  // se responde solo con las columnas públicas.
  const publico = Object.fromEntries(
    COLUMNAS_PERFIL_PUBLICO.split(',').map((c) => c.trim()).map((c) => [c, perfil[c] ?? null]),
  );
  return { data: publico, error: null };
}

module.exports = {
  normalizarZona,
  assignPlumber,
  getById,
  findByEmail,
  list,
  listActiveIds,
  listActiveForBilling,
  listActiveByZone,
  listZones,
  listRegisteredUsersForNotifications,
  create,
  update,
  saveFields,
  consumeCode,
  demotePlumbers,
};
