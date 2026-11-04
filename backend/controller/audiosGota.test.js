// Audios para GOTA: transcripción con cupo, confirmación explícita de la
// avería, escucha del fontanero y limpieza de archivos vencidos.
const test = require('node:test');
const assert = require('node:assert/strict');

const supabaseAdmin = require('../config/supabaseAdminClient');
const profileModel = require('../models/profileModel');
const breakdownModel = require('../models/breakdownModel');
const breakdownAudioModel = require('../models/breakdownAudioModel');
const audiosAveriaService = require('../services/audiosAveriaService');
const notificarAveria = require('../services/notificarAveria');
const { chatearConAsistente, transcribirAudio } = require('./chatbotController');
const { escucharAudio } = require('./averiaController');

const AUDIO_ID = '11111111-2222-4333-8444-555555555555';
const HORA_MS = 60 * 60 * 1000;

function respuesta() {
  return {
    statusCode: null, body: null,
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; return this; },
  };
}

// Reemplaza propiedades de un módulo durante una prueba y las restaura al final.
function simular(t, objeto, cambios) {
  const originales = {};
  for (const [clave, valor] of Object.entries(cambios)) {
    originales[clave] = objeto[clave];
    objeto[clave] = valor;
  }
  t.after(() => Object.assign(objeto, originales));
}

// `storage` es un getter de SupabaseClient: se sombrea en la instancia.
function simularStorage(t, bucket) {
  Object.defineProperty(supabaseAdmin, 'storage', {
    configurable: true,
    value: { from: () => bucket },
  });
  t.after(() => { delete supabaseAdmin.storage; });
}

function silenciar(t) {
  const original = console.error;
  console.error = () => {};
  t.after(() => { console.error = original; });
}

const reqAudio = (headers, body = Buffer.from('audio')) => ({
  usuario: { id: 'p1', rol: 'usuario' },
  headers: { 'content-type': 'audio/mp4', ...headers },
  body,
});

test('audio: rechaza cuerpo vacío y formatos que no son audio', async () => {
  let res = respuesta();
  await transcribirAudio(reqAudio({}, Buffer.alloc(0)), res);
  assert.equal(res.statusCode, 400);

  res = respuesta();
  await transcribirAudio(reqAudio({ 'content-type': 'image/png' }), res);
  assert.equal(res.statusCode, 415);
});

test('audio: sin cupo no se transcribe', async (t) => {
  let transcrito = false;
  simular(t, audiosAveriaService, {
    consumirCupo: async () => 'limite_usuario',
    transcribir: async () => { transcrito = true; return { texto: 'x', duracion: 3 }; },
  });

  const res = respuesta();
  await transcribirAudio(reqAudio({ 'x-audio-duracion': '8' }), res);
  assert.equal(res.statusCode, 429);
  assert.match(res.body.error, /5 audios/);
  assert.equal(transcrito, false, 'no se paga una transcripción fuera del cupo');
});

test('audio: reserva el cupo con la duración declarada acotada a 60 s y devuelve el texto', async (t) => {
  const reservas = [];
  let guardado;
  simular(t, audiosAveriaService, {
    consumirCupo: async (perfilId, segundos) => { reservas.push([perfilId, segundos]); return 'ok'; },
    transcribir: async () => ({ texto: '  Se rompió el tubo frente a la escuela  ', duracion: 7 }),
    guardarAudioPendiente: async (datos) => { guardado = datos; return AUDIO_ID; },
  });

  let res = respuesta();
  await transcribirAudio(reqAudio({ 'x-audio-duracion': '600' }), res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { transcripcion: 'Se rompió el tubo frente a la escuela', audioId: AUDIO_ID });
  assert.equal(guardado.duracion, 7, 'se guarda la duración real de Whisper');

  res = respuesta();
  await transcribirAudio(reqAudio({}), res);
  assert.deepEqual(reservas, [['p1', 60], ['p1', 60]], 'sin header se reserva el máximo');
});

test('audio: si guardar el archivo falla, el usuario igual recibe su texto', async (t) => {
  silenciar(t);
  simular(t, audiosAveriaService, {
    consumirCupo: async () => 'ok',
    transcribir: async () => ({ texto: 'No llega el agua', duracion: 4 }),
    guardarAudioPendiente: async () => { throw new Error('storage caído'); },
  });

  const res = respuesta();
  await transcribirAudio(reqAudio({ 'x-audio-duracion': '4' }), res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { transcripcion: 'No llega el agua', audioId: null });
});

