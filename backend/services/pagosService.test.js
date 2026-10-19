const test = require('node:test');
const assert = require('node:assert/strict');

const supabaseAdmin = require('../config/supabaseAdminClient');
const { confirmarPago } = require('./pagosService');

/**
 * Cliente de Supabase simulado, suficiente para las cadenas que usa
 * confirmarPago(): from().select().eq().single() y
 * from().update().eq().select().single().
 */
function crearFalsoSupabase(config) {
  return {
    from(tabla) {
      const cfg = config[tabla] || {};
      let modo = 'select';
      let cambios = null;

      const resolver = () => {
        if (modo === 'update') {
          if (cfg.updateError) return Promise.resolve({ data: null, error: cfg.updateError });
          return Promise.resolve({ data: { ...cfg.row, ...cambios }, error: null });
        }
        if (modo === 'insert') {
          return Promise.resolve({ data: cambios, error: null });
        }
        if (cfg.selectError) return Promise.resolve({ data: null, error: cfg.selectError });
        return Promise.resolve({ data: cfg.row ?? null, error: null });
      };

      const builder = {
        select() { return builder; },
        update(vals) { modo = 'update'; cambios = vals; return builder; },
        insert(vals) { modo = 'insert'; cambios = vals; return builder; },
        eq() { return builder; },
        single() { return resolver(); },
        then(onFulfilled, onRejected) { return resolver().then(onFulfilled, onRejected); },
      };
      return builder;
    },
  };
}

test('confirmarPago', async (t) => {
  const fromOriginal = supabaseAdmin.from;
  t.after(() => {
    supabaseAdmin.from = fromOriginal;
  });

  await t.test('devuelve error si el pago no existe', async () => {
    supabaseAdmin.from = crearFalsoSupabase({
      payments: { selectError: { message: 'no encontrado' } },
    }).from;

    const resultado = await confirmarPago('id-inexistente');
    assert.equal(resultado.ok, false);
    assert.equal(resultado.error, 'Pago no encontrado');
  });

  await t.test('es idempotente si el pago ya estaba confirmado', async () => {
    const pagoConfirmado = { id: 'p1', confirmado: true, factura_id: 'f1', monto: 20000, perfil_id: 'u1' };
    supabaseAdmin.from = crearFalsoSupabase({
      payments: { row: pagoConfirmado },
    }).from;

    const resultado = await confirmarPago('p1');
    assert.equal(resultado.ok, true);
    assert.deepEqual(resultado.pago, pagoConfirmado);
  });

  await t.test('confirma el pago, guarda la fecha y los campos extra', async () => {
    const pagoPendiente = { id: 'p2', confirmado: false, factura_id: 'f2', monto: 30000, perfil_id: 'u2' };
    supabaseAdmin.from = crearFalsoSupabase({
      payments: { row: pagoPendiente },
    }).from;

    const resultado = await confirmarPago('p2', { estado_wompi: 'APPROVED', transaccion_id: 'tx-123' });
    assert.equal(resultado.ok, true);
    assert.equal(resultado.pago.confirmado, true);
    assert.ok(resultado.pago.fecha_confirmacion);
    assert.equal(resultado.pago.estado_wompi, 'APPROVED');
    assert.equal(resultado.pago.transaccion_id, 'tx-123');
  });

  await t.test('si el trigger rechaza el pago, devuelve el error y no lo reporta como éxito', async () => {
    const pagoPendiente = { id: 'p3', confirmado: false, factura_id: 'f3', monto: 10000, perfil_id: 'u3' };
    const mensajeTrigger = 'El monto (10000) no coincide con el valor de la factura (13300)';
    supabaseAdmin.from = crearFalsoSupabase({
      payments: { row: pagoPendiente, updateError: { message: mensajeTrigger } },
    }).from;

    const resultado = await confirmarPago('p3');
    assert.equal(resultado.ok, false);
    assert.equal(resultado.error, mensajeTrigger);
    assert.equal(resultado.pago, undefined);
  });
});