const supabaseAdmin = require('../config/supabaseAdminClient'); // Cliente admin (ignora RLS); es el que se usa por defecto
const { aplicarPaginacion } = require('../utils/paginacion');
const { crudBase } = require('./baseModel');

// Acceso a la tabla "breakdowns" (averías). Devuelve { data, error } tal como lo entrega Supabase.
// Las funciones con `db` pueden usar el cliente del usuario (req.db, respeta RLS).

const TABLE = 'breakdowns';

// Toda avería nueva nace "reportada" con la fecha actual.
function create({ perfil_id, descripcion, zona, direccion }, db = supabaseAdmin) {
  return db
    .from(TABLE)
    .insert({
      perfil_id,
      descripcion,
      zona: zona || null,
      direccion: direccion || null,
      estado: 'reportada',
      fecha_reporte: new Date().toISOString(),
    })
    .select()
    .single();
}

function listByProfile(profileId, db = supabaseAdmin) {
  return db.from(TABLE).select('*').eq('perfil_id', profileId).order('fecha_reporte', { ascending: false });
}

// Últimas averías de un perfil (contexto del chatbot).
function latestByProfile(profileId, limit = 3) {
  return supabaseAdmin
    .from(TABLE)
    .select('descripcion, estado, fecha_reporte')
    .eq('perfil_id', profileId)
    .order('fecha_reporte', { ascending: false })
    .limit(limit);
}

// Todas las averías, con filtro opcional { estado } y paginación { limit, offset }.
function list({ estado, limit, offset } = {}) {
  let query = supabaseAdmin.from(TABLE).select('*').order('fecha_reporte', { ascending: false });
  if (estado) query = query.eq('estado', estado);
  return aplicarPaginacion(query, { limit, offset });
}

module.exports = { create, listByProfile, latestByProfile, list, ...crudBase(TABLE) };
