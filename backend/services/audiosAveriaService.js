const { randomUUID } = require('crypto');
const { toFile } = require('groq-sdk');
const supabaseAdmin = require('../config/supabaseAdminClient');
const { obtenerGroq } = require('../config/groqClient');
const breakdownAudioModel = require('../models/breakdownAudioModel');
const { crearBucketPrivado } = require('../utils/bucketPrivado');

// Audios que los usuarios le envían a GOTA. El audio es temporal (Storage) y
// la transcripción es permanente (tabla breakdown_audios).

const BUCKET = 'breakdown-audios';
const HORA_MS = 60 * 60 * 1000;

// Límites pensados para no salir del plan gratuito de Groq (~28.800 s de
// audio al día para toda la organización): el tope global deja margen.
const LIMITES = {
  maxBytes: 2 * 1024 * 1024,
  maxSegundos: 60,
  audiosPorDia: 5,
  segundosGlobalesPorDia: 20000,
};

const PLAZOS_MS = {
  sinAveria: 2 * HORA_MS,
  conAveria: 15 * 24 * HORA_MS,
  trasEscucharOCerrar: 72 * HORA_MS,
};

const EXTENSIONES = {
  'audio/mp4': 'm4a',
  'audio/m4a': 'm4a',
  'audio/x-m4a': 'm4a',
  'audio/aac': 'm4a',
  'audio/mpeg': 'mp3',
  'audio/ogg': 'ogg',
  'audio/webm': 'webm',
  'audio/wav': 'wav',
};
const MIME_TYPES = Object.keys(EXTENSIONES);

// Vocabulario local para que Whisper no confunda nombres y términos del acueducto.
const PISTA_TRANSCRIPCION =
  'Reporte de avería al acueducto Campo Amor de Majo, Garzón, Huila: fuga, tubería, ' +
  'manguera, contador, llave de paso, baja presión, no llega el agua, fontanero.';

const asegurarBucketPrivado = crearBucketPrivado(BUCKET, {
  fileSizeLimit: LIMITES.maxBytes,
  allowedMimeTypes: MIME_TYPES,
});

const enMs = (ahora, ms) => new Date(ahora.getTime() + ms).toISOString();

// Reserva el audio en el cupo antes de pagar la transcripción.
// Devuelve 'ok', 'limite_usuario' o 'limite_global'.
async function consumirCupo(perfilId, segundos) {
  const { data, error } = await breakdownAudioModel.consumeQuota({
    perfilId,
    segundos,
    maxAudios: LIMITES.audiosPorDia,
    maxSegundosGlobales: LIMITES.segundosGlobalesPorDia,
  });
  if (error) throw error;
  return data;
}

// Devuelve null si GOTA no tiene Groq configurado.
async function transcribir(bytes, contentType) {
  const cliente = obtenerGroq();
  if (!cliente) return null;

  const archivo = await toFile(bytes, `audio.${EXTENSIONES[contentType]}`, { type: contentType });
  const resultado = await cliente.audio.transcriptions.create({
    file: archivo,
    model: 'whisper-large-v3-turbo',
    language: 'es',
    prompt: PISTA_TRANSCRIPCION,
    response_format: 'verbose_json',
    temperature: 0,
  });

  return {
    texto: (resultado.text || '').trim(),
    duracion: Number.isFinite(resultado.duration) ? Math.round(resultado.duration) : null,
  };
}

// Guarda el audio "suelto": si en 2 horas no se vincula a una avería, la
// limpieza lo borra.
async function guardarAudioPendiente({ perfilId, bytes, contentType, duracion, transcripcion, ahora = new Date() }) {
  await asegurarBucketPrivado();
  const ruta = `${perfilId}/${randomUUID()}.${EXTENSIONES[contentType]}`;
  const { error: errorSubida } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(ruta, bytes, { contentType, upsert: false });
  if (errorSubida) throw errorSubida;

  const { data, error } = await breakdownAudioModel.create({
    perfil_id: perfilId,
    ruta_audio: ruta,
    content_type: contentType,
    duracion_s: duracion,
    transcripcion,
    expira_en: enMs(ahora, PLAZOS_MS.sinAveria),
  });
  if (error) {
    await eliminarArchivos([ruta]);
    throw error;
  }
  return data.id;
}

async function vincularAudios({ perfilId, audioIds, averiaId, ahora = new Date() }) {
  if (!audioIds?.length) return 0;
  const { data, error } = await breakdownAudioModel.linkToBreakdown({
    perfilId,
    audioIds,
    averiaId,
    expiraEn: enMs(ahora, PLAZOS_MS.conAveria),
  });
  if (error) throw error;
  return data?.length || 0;
}

