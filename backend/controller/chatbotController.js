const rateModel = require('../models/rateModel');
const profileModel = require('../models/profileModel');
const invoiceModel = require('../models/invoiceModel');
const breakdownModel = require('../models/breakdownModel');
const { errorInesperado } = require('../utils/httpErrores');
// Se llama por el módulo (no desestructurado) para que las pruebas puedan
// reemplazarlo y no avisen al fontanero real.
const notificarAveria = require('../services/notificarAveria');
const audiosAveriaService = require('../services/audiosAveriaService');
const { obtenerGroq } = require('../config/groqClient');
const {
  contieneLenguajeOfensivo,
  MENSAJE_LENGUAJE_OFENSIVO,
  RESPUESTA_LENGUAJE_OFENSIVO,
} = require('../utils/lenguajeOfensivo');
const { esFueraDeTema, MENSAJE_FUERA_DE_TEMA, REGLA_TEMA_PROMPT } = require('../utils/temaAcueducto');

// Un audio de 60 s transcrito ocupa unos 900 caracteres.
const MAX_MENSAJE = 1000;
const MAX_TURNOS_HISTORIAL = 8;

function normalizar(texto) {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

const MIN_DESCRIPCION = 10;

// El usuario pide explícitamente registrar o avisar ("reporta la fuga",
// "avisa al fontanero"). Ni así se registra directo: se le muestra la
// descripción con un botón de confirmación.
function pideRegistrar(mensaje) {
  const actual = normalizar(mensaje);
  return /\b(report(a|ar|ame)|registr(a|ar|alo)|mand(a|ar)|envi(a|ar)|avis(a|ar)|notific(a|ar))\b/.test(actual) &&
    /\b(averia|fuga|dano|fontanero|plomero|reporte)\b/.test(actual);
}

function armarDescripcionAveria(mensaje, historial) {
  const textosUsuario = [...historial.filter((turno) => turno.role === 'user').map((turno) => turno.content), mensaje];
  const detalles = textosUsuario
    .map((texto) => texto.trim())
    .filter((texto) => texto.length >= 8 && !/^\s*(si|sí|dale|listo|confirmo|hazlo|ok|okay)[.! ]*$/i.test(texto))
    .filter((texto) => !/^(por favor,? )?(reporta|registra|manda|env[ií]a|avisa)( la| al)? (aver[ií]a|fontanero)( por favor)?[.!, ]*$/i.test(texto));
  return [...new Set(detalles)].join('. ').slice(0, 1000);
}

// La app muestra "Sí, avisar al fontanero" y, al tocarlo, reenvía esta
// descripción con `confirmarAveria: true`.
function accionConfirmar(descripcion) {
  return { tipo: 'confirmar_averia', descripcion };
}

// Ids de audios enviados en esta conversación; se vinculan a la avería si se registra.
function idsDeAudio(valor) {
  if (!Array.isArray(valor)) return [];
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return [...new Set(valor.filter((id) => typeof id === 'string' && uuid.test(id)))].slice(0, 10);
}

// GOTA ofreció registrar la avería y avisar al fontanero.
function ofreceRegistrar(texto) {
  return /\b(registr|report|avis)\w*\b.*\bfontanero\b/.test(normalizar(texto));
}

// Solo se llega aquí desde el botón de confirmación de la app: perfilId sale
// del token y la descripción es la que el usuario vio y confirmó.
async function registrarAveriaConfirmada(req, res, perfilId, descripcionRecibida) {
  if (!perfilId) {
    return res.status(401).json({ respuesta: 'Inicia sesión para registrar la avería y avisar al fontanero.' });
  }
  // Mismas reglas que POST /api/averias: reportan los usuarios y el
  // administrador; el fontanero atiende las averías, no las reporta.
  const rol = req.usuario?.rol;
  if (rol === 'fontanero') {
    return res.status(403).json({ respuesta: 'Como fontanero no reportas averías por aquí: las ves y las atiendes en la sección Averías.' });
  }
  const descripcion = typeof descripcionRecibida === 'string' ? descripcionRecibida.trim().slice(0, 1000) : '';
  if (descripcion.length < MIN_DESCRIPCION) {
    return res.status(400).json({ respuesta: 'Cuéntame en una frase qué pasó (por ejemplo, dónde está la fuga o qué servicio falta) y la registro para avisar al fontanero.' });
  }
  if (contieneLenguajeOfensivo(descripcion)) {
    return res.status(400).json({ respuesta: MENSAJE_LENGUAJE_OFENSIVO });
  }

  const { data: perfil, error: errorPerfil } = await profileModel.getById(perfilId, {
    columns: 'nombre, apellido, zona, direccion, activo',
  });
  if (errorPerfil) throw errorPerfil;
  if (!perfil?.activo) {
    return res.status(403).json({ respuesta: 'Tu perfil no está activo. Contacta al administrador del acueducto.' });
  }
  if (!perfil.zona && !perfil.direccion) {
    // El administrador reporta averías de cualquier sitio: indica la
    // ubicación en el formulario de Averías, que la pide aparte.
    const respuesta = rol === 'administrador'
      ? 'Como administrador, registra la avería desde la sección Averías: ahí indicas la ubicación exacta del daño.'
      : 'Tu perfil no tiene una ubicación registrada. Pídele al administrador que actualice tu dirección para poder enviar la avería.';
    return res.status(200).json({ respuesta });
  }

  // Un doble toque en el botón no debe crear dos averías.
  const { data: recientes } = await breakdownModel.latestByProfile(perfilId, 1);
  const anterior = recientes?.[0];
  if (anterior && anterior.estado === 'reportada' &&
      normalizar(anterior.descripcion) === normalizar(descripcion) &&
      Date.now() - new Date(anterior.fecha_reporte).getTime() < 600000) {
    return res.status(200).json({ respuesta: 'Esta avería ya quedó registrada y el fontanero está siendo notificado.', averia: { estado: anterior.estado } });
  }

  // La app no tiene permiso de insertar averías, así que la escritura va por
  // el cliente de servicio (como en averiaController).
  const { data: averia, error } = await breakdownModel.create({
    perfil_id: perfilId,
    descripcion,
    zona: perfil.zona,
    direccion: perfil.direccion,
  });
  if (error) throw error;
  // La avería ya quedó guardada: si vincular el audio falla, el reporte
  // sigue siendo válido (la transcripción ya va en la descripción).
  try {
    await audiosAveriaService.vincularAudios({ perfilId, audioIds: idsDeAudio(req.body.audioIds), averiaId: averia.id });
  } catch (errorAudio) {
    console.error('[chat] no se pudo vincular el audio a la avería:', errorAudio.message);
  }
  void notificarAveria.notificarNuevaAveria(averia);
  return res.status(201).json({ respuesta: 'Avería registrada. Ya estoy avisando al fontanero.', averia: { id: averia.id, estado: averia.estado } });
}

async function chatearConAsistente(req, res) {
  try {
    const { mensaje, historial } = req.body;
    if (req.body.confirmarAveria === true) {
      return await registrarAveriaConfirmada(req, res, req.usuario?.id, req.body.descripcion);
    }
    if (typeof mensaje !== 'string' || !mensaje.trim()) {
      return res.status(400).json({ error: 'Debes enviar un mensaje válido.' });
    }

    const mensajeActual = mensaje.trim();
    if (mensajeActual.length > MAX_MENSAJE) {
      return res.status(400).json({ error: `El mensaje no puede superar ${MAX_MENSAJE} caracteres.` });
    }

    // Groserías y temas ajenos al acueducto se responden sin llamar a la IA.
    if (contieneLenguajeOfensivo(mensajeActual)) {
      return res.status(200).json({ respuesta: RESPUESTA_LENGUAJE_OFENSIVO });
    }
    if (esFueraDeTema(mensajeActual)) {
      return res.status(200).json({ respuesta: MENSAJE_FUERA_DE_TEMA, fueraDeTema: true });
    }

    const cliente = obtenerGroq();

    // Conservamos solo unos pocos turnos recientes y texto plano. Esto permite
    // entender referencias como "esa fuga" sin enviar conversaciones enormes.
    const mensajesPrevios = (Array.isArray(historial) ? historial : [])
      .slice(-MAX_TURNOS_HISTORIAL)
      .filter((turno) =>
        turno &&
        ['user', 'assistant'].includes(turno.role) &&
        typeof turno.content === 'string' &&
        turno.content.trim()
      )
      .map((turno) => ({
        role: turno.role,
        content: turno.content.trim().slice(0, MAX_MENSAJE),
      }));

    const perfilId = req.usuario?.id;

    // Pedir el registro explícitamente no necesita a Groq: se arma la
    // descripción con lo que el usuario ya dijo y se le pide confirmarla.
    if (pideRegistrar(mensajeActual)) {
      if (!perfilId) {
        return res.status(401).json({ respuesta: 'Inicia sesión para registrar la avería y avisar al fontanero.' });
      }
      const descripcion = armarDescripcionAveria(mensajeActual, mensajesPrevios);
      if (descripcion.length < MIN_DESCRIPCION) {
        return res.status(200).json({ respuesta: 'Cuéntame en una frase qué pasó (por ejemplo, dónde está la fuga o qué servicio falta) y la registro para avisar al fontanero.' });
      }
      return res.status(200).json({
        respuesta: `Voy a avisar al fontanero con esta descripción:\n"${descripcion}"\n¿La envío?`,
        accion: accionConfirmar(descripcion),
      });
    }

    if (!cliente) {
      return res.status(503).json({ error: 'El asistente virtual no está disponible por ahora.' });
    }

    // req.usuario lo pone authOpcional cuando la petición trae un token válido;
    // si es anónima, perfilId queda undefined y GOTA responde solo con la
    // información general del acueducto.

    // Estas consultas son independientes; ejecutarlas juntas reduce la espera
    // de red a la consulta más lenta en vez de sumar sus latencias.
    const [tarifasResult, perfilResult, facturasResult, averiasResult] = await Promise.all([
      rateModel.listForChatbot(),
      perfilId
        ? profileModel.getById(perfilId, {
          columns: 'nombre, apellido, numero_lote, zona, direccion, activo',
        })
        : Promise.resolve({ data: null }),
      perfilId ? invoiceModel.latestByProfile(perfilId, 3) : Promise.resolve({ data: [] }),
      perfilId ? breakdownModel.latestByProfile(perfilId, 3) : Promise.resolve({ data: [] }),
    ]);

    const tarifas = tarifasResult.data;

    const contextoTarifas = (tarifas || [])
      .map(t => `- ${t.tipo}: $${t.cuota_fija} (vigente desde ${t.vigente_desde}${t.vigente_hasta ? ' hasta ' + t.vigente_hasta : ''})`)
      .join('\n');

    // --- 2. Contexto privado: datos del usuario logueado ---
    let contextoUsuario = 'No hay un usuario autenticado en esta conversación.';

    if (perfilId) {
      const perfil = perfilResult.data;
      const ultimasFacturas = facturasResult.data;
      const ultimasAverias = averiasResult.data;

      const facturasTexto = (ultimasFacturas || [])
        .map(f => `- Periodo ${f.periodo}: $${f.valor_total}, vence ${f.fecha_vencimiento}, estado: ${f.estado}`)
        .join('\n') || 'Sin facturas registradas.';

      const averiasTexto = (ultimasAverias || [])
        .map((a) => {
          const ubicacion = [a.direccion, a.zona].filter(Boolean).join(', ') || 'sin ubicación registrada';
          const nota = a.nota_fontanero ? `; nota del fontanero: ${a.nota_fontanero}` : '';
          const resolucion = a.fecha_resolucion ? `; resuelta ${a.fecha_resolucion}` : '';
          return `- ${a.fecha_reporte}; estado: ${a.estado}; ubicación: ${ubicacion}; descripción: ${a.descripcion}${nota}${resolucion}`;
        })
        .join('\n') || 'Sin averías reportadas.';

      contextoUsuario = `
Usuario: ${perfil?.nombre || ''} ${perfil?.apellido || ''}
Lote: ${perfil?.numero_lote || 'N/A'} | Zona: ${perfil?.zona || 'N/A'} | Dirección: ${perfil?.direccion || 'N/A'} | Activo: ${perfil?.activo ? 'sí' : 'no'}

Últimas facturas:
${facturasTexto}

Últimas averías reportadas:
${averiasTexto}`.trim();
    }

    // --- 3. Prompt del sistema ---
    const promptSistema = `Eres GOTA, asistente de HIDROAPP, el acueducto Campo Amor de Majo, Garzón, Huila.
Responde en español colombiano, con calidez y de forma breve. Usa la conversación reciente para entender referencias y no preguntes otra vez algo que el usuario ya dijo.

${REGLA_TEMA_PROMPT}

AVERÍAS:
- Distingue entre reportar un problema nuevo y consultar el estado de una avería existente. Para consultas de estado, usa las averías recientes del usuario y cita su estado, fecha o nota del fontanero cuando estén disponibles.
- Interpreta expresiones coloquiales, mensajes cortos y errores de escritura. "No me llega el agua", "botó agua" o "se rompió el tubo" pueden describir una avería.
- Si reporta una fuga, daño, baja presión o falta de agua, conserva lo que ya dijo y pregunta solo una vez por el dato esencial que falte. Aprovecha la dirección del perfil para la ubicación; no vuelvas a preguntar dirección si ya está registrada.
- Si los datos esenciales están claros, pregunta una sola vez: "¿Quieres que la registre y avise al fontanero?". La app le muestra al usuario un botón "Sí, avisar al fontanero" para confirmarlo; no le pidas que escriba nada para registrarla.
- Algunos mensajes vienen de audios transcritos automáticamente: tolera palabras mal transcritas y deduce la intención. Nunca afirmes que quedó guardada sin confirmación de la API.
- No confundas un reporte nuevo con el historial de averías.

OTROS TEMAS:
- Usa únicamente los datos de tarifas, facturas y perfil incluidos abajo. Si falta información, dilo y orienta al usuario con claridad.
- No inventes valores, fechas ni estados.

TARIFAS:
${contextoTarifas || 'Sin tarifas registradas.'}

PERFIL E HISTORIAL AUTORIZADO:
${contextoUsuario}`;

    const mensajes = [
      { role: 'system', content: promptSistema },
      ...mensajesPrevios,
      { role: 'user', content: mensajeActual },
    ];

    const respuesta = await cliente.chat.completions.create({
      model: 'openai/gpt-oss-20b',
      messages: mensajes,
      temperature: 0.3,
      reasoning_effort: 'low',
      max_completion_tokens: 300,
    });

    const textoRespuesta = respuesta.choices?.[0]?.message?.content || 'No pude generar una respuesta.';

    const descripcion = perfilId && ofreceRegistrar(textoRespuesta)
      ? armarDescripcionAveria(mensajeActual, mensajesPrevios)
      : '';
    return res.status(200).json({
      respuesta: textoRespuesta,
      ...(descripcion.length >= MIN_DESCRIPCION && { accion: accionConfirmar(descripcion) }),
    });
  } catch (err) {
    return errorInesperado(res, err);
  }
}

// POST /audio - el usuario le envía un audio a GOTA. Se transcribe con
// Whisper y se guarda unas horas por si termina siendo una avería. La app
// muestra el texto para que el usuario lo revise y lo envía como mensaje.
async function transcribirAudio(req, res) {
  try {
    const perfilId = req.usuario.id;
    const bytes = req.body;
    const contentType = String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
    const { LIMITES, MIME_TYPES } = audiosAveriaService;
    const errorDuracion = `El audio puede durar máximo ${LIMITES.maxSegundos} segundos.`;

    if (!Buffer.isBuffer(bytes) || bytes.length === 0) {
      return res.status(400).json({ error: 'No recibí ningún audio. Intenta grabarlo de nuevo.' });
    }
    if (!MIME_TYPES.includes(contentType)) {
      return res.status(415).json({ error: 'Formato de audio no compatible.' });
    }
    if (bytes.length > LIMITES.maxBytes) {
      return res.status(413).json({ error: errorDuracion });
    }

    // La duración declarada solo sirve para reservar el cupo; la real la da Whisper.
    const declarada = Number.parseInt(req.headers['x-audio-duracion'], 10);
    const segundos = Number.isFinite(declarada)
      ? Math.min(Math.max(declarada, 1), LIMITES.maxSegundos)
      : LIMITES.maxSegundos;

    const cupo = await audiosAveriaService.consumirCupo(perfilId, segundos);
    if (cupo === 'limite_usuario') {
      return res.status(429).json({
        error: `Por hoy ya usaste tus ${LIMITES.audiosPorDia} audios 🎤. Escríbeme y te ayudo igual.`,
      });
    }
    if (cupo !== 'ok') {
      return res.status(429).json({ error: 'Los audios están ocupados por hoy. Escríbeme y te ayudo igual.' });
    }

    const resultado = await audiosAveriaService.transcribir(bytes, contentType);
    if (!resultado) {
      return res.status(503).json({ error: 'El asistente virtual no está disponible por ahora.' });
    }
    if (resultado.duracion !== null && resultado.duracion > LIMITES.maxSegundos + 5) {
      return res.status(413).json({ error: errorDuracion });
    }
    const transcripcion = resultado.texto.trim().slice(0, MAX_MENSAJE);
    if (transcripcion.length < 2) {
      return res.status(422).json({ error: 'No logré entender el audio. Intenta hablar más cerca del teléfono.' });
    }

    // Si guardar el archivo falla, el usuario igual recibe su texto: lo que
    // se pierde es solo el audio para el fontanero.
    let audioId = null;
    try {
      audioId = await audiosAveriaService.guardarAudioPendiente({
        perfilId,
        bytes,
        contentType,
        duracion: resultado.duracion ?? segundos,
        transcripcion,
      });
    } catch (errorGuardar) {
      console.error('[chat] no se pudo guardar el audio:', errorGuardar.message);
    }

    return res.status(200).json({ transcripcion, audioId });
  } catch (err) {
    return errorInesperado(res, err);
  }
}

module.exports = { chatearConAsistente, transcribirAudio };
