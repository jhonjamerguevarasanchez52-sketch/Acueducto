const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const invoiceModel = require('../models/invoiceModel');
const paymentModel = require('../models/paymentModel');
const { registrarPago } = require('./pagoController');
const { cotizarWompi } = require('../utils/wompiTarifa');

function crearRespuesta() {
  return {
    codigo: null,
    cuerpo: null,
    status(codigo) {
      this.codigo = codigo;
      return this;
    },
    json(cuerpo) {
      this.cuerpo = cuerpo;
      return this;
    },
  };
}

test('registrarPago con Wompi', async (t) => {
  const funcionesOriginales = {
    getOwn: invoiceModel.getOwn,
    findPendingByInvoice: paymentModel.findPendingByInvoice,
    create: paymentModel.create,
  };
  const variablesOriginales = Object.fromEntries(
    ['WOMPI_PUBLIC_KEY', 'WOMPI_INTEGRITY_KEY', 'WOMPI_EVENTS_SECRET'].map((key) => [key, process.env[key]])
  );

  t.after(() => {
    invoiceModel.getOwn = funcionesOriginales.getOwn;
    paymentModel.findPendingByInvoice = funcionesOriginales.findPendingByInvoice;
    paymentModel.create = funcionesOriginales.create;
    for (const [key, value] of Object.entries(variablesOriginales)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  const factura = {
    id: 'factura-1',
    perfil_id: 'perfil-1',
    valor_total: 12500,
    estado: 'pendiente',
  };
  const cotizacion = cotizarWompi(factura.valor_total);
  const pagoNuevo = { id: 'pago-nuevo', monto: factura.valor_total, metodo: 'wompi' };
  let pagoPendiente = null;
  let cantidadCreaciones = 0;

  invoiceModel.getOwn = async () => ({ data: factura, error: null });
  paymentModel.findPendingByInvoice = async () => ({ data: pagoPendiente, error: null });
  paymentModel.create = async () => {
    cantidadCreaciones += 1;
    return { data: pagoNuevo, error: null };
  };
  process.env.WOMPI_PUBLIC_KEY = 'pub_test_demo';
  process.env.WOMPI_INTEGRITY_KEY = 'test_integrity_demo';
  process.env.WOMPI_EVENTS_SECRET = 'test_events_demo';

  async function solicitarPago(metodo = 'wompi') {
    const res = crearRespuesta();
    await registrarPago({
      usuario: { id: factura.perfil_id },
      body: { factura_id: factura.id, metodo },
      db: {},
    }, res);
    return res;
  }

  await t.test('genera la firma con el monto real de la factura', async () => {
    pagoPendiente = null;
    cantidadCreaciones = 0;
    const res = await solicitarPago();
    const amountInCents = Math.round(cotizacion.totalCobrar * 100);
    const firmaEsperada = crypto
      .createHash('sha256')
      .update(`pago-nuevo${amountInCents}COPtest_integrity_demo`)
      .digest('hex');

    assert.equal(res.codigo, 201);
    assert.equal(cantidadCreaciones, 1);
    assert.equal(res.cuerpo.wompi.reference, pagoNuevo.id);
    assert.equal(res.cuerpo.wompi.amountInCents, amountInCents);
    assert.equal(res.cuerpo.wompi.valorServicio, cotizacion.valorServicio);
    assert.equal(res.cuerpo.wompi.cargoWompi, cotizacion.cargoWompi);
    assert.equal(res.cuerpo.wompi.totalCobrar, cotizacion.totalCobrar);
    assert.equal(res.cuerpo.wompi.signature, firmaEsperada);
  });

  await t.test('reanuda un checkout Wompi sin crear otro pago', async () => {
    pagoPendiente = {
      id: 'pago-reanudable',
      monto: factura.valor_total,
      cargo_wompi: cotizacion.cargoWompi,
      metodo: 'wompi',
      estado_wompi: null,
    };
    cantidadCreaciones = 0;
    const res = await solicitarPago();

    assert.equal(res.codigo, 201);
    assert.equal(cantidadCreaciones, 0);
    assert.equal(res.cuerpo.wompi.reference, pagoPendiente.id);
  });

  await t.test('permite un nuevo intento después de un rechazo', async () => {
    pagoPendiente = {
      id: 'pago-rechazado',
      monto: factura.valor_total,
      metodo: 'wompi',
      estado_wompi: 'DECLINED',
    };
    cantidadCreaciones = 0;
    const res = await solicitarPago();

    assert.equal(res.codigo, 201);
    assert.equal(cantidadCreaciones, 1);
    assert.equal(res.cuerpo.wompi.reference, pagoNuevo.id);
  });

  await t.test('no reanuda checkout si cambió el monto de la factura', async () => {
    pagoPendiente = {
      id: 'pago-monto-anterior',
      monto: 10000,
      metodo: 'wompi',
      estado_wompi: null,
    };
    cantidadCreaciones = 0;
    const res = await solicitarPago();

    assert.equal(res.codigo, 409);
    assert.equal(cantidadCreaciones, 0);
  });

  await t.test('no duplica pagos con otro método aún pendiente', async () => {
    pagoPendiente = {
      id: 'pago-manual',
      metodo: 'efectivo',
      estado_wompi: null,
    };
    cantidadCreaciones = 0;
    const res = await solicitarPago();

    assert.equal(res.codigo, 409);
    assert.equal(cantidadCreaciones, 0);
  });

  await t.test('reutiliza el pago creado por una solicitud concurrente', async () => {
    pagoPendiente = null;
    cantidadCreaciones = 0;
    const pagoConcurrente = {
      id: 'pago-concurrente',
      monto: factura.valor_total,
      cargo_wompi: cotizacion.cargoWompi,
      metodo: 'wompi',
      estado_wompi: 'PENDING',
    };
    paymentModel.create = async () => {
      cantidadCreaciones += 1;
      pagoPendiente = pagoConcurrente;
      return { data: null, error: { code: '23505', message: 'duplicate key' } };
    };

    const res = await solicitarPago();

    assert.equal(res.codigo, 201);
    assert.equal(cantidadCreaciones, 1);
    assert.equal(res.cuerpo.wompi.reference, pagoConcurrente.id);
  });

  await t.test('no crea un pago si falta la llave de integridad', async () => {
    paymentModel.create = async () => {
      cantidadCreaciones += 1;
      return { data: pagoNuevo, error: null };
    };
    pagoPendiente = null;
    delete process.env.WOMPI_INTEGRITY_KEY;
    cantidadCreaciones = 0;
    const res = await solicitarPago();

    assert.equal(res.codigo, 503);
    assert.equal(cantidadCreaciones, 0);
  });
});