test('audio: un audio sin palabras se rechaza con un mensaje claro', async (t) => {
  simular(t, audiosAveriaService, {
    consumirCupo: async () => 'ok',
    transcribir: async () => ({ texto: ' ', duracion: 2 }),
  });
  const res = respuesta();
  await transcribirAudio(reqAudio({ 'x-audio-duracion': '2' }), res);
  assert.equal(res.statusCode, 422);
});

test('chat: pedir el registro no crea la avería, devuelve la acción de confirmar', async (t) => {
  let creadas = 0;
  simular(t, breakdownModel, { create: async () => { creadas += 1; return { data: {} }; } });

  const res = respuesta();
  await chatearConAsistente({
    usuario: { id: 'p1' },
    body: {
      mensaje: 'Reporta la avería por favor',
      historial: [{ role: 'user', content: 'Hay una fuga grande en la tubería del patio' }],
    },
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(creadas, 0);
  assert.deepEqual(res.body.accion, {
    tipo: 'confirmar_averia',
    descripcion: 'Hay una fuga grande en la tubería del patio',
  });
});

test('chat: un "sí" suelto ya no registra averías', async (t) => {
  let creadas = 0;
  simular(t, breakdownModel, { create: async () => { creadas += 1; return { data: {} }; } });
  const groqKey = process.env.GROQ_API_KEY;
  delete process.env.GROQ_API_KEY;
  t.after(() => { if (groqKey !== undefined) process.env.GROQ_API_KEY = groqKey; });

  const res = respuesta();
  await chatearConAsistente({
    usuario: { id: 'p1' },
    body: {
      mensaje: 'sí',
      historial: [
        { role: 'user', content: 'Hay una fuga en la calle' },
        { role: 'assistant', content: '¿Quieres que la registre y avise al fontanero?' },
      ],
    },
  }, res);

  assert.equal(creadas, 0);
  assert.equal(res.statusCode, 503, 'sin Groq solo puede responder que no está disponible');
});

test('chat: confirmar crea la avería con la descripción vista y vincula los audios', async (t) => {
  let creada;
  let vinculo;
  simular(t, profileModel, {
    getById: async () => ({ data: { activo: true, zona: 'Centro', direccion: 'Calle 1' } }),
  });
  simular(t, breakdownModel, {
    latestByProfile: async () => ({ data: [] }),
    create: async (datos) => { creada = datos; return { data: { id: 'a1', estado: 'reportada', ...datos } }; },
  });
  simular(t, audiosAveriaService, { vincularAudios: async (datos) => { vinculo = datos; return 1; } });
  const avisos = [];
  simular(t, notificarAveria, { notificarNuevaAveria: async (averia) => { avisos.push(averia.id); } });
  t.after(() => assert.deepEqual(avisos, ['a1'], 'el aviso al fontanero va por el doble, nunca por el real'));

  const res = respuesta();
  await chatearConAsistente({
    usuario: { id: 'p1' },
    body: {
      confirmarAveria: true,
      descripcion: '  Fuga frente a la escuela  ',
      audioIds: [AUDIO_ID, AUDIO_ID, 'no-es-uuid', 5],
    },
  }, res);

  assert.equal(res.statusCode, 201);
  assert.equal(creada.descripcion, 'Fuga frente a la escuela');
  assert.equal(creada.perfil_id, 'p1');
  assert.deepEqual(vinculo, { perfilId: 'p1', audioIds: [AUDIO_ID], averiaId: 'a1' });
});

test('chat: confirmar sin sesión o con descripción muy corta no registra', async () => {
  let res = respuesta();
  await chatearConAsistente({ body: { confirmarAveria: true, descripcion: 'Fuga en la calle' } }, res);
  assert.equal(res.statusCode, 401);

  res = respuesta();
  await chatearConAsistente({ usuario: { id: 'p1' }, body: { confirmarAveria: true, descripcion: 'fuga' } }, res);
  assert.equal(res.statusCode, 400);
});

test('escucha: solo el fontanero inicia la cuenta de 72 horas', async (t) => {
  const ahora = new Date('2026-10-29T12:00:00Z');
  const audio = {
    id: AUDIO_ID, averia_id: 'a1', duracion_s: 9, transcripcion: 'Fuga', creado_en: ahora.toISOString(),
    escuchado_en: null, expira_en: new Date(ahora.getTime() + 15 * 24 * HORA_MS).toISOString(), ruta_audio: 'p1/x.m4a',
  };
  const marcados = [];
  const acortados = [];
  simular(t, breakdownAudioModel, {
    getForBreakdown: async () => ({ data: { ...audio } }),
    markListened: async (id) => { marcados.push(id); return {}; },
    shortenExpiry: async (datos) => { acortados.push(datos); return {}; },
  });
  simularStorage(t, { createSignedUrl: async () => ({ data: { signedUrl: 'https://firmado' } }) });

  const admin = await audiosAveriaService.crearUrlEscucha({ audioId: AUDIO_ID, averiaId: 'a1', marcarEscuchado: false, ahora });
  assert.equal(admin.url, 'https://firmado');
  assert.equal(marcados.length, 0);

  const fontanero = await audiosAveriaService.crearUrlEscucha({ audioId: AUDIO_ID, averiaId: 'a1', marcarEscuchado: true, ahora });
  assert.deepEqual(marcados, [AUDIO_ID]);
  assert.equal(acortados[0].expiraEn, '2026-11-01T12:00:00.000Z');
  assert.equal(fontanero.audio.expira_en, '2026-11-01T12:00:00.000Z');
  assert.equal(fontanero.audio.ruta_audio, undefined, 'no expone la ruta interna');
});

test('escucha: audio borrado responde 410 y conserva la transcripción', async (t) => {
  simular(t, audiosAveriaService, {
    crearUrlEscucha: async () => ({ estado: 'borrado', audio: { id: AUDIO_ID, transcripcion: 'Fuga', disponible: false } }),
  });
  const res = respuesta();
  await escucharAudio({ params: { id: 'a1', audioId: AUDIO_ID }, usuario: { rol: 'fontanero' } }, res);
  assert.equal(res.statusCode, 410);
  assert.equal(res.body.audio.transcripcion, 'Fuga');
});

test('limpieza: borra los archivos vencidos y conserva las filas con su transcripción', async (t) => {
  const ahora = new Date('2026-10-29T12:00:00Z');
  let consultas = 0;
  let marcadosBorrados;
  let usoAntesDe;
  const removidos = [];
  simular(t, breakdownAudioModel, {
    listExpired: async () => {
      consultas += 1;
      return { data: consultas === 1 ? [{ id: 'x1', ruta_audio: 'p1/a.m4a' }, { id: 'x2', ruta_audio: 'p2/b.m4a' }] : [] };
    },
    markDeleted: async (ids, borradoEn) => { marcadosBorrados = { ids, borradoEn }; return {}; },
    deleteUsageBefore: async (dia) => { usoAntesDe = dia; return {}; },
  });
  simularStorage(t, { remove: async (rutas) => { removidos.push(...rutas); return {}; } });

  const resumen = await audiosAveriaService.limpiarAudiosVencidos(ahora);
  assert.deepEqual(resumen, { borrados: 2, errores: [] });
  assert.deepEqual(removidos, ['p1/a.m4a', 'p2/b.m4a']);
  assert.deepEqual(marcadosBorrados, { ids: ['x1', 'x2'], borradoEn: ahora.toISOString() });
  assert.equal(usoAntesDe, '2026-09-29');
});

test('limpieza: si Storage falla no marca las filas como borradas', async (t) => {
  let marcadas = false;
  simular(t, breakdownAudioModel, {
    listExpired: async () => ({ data: [{ id: 'x1', ruta_audio: 'p1/a.m4a' }] }),
    markDeleted: async () => { marcadas = true; return {}; },
    deleteUsageBefore: async () => ({}),
  });
  simularStorage(t, { remove: async () => ({ error: { message: 'caído' } }) });

  const resumen = await audiosAveriaService.limpiarAudiosVencidos();
  assert.equal(resumen.borrados, 0);
  assert.match(resumen.errores[0], /storage/);
  assert.equal(marcadas, false, 'la ruta se conserva para reintentar en la próxima hora');
});
