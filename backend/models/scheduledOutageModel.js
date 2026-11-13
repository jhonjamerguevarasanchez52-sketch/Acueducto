const supabaseAdmin = require('../config/supabaseAdminClient');

// Acceso a la tabla "cortes_programados": suspensiones anunciadas por zona
// (mantenimientos, daños generales). zona = null significa todo el acueducto.
const TABLE = 'cortes_programados';
const COLUMNAS = 'id, zona, motivo, inicio, fin, cancelado, created_at';

// Misma normalización que profileModel.normalizarZona (sin requerirlo, para
// no acoplar los modelos): mayúsculas, tildes y espacios no cuentan.
function normalizarZona(zona) {
  return String(zona ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .trim().replace(/\s+/g, ' ').toLowerCase();
}

const MAX_CORTES_USUARIO = 10;

// Cortes que todavía no terminan, para el usuario: los de su zona y los
// generales. Con `zona` vacía solo ve los generales. La zona se compara
// normalizada ("Vereda Alta" = "vereda alta "), por eso se filtra aquí.
async function listUpcomingForZone(zona, ahoraIso) {
  const { data, error } = await supabaseAdmin
    .from(TABLE)
    .select(COLUMNAS)
    .eq('cancelado', false)
    .gte('fin', ahoraIso)
    .order('inicio', { ascending: true })
    .limit(200);
  if (error) return { data: null, error };
  const buscada = normalizarZona(zona);
  const cortes = (data || [])
    .filter((corte) => !corte.zona || (buscada && normalizarZona(corte.zona) === buscada))
    .slice(0, MAX_CORTES_USUARIO);
  return { data: cortes, error: null };
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
