const supabaseAdmin = require('../config/supabaseAdminClient'); // Cliente admin (ignora RLS)

// Acceso a la tabla "breakdown_audios" (audios de averías enviados a GOTA) y
// al cupo diario "audio_usage". Devuelve { data, error } tal como lo entrega
// Supabase. Solo el backend usa estas tablas: no tienen políticas RLS.

const TABLE = 'breakdown_audios';
const COLUMNAS_PUBLICAS = 'id, averia_id, duracion_s, transcripcion, creado_en, escuchado_en, expira_en, ruta_audio';

function create({ perfil_id, ruta_audio, content_type, duracion_s, transcripcion, expira_en }) {
  return supabaseAdmin
    .from(TABLE)
    .insert({ perfil_id, ruta_audio, content_type, duracion_s, transcripcion, expira_en })
    .select('id')
    .single();
}

// Vincula a la avería recién creada los audios del mismo perfil que todavía
// están sueltos y conservan su archivo.
function linkToBreakdown({ perfilId, audioIds, averiaId, expiraEn }) {
  return supabaseAdmin
    .from(TABLE)
    .update({ averia_id: averiaId, expira_en: expiraEn })
    .in('id', audioIds)
    .eq('perfil_id', perfilId)
    .is('averia_id', null)
    .not('ruta_audio', 'is', null)
    .select('id');
}

function listByBreakdowns(averiaIds) {
  return supabaseAdmin
    .from(TABLE)
    .select(COLUMNAS_PUBLICAS)
    .in('averia_id', averiaIds)
    .order('creado_en', { ascending: true });
}

function getForBreakdown(audioId, averiaId) {
  return supabaseAdmin
    .from(TABLE)
    .select(COLUMNAS_PUBLICAS)
    .eq('id', audioId)
    .eq('averia_id', averiaId)
    .maybeSingle();
}

function markListened(audioId, escuchadoEn) {
  return supabaseAdmin.from(TABLE).update({ escuchado_en: escuchadoEn }).eq('id', audioId).is('escuchado_en', null);
}

// Adelanta el vencimiento a `expiraEn` solo si hoy vence más tarde: nunca
// alarga la vida de un audio.
function shortenExpiry({ audioId, averiaId, expiraEn }) {
  let query = supabaseAdmin.from(TABLE).update({ expira_en: expiraEn });
  if (audioId) query = query.eq('id', audioId);
  if (averiaId) query = query.eq('averia_id', averiaId);
  return query.not('ruta_audio', 'is', null).gt('expira_en', expiraEn);
}

function listExpired(ahora, limit = 500) {
  return supabaseAdmin
    .from(TABLE)
    .select('id, ruta_audio')
    .not('ruta_audio', 'is', null)
    .lte('expira_en', ahora)
    .limit(limit);
}

// La transcripción se conserva: solo se suelta la ruta del archivo borrado.
function markDeleted(ids, borradoEn) {
  return supabaseAdmin.from(TABLE).update({ ruta_audio: null, borrado_en: borradoEn }).in('id', ids);
}

function consumeQuota({ perfilId, segundos, maxAudios, maxSegundosGlobales }) {
  return supabaseAdmin.rpc('consumir_cupo_audio', {
    p_perfil_id: perfilId,
    p_segundos: segundos,
    p_max_audios: maxAudios,
    p_max_segundos_globales: maxSegundosGlobales,
  });
}

// El cupo solo sirve para el límite del día; las filas viejas sobran.
function deleteUsageBefore(dia) {
  return supabaseAdmin.from('audio_usage').delete().lt('dia', dia);
}

module.exports = {
  create,
  linkToBreakdown,
  listByBreakdowns,
  getForBreakdown,
  markListened,
  shortenExpiry,
  listExpired,
  markDeleted,
  consumeQuota,
  deleteUsageBefore,
};
