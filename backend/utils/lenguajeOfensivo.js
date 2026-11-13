/**
 * Detecta groserías, insultos y lenguaje racista o discriminatorio en los
 * textos que escriben las personas (chat con GOTA, averías, notas, avisos,
 * perfiles...).
 *
 * Cómo se evita que la burlen:
 * - Ignora mayúsculas y tildes ("ESTÚPIDO" = "estupido").
 * - Traduce números y símbolos usados como letras ("put4", "m1erd@").
 * - Acepta letras repetidas ("puuuuta") y signos entre letras ("p.u.t.a").
 * - Une letras sueltas separadas por espacios ("p u t a").
 *
 * Cómo se evitan falsos positivos:
 * - Solo cuenta palabras completas: "computadora" o "disputa" no se bloquean.
 * - Las palabras con doble sentido ("perra", "negro", "mono", "chimba", "hp"
 *   de las motobombas, "arrastrado") no se bloquean solas; algunas solo
 *   cuentan dentro de expresiones ofensivas ("hijo de perra").
 *
 * La app (lib/utils/lenguaje_ofensivo.dart) tiene la misma lista para avisar
 * sin esperar al servidor; si cambias una, cambia la otra.
 */

// Palabras ofensivas por sí solas (ya en minúscula y sin tildes).
// Se aceptan también en plural (+s / +es) y en femenino/masculino (o/a).
const PALABRAS = [
  // Groserías e insultos comunes en Colombia
  'hijueputa', 'hijueputas', 'jueputa', 'hijuepucha', 'hpta', 'hpt', 'hdp', 'ptm',
  'triplehijueputa', 'gonorrea', 'malparido', 'malparida', 'carechimba', 'careverga',
  'carepicha', 'careculo', 'verga', 'vergas', 'pirobo', 'piroba', 'culicagado', 'gurrupleta',
  'puta', 'puto', 'putas', 'putos', 'putita', 'putica', 'putamadre', 'putisima',
  'mierda', 'mierdas', 'mrd', 'mierdero', 'cagada', 'cagado', 'culo', 'culos', 'culon', 'culiar', 'culear',
  'marica', 'maricon', 'maricona', 'mariquita', 'marikon', 'gay de mierda',
  'pendejo', 'pendeja', 'imbecil', 'imbeciles', 'idiota', 'idiotas', 'estupido', 'estupida',
  'tarado', 'tarada', 'retrasado', 'retrasada', 'mongolico', 'mongolica', 'subnormal',
  'zorra', 'zorras', 'perra hijueputa', 'ramera', 'prostituta', 'cabron', 'cabrona', 'cabrones',
  'mamaguevo', 'mamahuevo', 'mamaguevos', 'guevon', 'huevon', 'webon', 'guevona', 'huevona',
  'malnacido', 'malnacida', 'lambon', 'sapo hijueputa', 'coño', 'cono de tu madre',
  'pinche', 'chinga', 'chingada', 'chingar', 'chingue', 'joder', 'jodete', 'jodase',
  'pajero', 'pajera', 'pichurria', 'cacorro', 'cacorra',
  'concha de tu madre',
  'te voy a matar', 'los voy a matar', 'muerete', 'ojala te mueras',
  // Racismo, xenofobia y discriminación
  'negro de mierda', 'negra de mierda', 'negro hijueputa', 'negrata', 'negrito de mierda',
  'indio de mierda', 'india de mierda', 'indio patirrajado', 'indio hijueputa',
  'sudaca', 'sudacas', 'veneco', 'venecos', 'veneca', 'venecas', 'chino de mierda',
  'mono de mierda', 'simio', 'simios', 'esclavo de mierda', 'raza inferior', 'raza de mierda',
  'sidoso', 'sidosa', 'machorra', 'tortillera', 'travelo', 'maricones',
  // Inglés
  'fuck', 'fucking', 'fucker', 'motherfucker', 'shit', 'bullshit', 'bitch', 'bitches',
  'asshole', 'cunt', 'dick', 'pussy', 'whore', 'slut', 'bastard',
  'nigger', 'niggers', 'nigga', 'niggas', 'faggot', 'fag', 'retard', 'kys', 'kill yourself',
  // Expresiones
  'hijo de puta', 'hija de puta', 'hijos de puta', 'hijo de perra', 'hija de perra',
  'hijo de la gran puta', 'tu madre es una puta', 'la puta madre', 'que te jodan',
  'chupame', 'chupamela', 'mamamela', 'come mierda', 'comemierda', 'vete a la mierda',
  'malparidos', 'gonorreas', 'piroberia',
];

