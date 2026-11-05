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
  // también administradores y fontaneros.
  return supabaseAdmin.from(TABLE).select('id, nombre, correo').eq('activo', true);
}

// Perfiles activos de una zona (o de todo el acueducto si zona es null), para
// avisar de un corte programado.
function listActiveByZone(zona) {
  let query = supabaseAdmin.from(TABLE).select('id, nombre, correo').eq('activo', true);
  if (zona) query = query.eq('zona', zona);
  return query;
}

// Zonas registradas (sin repetir), para los selectores del panel.
async function listZones() {
  const { data, error } = await supabaseAdmin.from(TABLE).select('zona').not('zona', 'is', null);
  if (error) return { data: null, error };
  const zonas = [...new Set((data || []).map((fila) => String(fila.zona).trim()).filter(Boolean))];
  return { data: zonas.sort((a, b) => a.localeCompare(b, 'es')), error: null };
}

// Destinatarios de un aviso general. Las cuentas desactivadas no pueden
// entrar a la app, así que no reciben avisos ni correos.
function listRegisteredUsersForNotifications() {
  return supabaseAdmin.from(TABLE).select('id, nombre, correo, rol').eq('activo', true);
}

function create(datos) {
  return supabaseAdmin.from(TABLE).insert(datos);
}

// Actualiza y devuelve el perfil con sus columnas públicas. `cambios` debe
// incluir `updated_at` si el llamador quiere sellar la hora del cambio (lo
// hace editarPerfil, para el límite mensual de autoedición; la edición hecha
// por un administrador no lo sella, así no consume el cupo del usuario).
//
// Toda escritura en un perfil invalida las sesiones en caché de esa persona
// (utils/cacheSesiones.js), para que un cambio de rol, estado o zona aplique
// desde la siguiente petición.
async function update(id, cambios, db = supabaseAdmin) {
  const resultado = await db.from(TABLE).update(cambios).eq('id', id).select(COLUMNAS_PERFIL_PUBLICO).single();
  cacheSesiones.invalidarUsuario(id);
  return resultado;
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

module.exports = {
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
  demotePlumbers,
};
