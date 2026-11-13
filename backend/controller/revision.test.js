// Regresiones de la revisión del 9-nov-2026: pagos de Wompi, facturas con
// pagos en curso, facturación de cuentas nuevas, tarifas, contraseña temporal
// y zonas.
const test = require('node:test');
const assert = require('node:assert/strict');

const paymentModel = require('../models/paymentModel');
const invoiceModel = require('../models/invoiceModel');
const profileModel = require('../models/profileModel');
const {
  checkoutAbandonado,
  confirmarPagoManual,
  eliminarPago,
  registrarPagoFisicoConRecibo,
} = require('./pagoController');
const { actualizarFactura, generarFacturasMensuales } = require('./facturaController');
const { validarCuota, validarTarifa } = require('./tarifaController');
const { rutaPermitidaConClaveTemporal } = require('../middleware/authMiddleware');
const { generarFacturasMensuales: facturar } = require('../services/facturacionMensual');

function respuesta() {
  return {
    statusCode: null, body: null,
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; return this; },
  };
}

function reemplazar(t, objeto, cambios) {
  const originales = Object.fromEntries(Object.keys(cambios).map((k) => [k, objeto[k]]));
  Object.assign(objeto, cambios);
  t.after(() => Object.assign(objeto, originales));
}

function silenciar(t) {
  const original = console.error;
  console.error = () => {};
  t.after(() => { console.error = original; });
}

const admin = { id: null, rol: 'administrador' }; // sin id: no escribe auditoría

test('un checkout de Wompi se considera abandonado solo sin transacción y tras 30 minutos', () => {
  const ahora = Date.parse('2026-11-09T12:00:00Z');
  const base = { metodo: 'wompi', estado_wompi: 'PENDING', transaccion_id: null };
  assert.equal(checkoutAbandonado({ ...base, fecha_pago: '2026-11-09T11:00:00Z' }, ahora), true);
  assert.equal(checkoutAbandonado({ ...base, fecha_pago: '2026-11-09T11:45:00Z' }, ahora), false);
  assert.equal(checkoutAbandonado({ ...base, transaccion_id: 't1', fecha_pago: '2026-11-09T11:00:00Z' }, ahora), false);
  assert.equal(checkoutAbandonado({ ...base, metodo: 'fisico', fecha_pago: '2026-11-09T11:00:00Z' }, ahora), false);
});

test('un pago de Wompi no se puede confirmar a mano', async (t) => {
  let confirmados = 0;
  reemplazar(t, paymentModel, {
    findById: async () => ({ data: { id: 'p1', confirmado: false, metodo: 'wompi', estado_wompi: 'PENDING' }, error: null }),
    update: async () => { confirmados += 1; return { data: {}, error: null }; },
  });
  const res = respuesta();
  await confirmarPagoManual({ params: { id: 'p1' }, usuario: admin }, res);
  assert.equal(res.statusCode, 409);
  assert.match(res.body.error, /Wompi/);
  assert.equal(confirmados, 0);
});

test('tampoco se confirma un intento rechazado o reemplazado', async (t) => {
  reemplazar(t, paymentModel, {
    findById: async () => ({ data: { id: 'p1', confirmado: false, metodo: 'fisico', estado_wompi: 'SUPERSEDED' }, error: null }),
  });
  const res = respuesta();
  await confirmarPagoManual({ params: { id: 'p1' }, usuario: admin }, res);
  assert.equal(res.statusCode, 409);
});

test('un recibo físico pendiente sí se confirma', async (t) => {
  const pago = { id: 'p1', confirmado: false, metodo: 'fisico', estado_wompi: null };
  reemplazar(t, paymentModel, {
    findById: async () => ({ data: pago, error: null }),
    getById: async () => ({ data: pago, error: null }),
    update: async (id, cambios) => ({ data: { ...pago, ...cambios }, error: null }),
  });
  const res = respuesta();
  await confirmarPagoManual({ params: { id: 'p1' }, usuario: admin }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.pago.confirmado, true);
});

