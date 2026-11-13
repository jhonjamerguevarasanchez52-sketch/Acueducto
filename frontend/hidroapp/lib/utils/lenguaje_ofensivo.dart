/// Detecta groserías, insultos y lenguaje racista o discriminatorio antes de
/// enviar un texto al servidor, para avisarle a la persona al instante.
///
/// El servidor tiene la misma regla (backend/utils/lenguajeOfensivo.js) y es
/// el que manda: esta copia solo evita esperar la respuesta. Si cambias la
/// lista aquí, cámbiala también allá.
///
/// - Ignora mayúsculas y tildes, y traduce números/símbolos usados como letras
///   ("put4", "m1erd@").
/// - Acepta letras repetidas ("puuuta"), signos entre letras ("p.u.t.a") y
///   letras sueltas con espacios ("p u t a").
/// - Solo cuenta palabras completas ("computadora" o "disputa" pasan) y no
///   bloquea palabras con doble sentido por sí solas ("perra", "negro", "hp"
///   de las motobombas).
library;

const _palabras = <String>[
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

/// Lo que responde GOTA en el chat (igual que el servidor).
const respuestaGotaLenguajeOfensivo =
    'Prefiero que hablemos con respeto 💧. Escríbeme sin groserías y con '
    'gusto te ayudo con tus facturas, pagos, averías o el servicio de agua.';

const mensajeLenguajeOfensivo =
    'Tu mensaje tiene palabras ofensivas o groserías. '
    'Por favor escríbelo de forma respetuosa.';

const _tildes = {
  'á': 'a', 'à': 'a', 'ä': 'a', 'â': 'a', 'ã': 'a',
  'é': 'e', 'è': 'e', 'ë': 'e', 'ê': 'e',
  'í': 'i', 'ì': 'i', 'ï': 'i', 'î': 'i',
  'ó': 'o', 'ò': 'o', 'ö': 'o', 'ô': 'o', 'õ': 'o',
  'ú': 'u', 'ù': 'u', 'ü': 'u', 'û': 'u',
};

const _leet = {
  '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '8': 'b',
  '@': 'a', r'$': 's',
};

String _normalizar(String texto) {
  final b = StringBuffer();
  // "!" y "|" son "i" solo dentro de una palabra ("h!jo"); al final
  // ("puta!!") son puntuación y no deben pegarse a la palabra.
  final minusculas = texto.toLowerCase().replaceAll(
    RegExp(r'[!|](?=[a-zñ0-9@$áéíóúü])'),
    'i',
  );
  for (final c in minusculas.split('')) {
    b.write(_tildes[c] ?? _leet[c] ?? c);
  }
  // "p u t a" → "puta": une 3 o más letras sueltas separadas por espacio.
  return b.toString().replaceAllMapped(
    RegExp(r'(?<![a-zñ])(?:[a-zñ] ){2,}[a-zñ](?![a-zñ])'),
    (m) => m[0]!.replaceAll(' ', ''),
  );
}

String _patron(String palabra) => palabra
    .split('')
    .map((c) => c == ' ' ? r'[\s._*\-]+' : '${RegExp.escape(c)}+[._*\\-]*')
    .join()
    .replaceFirst(RegExp(r'\[\._\*\\-\]\*$'), '');

final RegExp _regex = () {
  final unicas = _palabras.toSet().toList()
    ..sort((a, b) => b.length.compareTo(a.length));
  return RegExp(
    '(?<![a-zñ])(?:${unicas.map(_patron).join('|')})(?:e?s)?(?![a-zñ])',
    caseSensitive: false,
  );
}();

/// true si el texto tiene groserías o lenguaje ofensivo.
bool contieneLenguajeOfensivo(String? texto) {
  if (texto == null || texto.trim().isEmpty) return false;
  return _regex.hasMatch(_normalizar(texto));
}

/// Para el `validator` de un `TextFormField`.
String? validarSinGroserias(String? texto) =>
    contieneLenguajeOfensivo(texto) ? mensajeLenguajeOfensivo : null;

// Campos que no son texto libre (contraseñas, correos, códigos, firmas...).
final _camposIgnorados = RegExp(
  r'pass|contrase|clave|token|codigo|code|email|correo|firma|signature|url|^id$|_id$|historial|referencia|fecha|periodo',
  caseSensitive: false,
);

/// Revisa todos los textos de un cuerpo JSON (igual que el servidor).
bool cuerpoConLenguajeOfensivo(Object? valor, [String? clave, int nivel = 0]) {
  if (nivel > 4 || (clave != null && _camposIgnorados.hasMatch(clave))) {
    return false;
  }
  if (valor is String) return contieneLenguajeOfensivo(valor);
  if (valor is Iterable) {
    return valor.any((v) => cuerpoConLenguajeOfensivo(v, clave, nivel + 1));
  }
  if (valor is Map) {
    return valor.entries.any(
      (e) => cuerpoConLenguajeOfensivo(e.value, '${e.key}', nivel + 1),
    );
  }
  return false;
}
