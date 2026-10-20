const test = require('node:test');
const assert = require('node:assert/strict');

const { verificarRol } = require('./roleMiddleware');

function respuestaFalsa() {
  return {
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

test('un usuario común no puede entrar a la lista global de averías', () => {
  const req = { usuario: { id: 'usuario-1', rol: 'usuario' } };
  const res = respuestaFalsa();
  let continuo = false;

  verificarRol('fontanero', 'administrador')(req, res, () => { continuo = true; });

  assert.equal(res.statusCode, 403);
  assert.equal(continuo, false);
});

test('el fontanero asignado sí puede ver la lista operativa', () => {
  const req = { usuario: { id: 'fontanero-1', rol: 'fontanero' } };
  const res = respuestaFalsa();
  let continuo = false;

  verificarRol('fontanero', 'administrador')(req, res, () => { continuo = true; });

  assert.equal(res.statusCode, null);
  assert.equal(continuo, true);
});
