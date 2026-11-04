const test = require('node:test');
const assert = require('node:assert/strict');

const invoiceModel = require('../models/invoiceModel');
const paymentModel = require('../models/paymentModel');
const supabaseAdmin = require('../config/supabaseAdminClient');
const { misFacturas, obtenerOpcionesPlanPago, configurarPlanPago } = require('./facturaController');

function respuesta() {
  return {
    statusCode: null,
    body: null,
    status(statusCode) { this.statusCode = statusCode; return this; },
    json(body) { this.body = body; return this; },
  };
}

function facturaBase() {
  return {
    id: 'factura-1',
    perfil_id: 'perfil-1',
    periodo: '2026-10',
    periodo_inicio: '2026-10',
    meses_cubiertos: 1,
    tipo: 'servicio',
    valor_total: 12000,
    estado: 'pendiente',
  };
}

test('mis facturas incluye los movimientos Wompi ligados a cada factura propia', async (t) => {
  const originales = {
    listByProfileFacturas: invoiceModel.listByProfile,
    listByProfilePagos: paymentModel.listByProfile,
  };
  t.after(() => {
    invoiceModel.listByProfile = originales.listByProfileFacturas;
    paymentModel.listByProfile = originales.listByProfilePagos;
  });
  invoiceModel.listByProfile = async () => ({
    data: [{ id: 'factura-1', perfil_id: 'perfil-1', valor_total: 72000 }],
    error: null,
  });
  paymentModel.listByProfile = async (perfilId) => {
    assert.equal(perfilId, 'perfil-1');
    return {
      data: [{
        factura_id: 'factura-1',
        cargo_wompi: 3205,
        monto_total: 75205,
        transaccion_id: 'trx-123',
        medio_pago_wompi: 'PSE',
      }],
      error: null,
    };
  };

  const res = respuesta();
  await misFacturas({ usuario: { id: 'perfil-1' }, db: {} }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body[0].pagos[0].monto_total, 75205);
  assert.equal(res.body[0].pagos[0].transaccion_id, 'trx-123');
});

test('las opciones de factura muestran neto, cargo Wompi y siguiente periodo', async (t) => {
  const originales = {
    getOwn: invoiceModel.getOwn,
    hasActiveByInvoice: paymentModel.hasActiveByInvoice,
    listCoveredPeriods: invoiceModel.listCoveredPeriods,
  };
  t.after(() => {
    invoiceModel.getOwn = originales.getOwn;
    paymentModel.hasActiveByInvoice = originales.hasActiveByInvoice;
    invoiceModel.listCoveredPeriods = originales.listCoveredPeriods;
  });
  invoiceModel.getOwn = async () => ({ data: facturaBase(), error: null });
  paymentModel.hasActiveByInvoice = async () => ({ data: false, error: null });
  invoiceModel.listCoveredPeriods = async () => ({ data: [], error: null });

  const res = respuesta();
  await obtenerOpcionesPlanPago({
    params: { id: 'factura-1' },
    usuario: { id: 'perfil-1' },
    db: {},
  }, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.opciones.map((opcion) => opcion.totalCobrar), [13251, 75205, 149550]);
  assert.equal(res.body.opciones[1].periodoInicio, '2026-10');
  assert.equal(res.body.opciones[1].periodoFin, '2027-03');
  assert.equal(res.body.opciones[1].proximoPeriodo, '2027-04');
});

