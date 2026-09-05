const Groq = require('groq-sdk');
const supabaseAdmin = require('../config/supabaseAdminClient');
const { errorInesperado } = require('../utils/httpErrores');

// El cliente se crea perezosamente (no al cargar el módulo): así, si falta
// GROQ_API_KEY, solo falla esta ruta en vez de tumbar todo el servidor al
// arrancar (el SDK de Groq lanza en su constructor si no hay API key).
let groq = null;
function obtenerCliente() {
  if (!process.env.GROQ_API_KEY) return null;
  if (!groq) groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  return groq;
}

async function chatearConAsistente(req, res) {
  try {
    const cliente = obtenerCliente();
    if (!cliente) {
      return res.status(503).json({ error: 'El asistente virtual no está disponible por ahora.' });
    }

    const { mensaje } = req.body;

    if (!mensaje || !mensaje.trim()) {
      return res.status(400).json({ error: 'Debes enviar un mensaje válido.' });
    }

    // req.usuario lo pone authMiddleware (verificarToken) tras validar el JWT
    const perfilId = req.usuario?.id;

    // --- 1. Contexto general: tarifas vigentes ---
    const { data: tarifas } = await supabaseAdmin
      .from('rates')
      .select('tipo, cuota_fija, vigente_desde, vigente_hasta')
      .order('vigente_desde', { ascending: false });

    const contextoTarifas = (tarifas || [])
      .map(t => `- ${t.tipo}: $${t.cuota_fija} (vigente desde ${t.vigente_desde}${t.vigente_hasta ? ' hasta ' + t.vigente_hasta : ''})`)
      .join('\n');

    // --- 2. Contexto privado: datos del usuario logueado ---
    let contextoUsuario = 'No hay un usuario autenticado en esta conversación.';

    if (perfilId) {
      const { data: perfil } = await supabaseAdmin
        .from('profiles')
        .select('nombre, apellido, numero_lote, zona, activo')
        .eq('id', perfilId)
        .single();

      const { data: ultimasFacturas } = await supabaseAdmin
        .from('invoices')
        .select('periodo, valor_total, fecha_vencimiento, estado')
        .eq('perfil_id', perfilId)
        .order('fecha_emision', { ascending: false })
        .limit(3);

      const { data: ultimasAverias } = await supabaseAdmin
        .from('breakdowns')
        .select('descripcion, estado, fecha_reporte')
        .eq('perfil_id', perfilId)
        .order('fecha_reporte', { ascending: false })
        .limit(3);

      const facturasTexto = (ultimasFacturas || [])
        .map(f => `- Periodo ${f.periodo}: $${f.valor_total}, vence ${f.fecha_vencimiento}, estado: ${f.estado}`)
        .join('\n') || 'Sin facturas registradas.';

      const averiasTexto = (ultimasAverias || [])
        .map(a => `- ${a.descripcion} (estado: ${a.estado}, reportada ${a.fecha_reporte})`)
        .join('\n') || 'Sin averías reportadas.';

      contextoUsuario = `
Usuario: ${perfil?.nombre || ''} ${perfil?.apellido || ''}
Lote: ${perfil?.numero_lote || 'N/A'} | Zona: ${perfil?.zona || 'N/A'} | Activo: ${perfil?.activo ? 'sí' : 'no'}

Últimas facturas:
${facturasTexto}

Últimas averías reportadas:
${averiasTexto}`.trim();
    }

    // --- 3. Prompt del sistema ---
    const promptSistema = `
Eres GOTA, el asistente virtual de HIDROAPP, la app del acueducto veredal Campo Amor (vereda Majo, Garzón, Huila).

TU PERSONALIDAD:
- Eres amable, cercano y con buena energía, como un vecino que conoce bien el acueducto y quiere ayudar.
- Hablas en español, de forma sencilla y humana, sin sonar robótico ni formal en exceso.
- Puedes usar alguna palabra cálida o un emoji ocasional (💧🚰) para dar cercanía, sin exagerar.

CÓMO RESPONDES:
- Vas directo al punto: respuestas cortas y claras, sin rodeos ni explicaciones innecesarias.
- Si la pregunta tiene una respuesta simple, la das en 1-3 frases. Solo te extiendes si el tema realmente lo requiere.
- Eres interactivo: si te falta un dato para ayudar bien (por ejemplo, no sabes qué avería quiere reportar), haces UNA pregunta concreta para avanzar, en vez de suponer.
- Guías al usuario paso a paso cuando el trámite lo requiere (por ejemplo, reportar una avería), sin abrumarlo con todo de una vez.

QUÉ PUEDES HACER:
- Ayudar a reportar averías (fugas, daños, cortes de agua) y explicar qué pasa después del reporte.
- Informar sobre tarifas vigentes, facturas, fechas de pago y estado de cuenta del usuario.
- Explicar cómo pagar, cómo funciona el servicio, y resolver dudas generales del acueducto.
- Orientar sobre cortes de servicio programados o novedades.

REGLAS IMPORTANTES:
- Solo usa la información que se te da en el contexto (tarifas, datos del usuario, facturas, averías). Si no tienes un dato, dilo con honestidad ("no tengo ese dato a la mano") y sugiere contactar al administrador del acueducto, sin inventar cifras, fechas ni estados.
- Nunca inventes tarifas, montos, ni el estado de una factura o avería.
- Si el usuario pregunta algo totalmente fuera del tema del acueducto, redirígelo con amabilidad de vuelta al tema, sin sermonear.
- Sé eficaz: tu meta es que el usuario resuelva su duda o su trámite lo más rápido posible.

TARIFAS VIGENTES:
${contextoTarifas || 'No hay tarifas registradas.'}

DATOS DEL USUARIO ACTUAL:
${contextoUsuario}
`.trim();
 

    const respuesta = await cliente.chat.completions.create({
      model: 'openai/gpt-oss-120b',
      messages: [
        { role: 'system', content: promptSistema },
        { role: 'user', content: mensaje },
      ],
      temperature: 0.4,
    });

    const textoRespuesta = respuesta.choices?.[0]?.message?.content || 'No pude generar una respuesta.';

    return res.status(200).json({ respuesta: textoRespuesta });
  } catch (err) {
    return errorInesperado(res, err);
  }
}

module.exports = { chatearConAsistente };