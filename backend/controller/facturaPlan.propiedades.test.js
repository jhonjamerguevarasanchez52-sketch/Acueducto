// Pruebas aleatorias de los endpoints de plan de pago con facturas de todo tipo:
// periodos antiguos, valores especiales, pagos en curso y meses ocupados.
const test = require('node:test');
const assert = require('node:assert/strict');

const invoiceModel = require('../models/invoiceModel');
const paymentModel = require('../models/paymentModel');
const supabaseAdmin = require('../config/supabaseAdminClient');
const { obtenerOpcionesPlanPago, configurarPlanPago } = require('./facturaController');
const { calcularPeriodosPlan } = require('../services/planPagoServicio');
const { cotizarWompi } = require('../utils/wompiTarifa');

const CASOS = 600;

function rng(semilla) {
  let s = semilla >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; };
}
const elegir = (r, lista) => lista[Math.floor(r() * lista.length)];

function respuesta() {
  return {
    statusCode: null, body: null,
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; return this; },
  };
}

function facturaAleatoria(r) {
  const meses = elegir(r, [1, 1, 1, 6, 12]);
  const periodo = elegir(r, ['2026-10', '2026-12', '2027-01', '2027-06', '09/10/2026', '2026 - Cuota']);
  const valido = /^\d{4}-(0[1-9]|1[0-2])$/.test(periodo);
  const especial = r() < 0.25;
  return {
    id: 'factura-1', perfil_id: 'perfil-1', periodo,
    periodo_inicio: valido ? periodo : periodo,
    periodo_fin: valido ? calcularPeriodosPlan(periodo, meses).periodoFin : periodo,
    meses_cubiertos: r() < 0.1 ? null : meses,
    tipo: elegir(r, ['servicio', 'servicio', 'prepago', 'extraordinaria']),
    estado: elegir(r, ['pendiente', 'pendiente', 'vencida', 'pagada', 'anulada']),
    valor_total: especial ? elegir(r, [15000, 20000, 200000, 13500]) : 12000 * meses,
  };
}

let originales;
test.before(() => {
  originales = {
    getOwn: invoiceModel.getOwn, listCoveredPeriods: invoiceModel.listCoveredPeriods,
    hasActiveByInvoice: paymentModel.hasActiveByInvoice, rpc: supabaseAdmin.rpc, error: console.error,
  };
  console.error = () => {};
});
test.after(() => {
  invoiceModel.getOwn = originales.getOwn;
  invoiceModel.listCoveredPeriods = originales.listCoveredPeriods;
  paymentModel.hasActiveByInvoice = originales.hasActiveByInvoice;
  supabaseAdmin.rpc = originales.rpc;
  console.error = originales.error;
});

for (let i = 0; i < CASOS; i++) {
  test(`caso aleatorio ${i + 1}`, async () => {
    const r = rng(9000 + i);
    const factura = facturaAleatoria(r);
    const pagoActivo = r() < 0.3;
    const ocupados = ['2026-11', '2027-02', '2027-07', '2027-09', '2028-01'].filter(() => r() < 0.2);
    let llamadasRpc = 0;
    invoiceModel.getOwn = async () => ({ data: { ...factura }, error: null });
    paymentModel.hasActiveByInvoice = async () => ({ data: pagoActivo, error: null });
    invoiceModel.listCoveredPeriods = async () => ({ data: ocupados.map((periodo) => ({ periodo })), error: null });
    supabaseAdmin.rpc = async (_n, p) => {
      llamadasRpc += 1;
      return { data: [{ ...factura, meses_cubiertos: p.p_meses, valor_total: 12000 * p.p_meses }], error: null };
    };
    const req = { params: { id: 'factura-1' }, usuario: { id: 'perfil-1' }, db: {} };

    const res = respuesta();
    await obtenerOpcionesPlanPago(req, res);
    assert.notEqual(res.statusCode, 500, `opciones con error inesperado: ${JSON.stringify(res.body)}`);

    const admite = ['pendiente', 'vencida'].includes(factura.estado) && ['servicio', 'prepago'].includes(factura.tipo);
    if (!admite) { assert.equal(res.statusCode, 409); return; }
    assert.equal(res.statusCode, 200);

    const mesesActuales = Number(factura.meses_cubiertos) || 1;
    const opciones = res.body.opciones;
    assert.ok(opciones.length >= 1);
    // Lo que se muestra para el plan actual es exactamente lo que cobrará Wompi.
    const actual = opciones.find((o) => o.meses === mesesActuales);
    assert.ok(actual, 'siempre se ofrece el plan actual');
    assert.equal(actual.totalCobrar, cotizarWompi(factura.valor_total).totalCobrar, 'total mostrado = total cobrado');
    assert.equal(actual.valorServicio, Number(factura.valor_total));

    const valido = /^\d{4}-(0[1-9]|1[0-2])$/.test(factura.periodo);
    const especial = factura.valor_total !== 12000 * mesesActuales;
    if (!valido || especial) {
      assert.equal(opciones.length, 1, 'factura antigua/especial: solo pagarla tal cual');
      assert.equal(res.body.puedeCambiarPlan, false);
      assert.ok(res.body.motivoSinPlanes);
    } else if (pagoActivo) {
      assert.equal(opciones.length, 1);
      assert.equal(res.body.puedeCambiarPlan, false);
    } else {
      assert.deepEqual(opciones.map((o) => o.meses), [1, 6, 12]);
      for (const o of opciones) {
        assert.equal(o.valorServicio, 12000 * o.meses);
        assert.equal(o.totalCobrar, cotizarWompi(12000 * o.meses).totalCobrar);
        const choca = o.periodos.some((p) => ocupados.includes(p));
        assert.equal(o.disponible, !choca, `disponibilidad ${o.meses}m`);
      }
    }

    // Elegir cualquier plan: nunca 500; el RPC solo corre si el cambio es válido.
    const meses = elegir(r, [1, 6, 12]);
    const res2 = respuesta();
    await configurarPlanPago({ ...req, body: { meses } }, res2);
    assert.notEqual(res2.statusCode, 500, `plan con error inesperado: ${JSON.stringify(res2.body)}`);
    if (meses === mesesActuales) {
      assert.equal(res2.statusCode, 200);
      assert.equal(llamadasRpc, 0, 'conservar el plan no modifica la factura');
      assert.equal(res2.body.cotizacionWompi.totalCobrar, actual.totalCobrar);
    } else if (!valido || especial || pagoActivo) {
      assert.equal(res2.statusCode, 409);
      assert.equal(llamadasRpc, 0);
    } else {
      assert.equal(res2.statusCode, 200);
      assert.equal(llamadasRpc, 1);
      assert.equal(res2.body.cotizacionWompi.totalCobrar, cotizarWompi(12000 * meses).totalCobrar);
    }
  });
}
