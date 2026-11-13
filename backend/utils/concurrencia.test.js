const test = require('node:test');
const assert = require('node:assert/strict');

const { mapearConLimite } = require('./concurrencia');
const { esCupoAgotado } = require('../config/mailer');

test('nunca supera el límite de tareas simultáneas y conserva el orden', async () => {
  let activas = 0;
  let maximo = 0;
  const resultado = await mapearConLimite([1, 2, 3, 4, 5, 6, 7, 8], 3, async (n) => {
    activas += 1;
    maximo = Math.max(maximo, activas);
    await new Promise((r) => setTimeout(r, 5));
    activas -= 1;
    return n * 10;
  });
  assert.equal(maximo, 3);
  assert.deepEqual(resultado, [10, 20, 30, 40, 50, 60, 70, 80]);
});

test('una lista vacía devuelve un arreglo vacío', async () => {
  assert.deepEqual(await mapearConLimite([], 5, async () => 1), []);
});

test('reconoce los rechazos de Brevo por cupo agotado', () => {
  assert.equal(esCupoAgotado({ statusCode: 429 }), true);
  assert.equal(esCupoAgotado({ status: 402 }), true);
  assert.equal(esCupoAgotado(new Error('You have exceeded your daily limit')), true);
  assert.equal(esCupoAgotado(new Error('invalid email')), false);
  assert.equal(esCupoAgotado({ statusCode: 400 }), false);
});
