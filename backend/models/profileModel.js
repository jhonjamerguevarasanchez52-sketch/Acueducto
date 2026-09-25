const supabaseAdmin = require('../config/supabaseAdminClient'); // Cliente admin (ignora RLS); es el que se usa por defecto
const { COLUMNAS_PERFIL_PUBLICO } = require('../utils/perfilCampos'); // Columnas del perfil seguras para exponer
const { aplicarPaginacion } = require('../utils/paginacion');

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
  return supabaseAdmin.from(TABLE).select('id, nombre, correo').eq('activo', true).eq('rol', 'usuario');
}

function create(datos) {
  return supabaseAdmin.from(TABLE).insert(datos);
}

// Actualiza y devuelve el perfil con sus columnas públicas.
function update(id, cambios, db = supabaseAdmin) {
  return db.from(TABLE).update(cambios).eq('id', id).select(COLUMNAS_PERFIL_PUBLICO).single();
}

// Actualiza sin devolver el registro (códigos de verificación, banderas internas...).
function saveFields(id, cambios) {
  return supabaseAdmin.from(TABLE).update(cambios).eq('id', id);
}

// El acueducto tiene un único fontanero: baja a "usuario" a quien lo sea, salvo `except`.
function demotePlumbers(except) {
  let query = supabaseAdmin.from(TABLE).update({ rol: 'usuario' }).eq('rol', 'fontanero');
  if (except) query = query.neq('id', except);
  return query;
}

module.exports = {
  getById,
  findByEmail,
  list,
  listActiveIds,
  listActiveForBilling,
  create,
  update,
  saveFields,
  demotePlumbers,
};
