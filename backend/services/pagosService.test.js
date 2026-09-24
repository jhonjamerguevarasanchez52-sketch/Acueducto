const test = require('node:test');
const assert = require('node:assert/strict');

const supabaseAdmin = require('../config/supabaseAdminClient');
const { confirmarPago } = require('./pagosService');

/**
 * Cliente de Supabase simulado, suficiente para las cadenas que usan
 * confirmarPago() y notificar(): from().select().eq().single(),
 * from().update().eq().select().single() y from().update().eq() (sin
 * select, se resuelve directamente al hacer await).
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

  await t.test('confirma el pago y marca la factura como pagada', async () => {
    const pagoPendiente = { id: 'p2', confirmado: false, factura_id: 'f2', monto: 30000, perfil_id: 'u2' };
    supabaseAdmin.from = crearFalsoSupabase({
      payments: { row: pagoPendiente },
      invoices: { row: { id: 'f2', estado: 'pendiente' } },
      notifications: {},
    }).from;

    const resultado = await confirmarPago('p2', { metodo_confirmacion: 'manual' });
    assert.equal(resultado.ok, true);
    assert.equal(resultado.pago.confirmado, true);
    assert.equal(resultado.pago.metodo_confirmacion, 'manual');
  });

  await t.test('si falla marcar la factura como pagada, no lo reporta como éxito', async () => {
    const pagoPendiente = { id: 'p3', confirmado: false, factura_id: 'f3', monto: 10000, perfil_id: 'u3' };
    supabaseAdmin.from = crearFalsoSupabase({
      payments: { row: pagoPendiente },
      invoices: { updateError: { message: 'timeout' } },
    }).from;

    const resultado = await confirmarPago('p3');
    assert.equal(resultado.ok, false);
    assert.match(resultado.error, /no se pudo actualizar la factura/);
    // El pago sí quedó confirmado: el dinero se recibió, aunque haya que
    // corregir la factura a mano.
    assert.equal(resultado.pago.confirmado, true);
  });
});
