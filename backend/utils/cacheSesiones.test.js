const test = require('node:test');
const assert = require('node:assert/strict');

const cache = require('./cacheSesiones');

function jwtCon(exp) {
  const parte = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${parte({ alg: 'HS256' })}.${parte({ exp })}.firma`;
}

const sesion = (id) => ({ user: { id }, perfil: { id, rol: 'usuario' } });

test.beforeEach(() => cache.limpiar());

test('devuelve la sesión guardada mientras no venza', () => {
  const token = jwtCon(Math.floor(Date.now() / 1000) + 3600);
  cache.guardar(token, sesion('a'), 1000);
  assert.deepEqual(cache.obtener(token, 1000 + cache.TTL_MS - 1), sesion('a'));
  assert.equal(cache.obtener(token, 1000 + cache.TTL_MS), null);
});

test('nunca vive más que el propio token', () => {
  const ahora = Date.now();
  const token = jwtCon(Math.floor(ahora / 1000) + 5);
  cache.guardar(token, sesion('a'), ahora);
  assert.equal(cache.obtener(token, ahora + 6000), null);
});

test('un token ya vencido no se guarda', () => {
  const ahora = Date.now();
  const token = jwtCon(Math.floor(ahora / 1000) - 10);
  cache.guardar(token, sesion('a'), ahora);
  assert.equal(cache.obtener(token, ahora), null);
});

test('invalidarUsuario borra solo las sesiones de esa persona', () => {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const tA = jwtCon(exp) + 'a';
  const tB = jwtCon(exp) + 'b';
  cache.guardar(tA, sesion('a'));
  cache.guardar(tB, sesion('b'));
  cache.invalidarUsuario('a');
  assert.equal(cache.obtener(tA), null);
  assert.deepEqual(cache.obtener(tB), sesion('b'));
});

test('el caché no crece sin límite', () => {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  for (let i = 0; i <= cache.MAX_ENTRADAS; i++) cache.guardar(`${jwtCon(exp)}${i}`, sesion(`u${i}`));
  assert.equal(cache.obtener(`${jwtCon(exp)}0`), null, 'la más antigua se descartó');
  assert.ok(cache.obtener(`${jwtCon(exp)}${cache.MAX_ENTRADAS}`));
});
