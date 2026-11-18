const test = require('node:test');
const assert = require('node:assert/strict');

const { aplicarPaginacion, LIMITE_MAXIMO } = require('./paginacion');

function consultaFalsa() {
  const llamadas = [];
  const q = {
    llamadas,
    order(...args) { llamadas.push(['order', ...args]); return q; },
    range(...args) { llamadas.push(['range', ...args]); return q; },
  };
  return q;
}

test('sin limit la consulta queda intacta', () => {
  const q = consultaFalsa();
  assert.equal(aplicarPaginacion(q, {}), q);
  assert.deepEqual(q.llamadas, []);
});

test('con limit agrega desempate por id y el rango pedido', () => {
  const q = consultaFalsa();
  aplicarPaginacion(q, { limit: '50', offset: '100' });
  assert.deepEqual(q.llamadas, [
    ['order', 'id', { ascending: true }],
    ['range', 100, 149],
  ]);
});

test('el limit se recorta al máximo que entrega Supabase', () => {
  const q = consultaFalsa();
  aplicarPaginacion(q, { limit: 5000 });
  assert.deepEqual(q.llamadas.at(-1), ['range', 0, LIMITE_MAXIMO - 1]);
});

test('offset negativo o inválido se trata como 0', () => {
  const q = consultaFalsa();
  aplicarPaginacion(q, { limit: 10, offset: '-3' });
  assert.deepEqual(q.llamadas.at(-1), ['range', 0, 9]);
});