// Lo que ve el fontanero: nunca la ruta interna del archivo.
function aPublico(audio) {
  return {
    id: audio.id,
    duracion_s: audio.duracion_s,
    transcripcion: audio.transcripcion,
    disponible: Boolean(audio.ruta_audio),
    escuchado_en: audio.escuchado_en,
    expira_en: audio.ruta_audio ? audio.expira_en : null,
  };
}

// Map averia_id -> audios públicos de esa avería.
async function audiosDeAverias(averiaIds) {
  const porAveria = new Map();
  if (!averiaIds.length) return porAveria;
  const { data, error } = await breakdownAudioModel.listByBreakdowns(averiaIds);
  if (error) throw error;
  for (const audio of data || []) {
    if (!porAveria.has(audio.averia_id)) porAveria.set(audio.averia_id, []);
    porAveria.get(audio.averia_id).push(aPublico(audio));
  }
  return porAveria;
}

// Enlace temporal para reproducir. La primera escucha del fontanero inicia
// la cuenta de 72 horas para borrar el archivo.
async function crearUrlEscucha({ audioId, averiaId, marcarEscuchado, ahora = new Date() }) {
  const { data: audio, error } = await breakdownAudioModel.getForBreakdown(audioId, averiaId);
  if (error) throw error;
  if (!audio) return { estado: 'no_encontrado' };
  if (!audio.ruta_audio) return { estado: 'borrado', audio: aPublico(audio) };

  const { data: firmado, error: errorFirma } = await supabaseAdmin.storage
    .from(BUCKET)
    .createSignedUrl(audio.ruta_audio, 5 * 60);
  if (errorFirma) throw errorFirma;

  if (marcarEscuchado && !audio.escuchado_en) {
    const expiraEn = enMs(ahora, PLAZOS_MS.trasEscucharOCerrar);
    const marcado = await breakdownAudioModel.markListened(audio.id, ahora.toISOString());
    if (marcado.error) throw marcado.error;
    const acortado = await breakdownAudioModel.shortenExpiry({ audioId: audio.id, expiraEn });
    if (acortado.error) throw acortado.error;
    audio.escuchado_en = ahora.toISOString();
    if (new Date(audio.expira_en) > new Date(expiraEn)) audio.expira_en = expiraEn;
  }

  return { estado: 'ok', url: firmado.signedUrl, audio: aPublico(audio) };
}

// Al resolver o cancelar la avería, sus audios viven como máximo 72 horas más.
async function acortarPorCierre(averiaId, ahora = new Date()) {
  const { error } = await breakdownAudioModel.shortenExpiry({
    averiaId,
    expiraEn: enMs(ahora, PLAZOS_MS.trasEscucharOCerrar),
  });
  if (error) throw error;
}

async function eliminarArchivos(rutas) {
  const { error } = await supabaseAdmin.storage.from(BUCKET).remove(rutas);
  return error;
}

// Borra los archivos vencidos y conserva sus transcripciones. Pensada para
// correr cada hora; procesa por lotes para no exceder los límites de Storage.
async function limpiarAudiosVencidos(ahora = new Date()) {
  const resumen = { borrados: 0, errores: [] };

  for (;;) {
    const { data: vencidos, error } = await breakdownAudioModel.listExpired(ahora.toISOString());
    if (error) {
      resumen.errores.push(`consulta: ${error.message}`);
      break;
    }
    if (!vencidos?.length) break;

    const errorStorage = await eliminarArchivos(vencidos.map((audio) => audio.ruta_audio));
    if (errorStorage) {
      resumen.errores.push(`storage: ${errorStorage.message}`);
      break;
    }
    const { error: errorMarca } = await breakdownAudioModel.markDeleted(
      vencidos.map((audio) => audio.id),
      ahora.toISOString()
    );
    if (errorMarca) {
      resumen.errores.push(`marcar borrados: ${errorMarca.message}`);
      break;
    }
    resumen.borrados += vencidos.length;
    if (vencidos.length < 500) break;
  }

  const hace30Dias = new Date(ahora.getTime() - 30 * 24 * HORA_MS).toISOString().slice(0, 10);
  const { error: errorUso } = await breakdownAudioModel.deleteUsageBefore(hace30Dias);
  if (errorUso) resumen.errores.push(`cupos viejos: ${errorUso.message}`);

  return resumen;
}

module.exports = {
  BUCKET,
  LIMITES,
  PLAZOS_MS,
  MIME_TYPES,
  consumirCupo,
  transcribir,
  guardarAudioPendiente,
  vincularAudios,
  audiosDeAverias,
  crearUrlEscucha,
  acortarPorCierre,
  limpiarAudiosVencidos,
};
