const supabaseAdmin = require('../config/supabaseAdminClient'); // Cliente admin (ignora RLS); es el que se usa por defecto
const { crudBase } = require('./baseModel');

// Acceso a la tabla "rates" (tarifas). Devuelve { data, error } tal como lo entrega Supabase.
// Las funciones con `db` pueden usar el cliente del usuario (req.db, respeta RLS).

const TABLE = 'rates';

function list(db = supabaseAdmin) {
  return db.from(TABLE).select('*').order('vigente_desde', { ascending: false });
}

// Solo las columnas que necesita el chatbot.
function listForChatbot() {
  return supabaseAdmin
    .from(TABLE)
    .select('tipo, cuota_fija, vigente_desde, vigente_hasta')
    .order('vigente_desde', { ascending: false });
}

// Tarifa residencial vigente en la fecha `today` (YYYY-MM-DD): ya empezó y no ha vencido.
function getCurrent(today, { columns = '*', db = supabaseAdmin } = {}) {
  return db
    .from(TABLE)
    .select(columns)
    .eq('tipo', 'residencial')
    .lte('vigente_desde', today)
    .or(`vigente_hasta.is.null,vigente_hasta.gte.${today}`)
    .order('vigente_desde', { ascending: false })
    .limit(1)
    .single();
}

function create({ tipo, cuota_fija, vigente_desde, vigente_hasta }) {
  return supabaseAdmin
    .from(TABLE)
    .insert({
      tipo: tipo || 'residencial',
      cuota_fija,
      vigente_desde,
      vigente_hasta: vigente_hasta || null,
    })
    .select()
    .single();
}

module.exports = { list, listForChatbot, getCurrent, create, ...crudBase(TABLE) };
