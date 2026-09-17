const test = require('node:test');
const assert = require('node:assert/strict');

const {
  segundosDeBloqueo,
  registrarFallo,
  registrarExito,
  MAX_INTENTOS,
} = require('./controlIntentos');

test('controlIntentos', async (t) => {
  await t.test('sin registros previos, no hay bloqueo', () => {
    assert.equal(segundosDeBloqueo('login', 'nuevo@example.com'), null);
  });

  await t.test('bloquea tras alcanzar MAX_INTENTOS fallos seguidos', () => {
    const correo = 'bloqueo@example.com';

    for (let i = 0; i < MAX_INTENTOS - 1; i++) {
      registrarFallo('login', correo);
      assert.equal(segundosDeBloqueo('login', correo), null, `no debería bloquear en el intento ${i + 1}`);
    }

    registrarFallo('login', correo);
    const bloqueo = segundosDeBloqueo('login', correo);
    assert.ok(bloqueo > 0, 'debería quedar bloqueado tras el intento número MAX_INTENTOS');
    assert.ok(bloqueo <= 15 * 60, 'el bloqueo no debería exceder la ventana configurada de 15 minutos');
  });

  await t.test('registrarExito limpia el contador y evita el bloqueo', () => {
    const correo = 'exito@example.com';

    for (let i = 0; i < MAX_INTENTOS - 1; i++) registrarFallo('login', correo);
    registrarExito('login', correo);

    // Si el contador no se hubiera limpiado, estos fallos sumarían a los
    // anteriores y ya estaría bloqueado.
    for (let i = 0; i < MAX_INTENTOS - 1; i++) registrarFallo('login', correo);
    assert.equal(segundosDeBloqueo('login', correo), null);
  });

  await t.test('las acciones y correos distintos no comparten el contador', () => {
    const correo = 'aislado@example.com';

    for (let i = 0; i < MAX_INTENTOS; i++) registrarFallo('login', correo);
    assert.ok(segundosDeBloqueo('login', correo) > 0);

    // Misma dirección de correo, pero otra acción: no debería estar bloqueada.
    assert.equal(segundosDeBloqueo('verificar', correo), null);
  });

  await t.test('el correo no distingue mayúsculas/minúsculas ni espacios', () => {
    const correo = 'MayUs@Example.com';

    for (let i = 0; i < MAX_INTENTOS; i++) registrarFallo('reset', correo);
    assert.ok(segundosDeBloqueo('reset', '  mayus@example.com  ') > 0);
  });
});
