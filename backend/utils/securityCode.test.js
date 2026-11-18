const test = require('node:test');
const assert = require('node:assert/strict');

process.env.SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'clave-de-prueba';
const { generarCodigoSeguridad, protegerCodigo, codigoCoincide } = require('./securityCode');

test('el código generado siempre tiene 6 dígitos', () => {
  for (let i = 0; i < 200; i++) assert.match(generarCodigoSeguridad(), /^\d{6}$/);
});

test('el código protegido no contiene el código en claro', () => {
  const guardado = protegerCodigo('perfil-1', '123456');
  assert.ok(guardado.startsWith('h1:'));
  assert.ok(!guardado.includes('123456'));
});

test('acepta el código correcto y rechaza los demás', () => {
  const guardado = protegerCodigo('perfil-1', '123456');
  assert.equal(codigoCoincide('perfil-1', guardado, '123456'), true);
  assert.equal(codigoCoincide('perfil-1', guardado, ' 123456 '), true);
  assert.equal(codigoCoincide('perfil-1', guardado, '654321'), false);
  assert.equal(codigoCoincide('perfil-1', guardado, ''), false);
});

test('el mismo código protegido no sirve para otro perfil', () => {
  const guardado = protegerCodigo('perfil-1', '123456');
  assert.equal(codigoCoincide('perfil-2', guardado, '123456'), false);
});

test('sigue aceptando los códigos en claro creados antes del cambio', () => {
  assert.equal(codigoCoincide('perfil-1', '123456', '123456'), true);
  assert.equal(codigoCoincide('perfil-1', '123456', '123457'), false);
});

test('sin código guardado nunca coincide', () => {
  assert.equal(codigoCoincide('perfil-1', null, '123456'), false);
});