const LEET = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', 8: 'b', '@': 'a', $: 's' };

function normalizar(texto) {
  return String(texto)
    .toLowerCase()
    .replace(/ñ/g, '\u0000') // conservar la ñ al quitar tildes
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\u0000/g, 'ñ')
    // "!" y "|" son "i" solo dentro de una palabra ("h!jo"); al final ("puta!!")
    // son puntuación y no deben pegarse a la palabra.
    .replace(/[!|](?=[a-zñ0-9@$])/g, 'i')
    .replace(/[0134578@$]/g, (c) => LEET[c] ?? c)
    // "p u t a" → "puta": une 3 o más letras sueltas separadas por espacio.
    .replace(/\b(?:[a-zñ] ){2,}[a-zñ]\b/g, (m) => m.replace(/ /g, ''));
}

const escapar = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Cada letra puede repetirse ("puuuta") y llevar signos en medio ("p.u.t.a");
// los espacios de las expresiones aceptan cualquier separador.
function patron(palabra) {
  return [...palabra]
    .map((c) => (c === ' ' ? '[\\s._*\\-]+' : `${escapar(c)}+[._*\\-]*`))
    .join('')
    .replace(/\[\._\*\\-\]\*$/, '');
}

const REGEX = new RegExp(
  `(?<![a-zñ])(?:${[...new Set(PALABRAS)].sort((a, b) => b.length - a.length).map(patron).join('|')})(?:e?s)?(?![a-zñ])`,
  'i'
);

/** true si el texto tiene groserías o lenguaje ofensivo. */
function contieneLenguajeOfensivo(texto) {
  if (typeof texto !== 'string' || !texto.trim()) return false;
  return REGEX.test(normalizar(texto));
}

// Respuesta de GOTA en el chat (se ve como una burbuja normal).
const RESPUESTA_LENGUAJE_OFENSIVO =
  'Prefiero que hablemos con respeto 💧. Escríbeme sin groserías y con gusto te ayudo con tus facturas, pagos, averías o el servicio de agua.';

const MENSAJE_LENGUAJE_OFENSIVO =
  'Tu mensaje tiene palabras ofensivas o groserías. Por favor escríbelo de forma respetuosa.';

// Campos que no son texto libre (contraseñas, correos, códigos, firmas...).
const CAMPOS_IGNORADOS = /pass|contrase|clave|token|codigo|code|email|correo|firma|signature|url|^id$|_id$|historial|referencia|fecha|periodo/i;

function buscarOfensivo(valor, clave, profundidad = 0) {
  if (profundidad > 4 || (clave && CAMPOS_IGNORADOS.test(clave))) return false;
  if (typeof valor === 'string') return contieneLenguajeOfensivo(valor);
  if (Array.isArray(valor)) return valor.some((v) => buscarOfensivo(v, clave, profundidad + 1));
  if (valor && typeof valor === 'object') {
    return Object.entries(valor).some(([k, v]) => buscarOfensivo(v, k, profundidad + 1));
  }
  return false;
}

/**
 * Middleware global: rechaza con 400 cualquier POST/PUT/PATCH cuyo cuerpo
 * JSON tenga texto ofensivo. El chat con GOTA responde con un mensaje amable
 * (en `respuesta`) para que se vea como una burbuja normal.
 */
function bloquearLenguajeOfensivo(req, res, next) {
  if (!['POST', 'PUT', 'PATCH'].includes(req.method)) return next();
  // Los webhooks de Wompi y las tareas internas no los escriben personas.
  if (/^\/api\/(wompi|interno|tareas)/.test(req.path)) return next();
  if (!req.body || typeof req.body !== 'object' || Buffer.isBuffer(req.body)) return next();
  if (!buscarOfensivo(req.body)) return next();

  if (req.path.startsWith('/api/chat')) {
    return res.status(200).json({
      respuesta: RESPUESTA_LENGUAJE_OFENSIVO,
    });
  }
  return res.status(400).json({ error: MENSAJE_LENGUAJE_OFENSIVO });
}

module.exports = {
  contieneLenguajeOfensivo,
  bloquearLenguajeOfensivo,
  MENSAJE_LENGUAJE_OFENSIVO,
  RESPUESTA_LENGUAJE_OFENSIVO,
};
