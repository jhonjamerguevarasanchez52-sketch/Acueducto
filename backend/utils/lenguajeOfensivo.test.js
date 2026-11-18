const test = require('node:test');
const assert = require('node:assert/strict');

const {
  contieneLenguajeOfensivo,
  bloquearLenguajeOfensivo,
  RESPUESTA_LENGUAJE_OFENSIVO,
} = require('./lenguajeOfensivo');

test('detecta groserías, insultos y racismo aunque los disfracen', () => {
  for (const texto of [
    'eres un hijueputa', 'HIJO DE PERRA', 'gonorrea', 'malparidos', 'estúpido',
    'P.U.T.A', 'puuuuta', 'm1erd@', 'p u t a', 'hpta', 'que te jodan',
    'negro de mierda', 'veneco', 'sudacas', 'fuck you', 'nigga',
    // Con signos al final (antes se escapaban: "!" se leía como "i").
    'qué puta!!', 'oiga ZORRA!', 'idiota!!!', 'h!jo de puta!',
  ]) {
    assert.equal(contieneLenguajeOfensivo(texto), true, texto);
  }
});

test('no bloquea textos normales del acueducto', () => {
  for (const texto of [
    'Tengo una fuga en la calle 15 # 3-40', 'la computadora', 'hay una disputa',
    'la motobomba de 2 hp no arranca', 'el agua ha arrastrado tierra',
    'mi perro tomó agua', 'el tubo negro está roto', 'no llega el agua',
    'Hola GOTA', 'la pera', 'el señor Peña', 'resultado', 'calle 3 a 4',
  ]) {
    assert.equal(contieneLenguajeOfensivo(texto), false, texto);
  }
});

function respuesta() {
  return {
    statusCode: null, body: null,
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; return this; },
  };
}

test('middleware: rechaza texto ofensivo en cualquier campo y deja pasar el resto', () => {
  let siguio = false;
  const res = respuesta();
  bloquearLenguajeOfensivo(
    { method: 'POST', path: '/api/averias', body: { descripcion: 'fuga, malparidos' } },
    res,
    () => { siguio = true; },
  );
  assert.equal(siguio, false);
  assert.equal(res.statusCode, 400);

  siguio = false;
  bloquearLenguajeOfensivo(
    { method: 'POST', path: '/api/averias', body: { descripcion: 'fuga en el tubo' } },
    respuesta(),
    () => { siguio = true; },
  );
  assert.equal(siguio, true);

  // Contraseñas y lecturas (GET) no se revisan.
  siguio = false;
  bloquearLenguajeOfensivo(
    { method: 'POST', path: '/api/auth/login', body: { password: 'Puta1234' } },
    respuesta(),
    () => { siguio = true; },
  );
  assert.equal(siguio, true);
});

test('middleware: en el chat GOTA responde amable en vez de dar error', () => {
  const res = respuesta();
  bloquearLenguajeOfensivo(
    { method: 'POST', path: '/api/chat', body: { mensaje: 'gonorrea' } },
    res,
    () => assert.fail('no debe seguir'),
  );
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.respuesta, RESPUESTA_LENGUAJE_OFENSIVO);
});
