const supabaseAdmin = require('../config/supabaseAdminClient'); // Cliente admin (ignora RLS); es el que se usa por defecto
const { crudBase } = require('./baseModel');

// Acceso a la tabla "notifications". Devuelve { data, error } tal como lo entrega Supabase.
// Las funciones con `db` pueden usar el cliente del usuario (req.db, respeta RLS).

const TABLE = 'notifications';

// Toda notificación nace "no_leido" con la fecha actual.
function nuevaFila({ perfil_id, mensaje, tipo }) {
  return {
    perfil_id,
    mensaje,
    tipo: tipo || 'general',
    estado: 'no_leido',
    fecha: new Date().toISOString(),
  };
}

// Las operaciones de lectura/escritura propia requieren el cliente ligado al
// JWT del usuario. Así una llamada sin `db` no usa por accidente service-role.
function listByProfile(profileId, db) {
  return db.from(TABLE).select('*').eq('perfil_id', profileId).order('fecha', { ascending: false });
}

function countUnread(profileId, db) {
  return db
    .from(TABLE)
    .select('*', { count: 'exact', head: true })
    .eq('perfil_id', profileId)
    .eq('estado', 'no_leido');
}

// Marca una notificación como leída, solo si es del perfil indicado.
function markRead(id, profileId, db) {
  return db.from(TABLE).update({ estado: 'leido' }).eq('id', id).eq('perfil_id', profileId).select().single();
}

function markAllRead(profileId, db) {
  return db.from(TABLE).update({ estado: 'leido' }).eq('perfil_id', profileId).eq('estado', 'no_leido');
}

// Elimina una notificación, solo si es del perfil indicado.
function removeOwn(id, profileId, db = supabaseAdmin) {
  return db.from(TABLE).delete().eq('id', id).eq('perfil_id', profileId).select().single();
}

// Crea una notificación y la devuelve.
function create(datos) {
  return supabaseAdmin.from(TABLE).insert(nuevaFila(datos)).select().single();
}

// Crea una notificación sin devolver la fila (avisos internos que no la necesitan).
function insert(datos) {
  return supabaseAdmin.from(TABLE).insert(nuevaFila(datos));
}

// Una notificación por cada perfil de la lista (envíos masivos).
function createMany(profileIds, { mensaje, tipo }) {
  const filas = profileIds.map((perfil_id) => nuevaFila({ perfil_id, mensaje, tipo }));
  return supabaseAdmin.from(TABLE).insert(filas);
}

module.exports = {
  listByProfile,
  countUnread,
  markRead,
  markAllRead,
  removeOwn,
  create,
  insert,
  createMany,
  ...crudBase(TABLE),
};
