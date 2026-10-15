const supabaseAdmin = require('../config/supabaseAdminClient'); // Cliente admin (ignora RLS); es el que se usa por defecto
const { aplicarPaginacion } = require('../utils/paginacion');
const { crudBase } = require('./baseModel');

// Acceso a la tabla "service_outages" (cortes de servicio). Devuelve { data, error } tal como lo entrega Supabase.
// Las funciones con `db` pueden usar el cliente del usuario (req.db, respeta RLS).

const TABLE = 'service_outages';

function listByProfile(profileId, db = supabaseAdmin) {
  return db.from(TABLE).select('*').eq('perfil_id', profileId).order('fecha_corte', { ascending: false });
}

// Corte activo de un perfil (si lo hay); sin corte devuelve data = null sin error.
function findActiveByProfile(profileId, { columns = '*', db = supabaseAdmin } = {}) {
  return db.from(TABLE).select(columns).eq('perfil_id', profileId).eq('estado', 'activo').maybeSingle();
}

// Listado general con filtros opcionales { estado, perfil_id } y paginación { limit, offset }.
function list({ estado, perfil_id, limit, offset } = {}) {
  let query = supabaseAdmin.from(TABLE).select('*').order('fecha_corte', { ascending: false });

  if (estado) query = query.eq('estado', estado);
  if (perfil_id) query = query.eq('perfil_id', perfil_id);

  return aplicarPaginacion(query, { limit, offset });
}

// Todo corte nuevo nace "activo" con la fecha actual.
// cortado_por: id del administrador que lo registra. origen: 'manual' por defecto.
function create({ perfil_id, motivo, factura_id, cortado_por, origen = 'manual' }) {
  return supabaseAdmin
    .from(TABLE)
    .insert({
      perfil_id,
      motivo,
      factura_id: factura_id || null,
      estado: 'activo',
      fecha_corte: new Date().toISOString(),
      cortado_por: cortado_por || null,
      origen,
    })
    .select()
    .single();
}

// Marca el corte como reconectado con la fecha actual.
// Solo afecta cortes que sigan activos: si ya estaba reconectado (o no existe)
// devuelve data = null sin error, y el controlador responde 404.
function reconnect(id, reconectado_por) {
  return supabaseAdmin
    .from(TABLE)
    .update({
      estado: 'reconectado',
      fecha_reconexion: new Date().toISOString(),
      reconectado_por: reconectado_por || null,
    })
    .eq('id', id)
    .eq('estado', 'activo')
    .select()
    .maybeSingle();
}

module.exports = { listByProfile, findActiveByProfile, list, create, reconnect, ...crudBase(TABLE) };