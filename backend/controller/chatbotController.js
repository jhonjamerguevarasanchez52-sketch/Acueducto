const Groq = require('groq-sdk');
const rateModel = require('../models/rateModel');
const profileModel = require('../models/profileModel');
const invoiceModel = require('../models/invoiceModel');
const breakdownModel = require('../models/breakdownModel');
const { errorInesperado } = require('../utils/httpErrores');
const { notificarNuevaAveria } = require('../services/notificarAveria');

// El cliente se crea perezosamente (no al cargar el módulo): así, si falta
// GROQ_API_KEY, solo falla esta ruta en vez de tumbar todo el servidor al
// arrancar (el SDK de Groq lanza en su constructor si no hay API key).
let groq = null;
const MAX_MENSAJE = 500;
const MAX_TURNOS_HISTORIAL = 8;

function normalizar(texto) {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function quiereRegistrar(mensaje, historial) {
  const actual = normalizar(mensaje);
  const pideRegistro = /\b(report(a|ar|ame)|registr(a|ar|alo)|mand(a|ar)|envi(a|ar)|avis(a|ar)|notific(a|ar))\b/.test(actual) &&
    /\b(averia|fuga|dano|fontanero|plomero|reporte)\b/.test(actual);
  const afirmacion = /^(si|dale|listo|confirmo|hazlo|de una)([,! ]|$)/.test(actual.trim());
  const asistentePidioConfirmar = [...historial].reverse().some((turno) =>
    turno.role === 'assistant' && /\b(registr|report|avis|fontanero)\w*\b/.test(normalizar(turno.content))
  );
  return pideRegistro || (afirmacion && asistentePidioConfirmar);
}

function armarDescripcionAveria(mensaje, historial) {
  const textosUsuario = [...historial.filter((turno) => turno.role === 'user').map((turno) => turno.content), mensaje];
  const detalles = textosUsuario
    .map((texto) => texto.trim())
    .filter((texto) => texto.length >= 8 && !/^\s*(si|dale|listo|confirmo|hazlo|ok|okay)[.! ]*$/i.test(texto))
    .filter((texto) => !/^(por favor )?(reporta|registra|manda|envia|avisa)( la)? averia\b/i.test(texto));
  return [...new Set(detalles)].join('. ').slice(0, 1000);
}

function obtenerCliente() {
  if (!process.env.GROQ_API_KEY) return null;
  if (!groq) groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  return groq;
}

async function chatearConAsistente(req, res) {
  try {
    const { mensaje, historial } = req.body;
    if (typeof mensaje !== 'string' || !mensaje.trim()) {
      return res.status(400).json({ error: 'Debes enviar un mensaje válido.' });
    }

    const mensajeActual = mensaje.trim();
    if (mensajeActual.length > MAX_MENSAJE) {
      return res.status(400).json({ error: `El mensaje no puede superar ${MAX_MENSAJE} caracteres.` });
    }

    const cliente = obtenerCliente();

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

    // Registrar y avisar es un camino directo: el chatbot no debe volver a
    // preguntar lo ya dicho ni esperar una llamada a Groq para guardar.
    if (quiereRegistrar(mensajeActual, mensajesPrevios)) {
      if (!perfilId) {
        return res.status(401).json({ respuesta: 'Inicia sesión para registrar la avería y avisar al fontanero.' });
      }

      const { data: perfil, error: errorPerfil } = await profileModel.getById(perfilId, {
        columns: 'nombre, apellido, zona, direccion, activo',
      });
      if (errorPerfil) throw errorPerfil;
      if (!perfil?.activo) {
        return res.status(403).json({ respuesta: 'Tu perfil no está activo. Contacta al administrador del acueducto.' });
      }

      const descripcion = armarDescripcionAveria(mensajeActual, mensajesPrevios);
      if (descripcion.length < 20) {
        return res.status(200).json({ respuesta: 'Cuéntame en una frase qué pasó (por ejemplo, dónde está la fuga o qué servicio falta) y la registro para avisar al fontanero.' });
      }
      if (!perfil.zona && !perfil.direccion) {
        return res.status(200).json({ respuesta: 'Tu perfil no tiene una ubicación registrada. Pídele al administrador que actualice tu dirección para poder enviar la avería.' });
      }

      const { data: recientes } = await breakdownModel.latestByProfile(perfilId, 1);
      const anterior = recientes?.[0];
      if (anterior && anterior.estado === 'reportada' &&
          normalizar(anterior.descripcion) === normalizar(descripcion) &&
          Date.now() - new Date(anterior.fecha_reporte).getTime() < 600000) {
        return res.status(200).json({ respuesta: 'Esta avería ya quedó registrada y el fontanero está siendo notificado.', averia: { estado: anterior.estado } });
      }

      const { data: averia, error } = await breakdownModel.create({
        perfil_id: perfilId,
        descripcion,
        zona: perfil.zona,
        direccion: perfil.direccion,
      }, req.db);
      if (error) throw error;
      void notificarNuevaAveria(averia);
      return res.status(201).json({ respuesta: 'Avería registrada. Ya estoy avisando al fontanero.', averia: { id: averia.id, estado: averia.estado } });
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

AVERÍAS:
- Distingue entre reportar un problema nuevo y consultar el estado de una avería existente. Para consultas de estado, usa las averías recientes del usuario y cita su estado, fecha o nota del fontanero cuando estén disponibles.
- Interpreta expresiones coloquiales, mensajes cortos y errores de escritura. "No me llega el agua", "botó agua" o "se rompió el tubo" pueden describir una avería.
- Si reporta una fuga, daño, baja presión o falta de agua, conserva lo que ya dijo y pregunta solo una vez por el dato esencial que falte. Aprovecha la dirección del perfil para la ubicación; no vuelvas a preguntar dirección si ya está registrada.
- Si los datos esenciales están claros, pregunta una sola vez: "¿Quieres que la registre y avise al fontanero?". Si responde afirmativamente, indícale que escriba "registra la avería" para ejecutar el envío. Nunca afirmes que quedó guardada sin confirmación de la API.
- No confundas un reporte nuevo con el historial de averías.

OTROS TEMAS:
- Usa únicamente los datos de tarifas, facturas y perfil incluidos abajo. Si falta información, dilo y orienta al usuario con claridad.
- No inventes valores, fechas ni estados. Si la consulta no es del acueducto, redirígela brevemente.

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

    return res.status(200).json({ respuesta: textoRespuesta });
  } catch (err) {
    return errorInesperado(res, err);
  }
}

module.exports = { chatearConAsistente };