test('eliminar pagos de Wompi nunca borra un checkout que aún pueda cobrarse', async (t) => {
  silenciar(t);
  let borrados = 0;
  const actualizaciones = [];
  let pago;
  reemplazar(t, paymentModel, {
    getById: async () => ({ data: pago, error: null }),
    remove: async () => { borrados += 1; return { data: pago, error: null }; },
    update: async (id, cambios) => { actualizaciones.push(cambios); return { data: { ...pago, ...cambios }, error: null }; },
  });
  const ejecutar = async (body = {}) => {
    const res = respuesta();
    await eliminarPago({ params: { id: 'p1' }, body, usuario: admin }, res);
    return res;
  };
  const viejo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  const reciente = new Date().toISOString();

  // En curso: no se toca.
  pago = { id: 'p1', confirmado: false, metodo: 'wompi', estado_wompi: 'PENDING', transaccion_id: null, fecha_pago: reciente };
  assert.equal((await ejecutar()).statusCode, 409);

  // Abandonado: se marca reemplazado, no se borra.
  pago = { ...pago, fecha_pago: viejo };
  let res = await ejecutar();
  assert.equal(res.statusCode, 200);
  assert.deepEqual(actualizaciones.pop(), { estado_wompi: 'SUPERSEDED' });

  // Cobrado sin aplicar: exige confirmar la devolución.
  pago = { ...pago, estado_wompi: 'APPROVED_NO_APLICADO', transaccion_id: 't1' };
  res = await ejecutar();
  assert.equal(res.statusCode, 409);
  assert.equal(res.body.requiereReembolso, true);
  res = await ejecutar({ reembolsado: true });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(actualizaciones.pop(), { estado_wompi: 'REEMBOLSADO' });

  // Rechazado por Wompi: no hubo cobro, se puede borrar.
  pago = { ...pago, estado_wompi: 'DECLINED' };
  assert.equal((await ejecutar()).statusCode, 200);

  assert.equal(borrados, 1);
});

test('un checkout abandonado no impide enviar el recibo físico', async (t) => {
  silenciar(t);
  const recibosPagoService = require('../services/recibosPagoService');
  let liberado = false;
  reemplazar(t, invoiceModel, {
    getOwn: async () => ({ data: { id: 'f1', perfil_id: 'u1', valor_total: 12000, estado: 'pendiente' }, error: null }),
  });
  reemplazar(t, paymentModel, {
    supersedeAbandonedCheckouts: async () => { liberado = true; return { error: null }; },
    findPendingByInvoice: async () => ({ data: liberado ? null : { metodo: 'wompi' }, error: null }),
    create: async (datos) => ({ data: { id: 'p2', ...datos }, error: null }),
  });
  reemplazar(t, recibosPagoService, {
    subirRecibo: async () => ({ path: 'u1/f1/x.jpg', error: null }),
  });
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]);
  const res = respuesta();
  await registrarPagoFisicoConRecibo({
    usuario: { id: 'u1' }, params: { facturaId: 'f1' }, body: jpeg,
    headers: { 'content-type': 'image/jpeg' }, db: {},
  }, res);
  assert.equal(liberado, true);
  assert.equal(res.statusCode, 201);
});

test('no se cambia el valor ni se anula una factura con un pago en curso', async (t) => {
  let actualizaciones = 0;
  reemplazar(t, invoiceModel, {
    getState: async () => ({ data: { id: 'f1', estado: 'pendiente', valor_total: 12000, observacion: null }, error: null }),
    update: async (id, cambios) => { actualizaciones += 1; return { data: { id, ...cambios }, error: null }; },
  });
  reemplazar(t, paymentModel, { hasActiveByInvoice: async () => ({ data: true, error: null }) });
  const req = (body) => ({ params: { id: 'f1' }, body, usuario: admin });

  let res = respuesta();
  await actualizarFactura(req({ valor_total: 15000 }), res);
  assert.equal(res.statusCode, 409);
  res = respuesta();
  await actualizarFactura(req({ estado: 'anulada' }), res);
  assert.equal(res.statusCode, 409);
  assert.equal(actualizaciones, 0);

  // El panel manda el formulario completo: si el valor no cambia, una nota sí se guarda.
  res = respuesta();
  await actualizarFactura(req({ estado: 'pendiente', valor_total: 12000, observacion: 'Llamar' }), res);
  assert.equal(res.statusCode, 200);
  assert.equal(actualizaciones, 1);
});

