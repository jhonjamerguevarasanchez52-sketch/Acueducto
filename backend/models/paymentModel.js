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
  if (confirmado === 'false') {
    query = query.eq('confirmado', false).or('estado_wompi.is.null,estado_wompi.neq.SUPERSEDED');
  }
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

// Wompi no avisa cuando el usuario cierra el checkout sin pagar. Un checkout
// sin transacción y con más de este tiempo se considera abandonado (la misma
// regla que la función SQL factura_tiene_pago_activo).
const MINUTOS_CHECKOUT_ABANDONADO = 30;

// Marca como reemplazados (SUPERSEDED) los checkouts de Wompi abandonados de
// una factura, para que no bloqueen un nuevo pago. La fila NO se borra: si el
// usuario termina pagando ese checkout más tarde, el webhook todavía la
// encuentra y el dinero queda registrado.
function supersedeAbandonedCheckouts(invoiceId, ahora = new Date()) {
  const limite = new Date(ahora.getTime() - MINUTOS_CHECKOUT_ABANDONADO * 60 * 1000).toISOString();
  return supabaseAdmin
    .from(TABLE)
    .update({ estado_wompi: 'SUPERSEDED' })
    .eq('factura_id', invoiceId)
    .eq('confirmado', false)
    .eq('metodo', 'wompi')
    .eq('estado_wompi', 'PENDING')
    .is('transaccion_id', null)
    .lt('fecha_pago', limite);
}

// Pago aún sin confirmar de una factura (si lo hay): evita duplicados por doble clic.
function findPendingByInvoice(invoiceId, db = supabaseAdmin) {
  return db
    .from(TABLE)
    .select('*')
    .eq('factura_id', invoiceId)
    .eq('confirmado', false)
    .or('estado_wompi.is.null,estado_wompi.in.(PENDING,APPROVED_NO_APLICADO,MONTO_INVALIDO)')
    .order('fecha_pago', { ascending: false })
    .limit(1)
    .maybeSingle();
}

// Cuántos pagos tiene una factura.
function countByInvoice(invoiceId) {
  return supabaseAdmin.from(TABLE).select('*', { count: 'exact', head: true }).eq('factura_id', invoiceId);
}

// true si la factura tiene un pago confirmado, manual o en curso en Wompi.
// Los intentos rechazados o reemplazados no cuentan (ver factura_tiene_pago_activo).
function hasActiveByInvoice(invoiceId) {
  return supabaseAdmin.rpc('factura_tiene_pago_activo', { p_factura_id: invoiceId });
}

// Todo pago nuevo nace sin confirmar y con la fecha actual.
function create({ factura_id, perfil_id, monto, cargo_wompi = 0, monto_total, metodo, referencia, estado_wompi }, db = supabaseAdmin) {
  return db
    .from(TABLE)
    .insert({
      factura_id,
      perfil_id,
      monto,
      cargo_wompi,
      monto_total: monto_total ?? Number(monto) + Number(cargo_wompi),
      metodo,
      referencia: referencia || null,
      confirmado: false,
      fecha_pago: new Date().toISOString(),
      estado_wompi: estado_wompi || null,
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
  supersedeAbandonedCheckouts,
  MINUTOS_CHECKOUT_ABANDONADO,
  countByInvoice,
  hasActiveByInvoice,
  create,
  ...crudBase(TABLE),
};
