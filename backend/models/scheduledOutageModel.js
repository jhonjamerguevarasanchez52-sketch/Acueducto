const supabaseAdmin = require('../config/supabaseAdminClient');

// Acceso a la tabla "cortes_programados": suspensiones anunciadas por zona
// (mantenimientos, daños generales). zona = null significa todo el acueducto.
const TABLE = 'cortes_programados';
const COLUMNAS = 'id, zona, motivo, inicio, fin, cancelado, created_at';

// Cortes que todavía no terminan, para el usuario: los de su zona y los
// generales. Con `zona` vacía solo ve los generales.
function listUpcomingForZone(zona, ahoraIso) {
  let query = supabaseAdmin
    .from(TABLE)
    .select(COLUMNAS)
    .eq('cancelado', false)
    .gte('fin', ahoraIso)
    .order('inicio', { ascending: true })
    .limit(10);
  // Comillas dobles: PostgREST así acepta zonas con espacios, puntos o comas.
  query = zona
    ? query.or(`zona.is.null,zona.eq."${String(zona).replace(/["\\]/g, '')}"`)
    : query.is('zona', null);
  return query;
}

function list({ incluirTerminados = false } = {}) {
  let query = supabaseAdmin.from(TABLE).select(COLUMNAS).order('inicio', { ascending: false }).limit(200);
  if (!incluirTerminados) query = query.gte('fin', new Date().toISOString());
  return query;
}

function create(datos) {
  return supabaseAdmin.from(TABLE).insert(datos).select(COLUMNAS).single();
}

function cancel(id) {
  return supabaseAdmin
    .from(TABLE)
    .update({ cancelado: true })
    .eq('id', id)
    .eq('cancelado', false)
    .select(COLUMNAS)
    .maybeSingle();
}

module.exports = { listUpcomingForZone, list, create, cancel };
