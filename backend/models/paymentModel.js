const supabaseAdmin = require('../config/supabaseAdminClient'); // Cliente admin (ignora RLS); es el que se usa por defecto
const { aplicarPaginacion } = require('../utils/paginacion');
const { crudBase } = require('./baseModel');

// Acceso a la tabla "payments". Devuelve { data, error } tal como lo entrega Supabase.
// Las funciones con `db` pueden usar el cliente del usuario (req.db, respeta RLS).

const TABLE = 'payments';

function listByProfile(profileId, db = supabaseAdmin) {
  return db.from(TABLE).select('*').eq('perfil_id', profileId).order('fecha_pago', { ascending: false });
}

// Listado general con filtros opcionales { confirmado: 'true' | 'false', perfil_id } y paginación { limit, offset }.
function list({ confirmado, perfil_id, limit, offset } = {}) {
  let query = supabaseAdmin.from(TABLE).select('*').order('fecha_pago', { ascending: false });

  if (confirmado === 'true') query = query.eq('confirmado', true);
  if (confirmado === 'false') query = query.eq('confirmado', false);
  if (perfil_id) query = query.eq('perfil_id', perfil_id);

  return aplicarPaginacion(query, { limit, offset });
}

// Falla (error) si el pago no existe.
function getById(id, columns = '*') {
  return supabaseAdmin.from(TABLE).select(columns).eq('id', id).single();
}

// Igual que getById, pero si no existe devuelve data = null sin error.
function findById(id, columns = '*') {
  return supabaseAdmin.from(TABLE).select(columns).eq('id', id).maybeSingle();
}

// Pago aún sin confirmar de una factura (si lo hay): evita duplicados por doble clic.
function findPendingByInvoice(invoiceId, db = supabaseAdmin) {
  return db.from(TABLE).select('id').eq('factura_id', invoiceId).eq('confirmado', false).maybeSingle();
}

// Cuántos pagos tiene una factura.
function countByInvoice(invoiceId) {
  return supabaseAdmin.from(TABLE).select('*', { count: 'exact', head: true }).eq('factura_id', invoiceId);
}

// Todo pago nuevo nace sin confirmar y con la fecha actual.
function create({ factura_id, perfil_id, monto, metodo, referencia }, db = supabaseAdmin) {
  return db
    .from(TABLE)
    .insert({
      factura_id,
      perfil_id,
      monto,
      metodo,
      referencia: referencia || null,
      confirmado: false,
      fecha_pago: new Date().toISOString(),
    })
    .select()
    .single();
}

module.exports = {
  listByProfile,
  list,
  getById,
  findById,
  findPendingByInvoice,
  countByInvoice,
  create,
  ...crudBase(TABLE),
};