test('no se facturan meses en curso ni futuros desde el panel', async () => {
  const res = respuesta();
  await generarFacturasMensuales({ body: { periodo: '2999-01' }, usuario: admin }, res);
  assert.equal(res.statusCode, 400);
  assert.match(res.body.error, /ya terminaron/);
});

test('la facturación omite las cuentas creadas después del periodo', async () => {
  const creadas = [];
  const db = {
    from() {
      const q = {
        select() { return q; }, eq() { return q; }, neq() { return q; }, update() { return q; },
        then(ok, mal) { return Promise.resolve({ data: [], error: null }).then(ok, mal); },
      };
      return q;
    },
    async rpc(nombre, p) {
      creadas.push(p.p_perfil_id);
      return { data: [{ id: `f-${p.p_perfil_id}`, valor_total: p.p_valor_total, generada_automaticamente: true }], error: null };
    },
  };
  const resumen = await facturar({
    periodo: '2026-10',
    db,
    obtenerValorMensual: async () => ({ valor: 12000, origen: 'tarifa' }),
    obtenerPerfilesActivos: async () => ({
      data: [
        { id: 'antiguo', correo: 'a@x.co', created_at: '2026-03-01T10:00:00Z' },
        // 31-oct 11 p. m. en Colombia (1-nov en UTC): sigue siendo de octubre.
        { id: 'fin-de-mes', correo: 'b@x.co', created_at: '2026-11-01T04:00:00Z' },
        { id: 'nuevo', correo: 'c@x.co', created_at: '2026-11-03T15:00:00Z' },
      ],
      error: null,
    }),
    enviarCorreo: async () => ({ ok: true }),
  });
  assert.deepEqual(creadas, ['antiguo', 'fin-de-mes']);
  assert.equal(resumen.usuariosPosteriores, 1);
});

test('las tarifas exigen cuota entera positiva y vigencias coherentes', () => {
  assert.match(validarCuota(0), /mayor que cero/);
  assert.match(validarCuota(-1), /mayor que cero/);
  assert.match(validarCuota(12500.5), /sin centavos/);
  assert.equal(validarCuota('15000'), null);
  assert.match(validarTarifa({ tipo: 'vip' }), /Tipo/);
  assert.match(validarTarifa({ vigente_desde: '2026-02-30' }), /no es válida/);
  assert.match(validarTarifa({ vigente_desde: '2026-05-01', vigente_hasta: '2026-04-30' }), /anterior/);
  assert.match(validarTarifa({ vigente_hasta: '2026-01-01' }, { vigente_desde: '2026-06-01' }), /anterior/);
  assert.equal(validarTarifa({ tipo: 'residencial', vigente_desde: '2026-01-01', vigente_hasta: '' }), null);
});

test('con contraseña temporal solo se permite ver el perfil y cambiarla', () => {
  const req = (method, baseUrl, path) => ({ method, baseUrl, path });
  assert.equal(rutaPermitidaConClaveTemporal(req('GET', '/api/profile', '/mi-perfil')), true);
  assert.equal(rutaPermitidaConClaveTemporal(req('POST', '/api/auth', '/cambiar-password')), true);
  assert.equal(rutaPermitidaConClaveTemporal(req('PUT', '/api/profile', '/mi-perfil')), false);
  assert.equal(rutaPermitidaConClaveTemporal(req('GET', '/api/facturas', '/')), false);
});

test('las zonas se comparan sin mayúsculas, tildes ni espacios de más', () => {
  assert.equal(profileModel.normalizarZona('  Vereda   Álta '), profileModel.normalizarZona('vereda alta'));
  assert.notEqual(profileModel.normalizarZona('Centro'), profileModel.normalizarZona('Centro Norte'));
});
