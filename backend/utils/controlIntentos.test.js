const test = require('node:test');
const assert = require('node:assert/strict');

const {
  segundosDeBloqueo,
  registrarFallo,
  registrarExito,
  usarAlmacen,
  crearAlmacenMemoria,
  MAX_INTENTOS,
} = require('./controlIntentos');

// Las pruebas no tocan Supabase: usan un almacén en memoria aislado.
usarAlmacen(crearAlmacenMemoria());

test('controlIntentos', async (t) => {
  await t.test('sin registros previos, no hay bloqueo', async () => {
    assert.equal(await segundosDeBloqueo('login', 'nuevo@example.com'), null);
  });

  await t.test('bloquea tras alcanzar MAX_INTENTOS fallos seguidos', async () => {
    const correo = 'bloqueo@example.com';

    for (let i = 0; i < MAX_INTENTOS - 1; i++) {
      await registrarFallo('login', correo);
      assert.equal(await segundosDeBloqueo('login', correo), null, `no debería bloquear en el intento ${i + 1}`);
    }

    await registrarFallo('login', correo);
    const bloqueo = await segundosDeBloqueo('login', correo);
    assert.ok(bloqueo > 0, 'debería quedar bloqueado tras el intento número MAX_INTENTOS');
    assert.ok(bloqueo <= 15 * 60, 'el bloqueo no debería exceder la ventana configurada de 15 minutos');
  });

  await t.test('registrarExito limpia el contador y evita el bloqueo', async () => {
    const correo = 'exito@example.com';

    for (let i = 0; i < MAX_INTENTOS - 1; i++) await registrarFallo('login', correo);
    await registrarExito('login', correo);

    // Si el contador no se hubiera limpiado, estos fallos sumarían a los
    // anteriores y ya estaría bloqueado.
    for (let i = 0; i < MAX_INTENTOS - 1; i++) await registrarFallo('login', correo);
    assert.equal(await segundosDeBloqueo('login', correo), null);
  });

  await t.test('las acciones y correos distintos no comparten el contador', async () => {
    const correo = 'aislado@example.com';

    for (let i = 0; i < MAX_INTENTOS; i++) await registrarFallo('login', correo);
    assert.ok(await segundosDeBloqueo('login', correo) > 0);

    // Misma dirección de correo, pero otra acción: no debería estar bloqueada.
    assert.equal(await segundosDeBloqueo('verificar', correo), null);
  });

  await t.test('el correo no distingue mayúsculas/minúsculas ni espacios', async () => {
    const correo = 'MayUs@Example.com';

    for (let i = 0; i < MAX_INTENTOS; i++) await registrarFallo('reset', correo);
    assert.ok(await segundosDeBloqueo('reset', '  mayus@example.com  ') > 0);
  });

  await t.test('si la base de datos falla, usa el respaldo en memoria', async () => {
    usarAlmacen({
      bloqueadoHasta: async () => { throw new Error('sin red'); },
      fallo: async () => { throw new Error('sin red'); },
      limpiar: async () => { throw new Error('sin red'); },
    });
    const correo = 'sinred@example.com';
    for (let i = 0; i < MAX_INTENTOS; i++) await registrarFallo('login', correo);
    assert.ok(await segundosDeBloqueo('login', correo) > 0);
    usarAlmacen(crearAlmacenMemoria());
  });
});
