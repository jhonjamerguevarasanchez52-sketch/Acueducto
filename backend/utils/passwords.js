const crypto = require('crypto');

// Excluye caracteres ambiguos (I, l, O, 0, 1) para que la contraseña temporal
// sea fácil de transcribir cuando el usuario la lee en el correo.
const MAYUSCULAS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const MINUSCULAS = 'abcdefghijkmnpqrstuvwxyz';
const NUMEROS = '23456789';
const SIMBOLOS = '!@#$%&*';
const TODOS = MAYUSCULAS + MINUSCULAS + NUMEROS + SIMBOLOS;

function caracterAleatorio(conjunto) {
  return conjunto[crypto.randomInt(0, conjunto.length)];
}

/**
 * Genera una contraseña temporal aleatoria, garantizando al menos una
 * mayúscula, una minúscula, un número y un símbolo.
 */
function generarPasswordTemporal(longitud = 12) {
  const obligatorios = [
    caracterAleatorio(MAYUSCULAS),
    caracterAleatorio(MINUSCULAS),
    caracterAleatorio(NUMEROS),
    caracterAleatorio(SIMBOLOS),
  ];
  const resto = Array.from(
    { length: Math.max(longitud - obligatorios.length, 0) },
    () => caracterAleatorio(TODOS)
  );
  const caracteres = [...obligatorios, ...resto];

  // Fisher-Yates: sin esto, los 4 caracteres obligatorios quedarían siempre al inicio.
  for (let i = caracteres.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [caracteres[i], caracteres[j]] = [caracteres[j], caracteres[i]];
  }

  return caracteres.join('');
}

module.exports = { generarPasswordTemporal };