test('configura el semestre con el RPC transaccional y devuelve el detalle del plan', async (t) => {
  const originales = {
    getOwn: invoiceModel.getOwn,
    hasActiveByInvoice: paymentModel.hasActiveByInvoice,
    rpc: supabaseAdmin.rpc,
  };
  t.after(() => {
    invoiceModel.getOwn = originales.getOwn;
    paymentModel.hasActiveByInvoice = originales.hasActiveByInvoice;
    supabaseAdmin.rpc = originales.rpc;
  });
  invoiceModel.getOwn = async () => ({ data: facturaBase(), error: null });
  paymentModel.hasActiveByInvoice = async () => ({ data: false, error: null });
  let parametrosRpc;
  supabaseAdmin.rpc = async (nombre, parametros) => {
    assert.equal(nombre, 'configurar_plan_factura');
    parametrosRpc = parametros;
    return {
      data: [{ ...facturaBase(), tipo: 'prepago', meses_cubiertos: 6, periodo_fin: '2027-03', valor_total: 72000 }],
      error: null,
    };
  };

  const res = respuesta();
  await configurarPlanPago({
    params: { id: 'factura-1' },
    usuario: { id: 'perfil-1' },
    body: { meses: 6 },
    db: {},
  }, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(parametrosRpc, {
    p_factura_id: 'factura-1',
    p_perfil_id: 'perfil-1',
    p_meses: 6,
  });
  assert.equal(res.body.factura.valor_total, 72000);
  assert.equal(res.body.plan.fechaProximaFacturacion, '2027-05-01');
  assert.equal(res.body.cotizacionWompi.totalCobrar, 75205);
});

test('rechaza meses no permitidos y no cambia facturas con intentos de pago', async (t) => {
  const originales = {
    getOwn: invoiceModel.getOwn,
    hasActiveByInvoice: paymentModel.hasActiveByInvoice,
    rpc: supabaseAdmin.rpc,
  };
  t.after(() => {
    invoiceModel.getOwn = originales.getOwn;
    paymentModel.hasActiveByInvoice = originales.hasActiveByInvoice;
    supabaseAdmin.rpc = originales.rpc;
  });

  const invalido = respuesta();
  await configurarPlanPago({
    params: { id: 'factura-1' }, usuario: { id: 'perfil-1' }, body: { meses: 3 },
  }, invalido);
  assert.equal(invalido.statusCode, 400);

  invoiceModel.getOwn = async () => ({ data: facturaBase(), error: null });
  paymentModel.hasActiveByInvoice = async () => ({ data: true, error: null });
  supabaseAdmin.rpc = async () => assert.fail('No debe cambiarse una factura con pagos');
  const conflict = respuesta();
  await configurarPlanPago({
    params: { id: 'factura-1' },
    usuario: { id: 'perfil-1' },
    body: { meses: 6 },
    db: {},
  }, conflict);
  assert.equal(conflict.statusCode, 409);
});

test('marca como no disponible un plan que pisa un mes ya facturado', async (t) => {
  const originales = {
    getOwn: invoiceModel.getOwn,
    hasActiveByInvoice: paymentModel.hasActiveByInvoice,
    listCoveredPeriods: invoiceModel.listCoveredPeriods,
  };
  t.after(() => {
    invoiceModel.getOwn = originales.getOwn;
    paymentModel.hasActiveByInvoice = originales.hasActiveByInvoice;
    invoiceModel.listCoveredPeriods = originales.listCoveredPeriods;
  });
  invoiceModel.getOwn = async () => ({ data: facturaBase(), error: null });
  paymentModel.hasActiveByInvoice = async () => ({ data: false, error: null });
  let rango;
  invoiceModel.listCoveredPeriods = async (perfilId, filtros) => {
    rango = { perfilId, ...filtros };
    return { data: [{ periodo: '2027-02', invoice_id: 'otra' }], error: null };
  };

  const res = respuesta();
  await obtenerOpcionesPlanPago({ params: { id: 'factura-1' }, usuario: { id: 'perfil-1' }, db: {} }, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(rango, {
    perfilId: 'perfil-1', desde: '2026-10', hasta: '2027-09', exceptoFacturaId: 'factura-1',
  });
  assert.deepEqual(res.body.opciones.map((opcion) => opcion.disponible), [true, false, false]);
  assert.match(res.body.opciones[1].motivoNoDisponible, /factura aparte de febrero de 2027/);
});

test('un intento rechazado no bloquea elegir otro plan (solo pagos activos)', async (t) => {
  const originales = {
    getOwn: invoiceModel.getOwn,
    hasActiveByInvoice: paymentModel.hasActiveByInvoice,
    listCoveredPeriods: invoiceModel.listCoveredPeriods,
  };
  t.after(() => {
    invoiceModel.getOwn = originales.getOwn;
    paymentModel.hasActiveByInvoice = originales.hasActiveByInvoice;
    invoiceModel.listCoveredPeriods = originales.listCoveredPeriods;
  });
  invoiceModel.getOwn = async () => ({ data: { ...facturaBase(), estado: 'vencida' }, error: null });
  paymentModel.hasActiveByInvoice = async () => ({ data: false, error: null });
  invoiceModel.listCoveredPeriods = async () => ({ data: [], error: null });

  const res = respuesta();
  await obtenerOpcionesPlanPago({ params: { id: 'factura-1' }, usuario: { id: 'perfil-1' }, db: {} }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.puedeCambiarPlan, true);
  assert.equal(res.body.opciones.length, 3);
});
