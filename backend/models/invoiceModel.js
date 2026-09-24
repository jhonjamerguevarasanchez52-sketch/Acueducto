const supabaseAdmin = require('../config/supabaseAdminClient'); // Cliente admin (ignora RLS); es el que se usa por defecto
const { aplicarPaginacion } = require('../utils/paginacion');
const { crudBase } = require('./baseModel');

// Acceso a la tabla "invoices". Devuelve { data, error } tal como lo entrega Supabase.
// Las funciones con `db` pueden usar el cliente del usuario (req.db, respeta RLS).

const TABLE = 'invoices';

function listByProfile(profileId, db = supabaseAdmin) {
  return db.from(TABLE).select('*').eq('perfil_id', profileId).order('fecha_emision', { ascending: false });
}

// Una factura, solo si pertenece al perfil indicado.
function getOwn(id, profileId, { columns = '*', db = supabaseAdmin } = {}) {
  return db.from(TABLE).select(columns).eq('id', id).eq('perfil_id', profileId).single();
}

// Últimas facturas de un perfil (contexto del chatbot).
function latestByProfile(profileId, limit = 3) {
  return supabaseAdmin
    .from(TABLE)
    .select('periodo, valor_total, fecha_vencimiento, estado')
    .eq('perfil_id', profileId)
    .order('fecha_emision', { ascending: false })
    .limit(limit);
}

// Listado general con filtros opcionales { estado, perfil_id } y paginación { limit, offset }.
function list({ estado, perfil_id, limit, offset } = {}) {
  let query = supabaseAdmin.from(TABLE).select('*').order('fecha_emision', { ascending: false });

  if (estado) query = query.eq('estado', estado);
  if (perfil_id) query = query.eq('perfil_id', perfil_id);

  return aplicarPaginacion(query, { limit, offset });
}

// Toda factura nueva nace "pendiente" con la fecha de emisión actual.
function create({ perfil_id, periodo, valor_total, fecha_vencimiento, observacion }) {
  return supabaseAdmin
    .from(TABLE)
    .insert({
      perfil_id,
      periodo,
      valor_total,
      estado: 'pendiente',
      fecha_emision: new Date().toISOString(),
      fecha_vencimiento: fecha_vencimiento || null,
      observacion: observacion || null,
    })
    .select()
    .single();
}

module.exports = { listByProfile, getOwn, latestByProfile, list, create, ...crudBase(TABLE) };
