const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const invoiceModel = require('../models/invoiceModel');
const paymentModel = require('../models/paymentModel');
const { registrarPago } = require('./pagoController');

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
  const integrityKeyOriginal = process.env.WOMPI_INTEGRITY_KEY;

  t.after(() => {
    invoiceModel.getOwn = funcionesOriginales.getOwn;
    paymentModel.findPendingByInvoice = funcionesOriginales.findPendingByInvoice;
    paymentModel.create = funcionesOriginales.create;
    if (integrityKeyOriginal === undefined) delete process.env.WOMPI_INTEGRITY_KEY;
    else process.env.WOMPI_INTEGRITY_KEY = integrityKeyOriginal;
  });

  const factura = {
    id: 'factura-1',
    perfil_id: 'perfil-1',
    valor_total: 12500,
    estado: 'pendiente',
  };
  const pagoNuevo = { id: 'pago-nuevo', monto: factura.valor_total, metodo: 'wompi' };
  let pagoPendiente = null;
  let cantidadCreaciones = 0;

  invoiceModel.getOwn = async () => ({ data: factura, error: null });
  paymentModel.findPendingByInvoice = async () => ({ data: pagoPendiente, error: null });
  paymentModel.create = async () => {
    cantidadCreaciones += 1;
    return { data: pagoNuevo, error: null };
  };
  process.env.WOMPI_INTEGRITY_KEY = 'integrity-test-secret';

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
    const firmaEsperada = crypto
      .createHash('sha256')
      .update('pago-nuevo1250000COPintegrity-test-secret')
      .digest('hex');

    assert.equal(res.codigo, 201);
    assert.equal(cantidadCreaciones, 1);
    assert.equal(res.cuerpo.wompi.reference, pagoNuevo.id);
    assert.equal(res.cuerpo.wompi.amountInCents, 1250000);
    assert.equal(res.cuerpo.wompi.signature, firmaEsperada);
  });

  await t.test('reanuda un checkout Wompi sin crear otro pago', async () => {
    pagoPendiente = {
      id: 'pago-reanudable',
      monto: factura.valor_total,
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

  await t.test('no crea un pago si falta la llave de integridad', async () => {
    delete process.env.WOMPI_INTEGRITY_KEY;
    cantidadCreaciones = 0;
    const res = await solicitarPago();

    assert.equal(res.codigo, 503);
    assert.equal(cantidadCreaciones, 0);
  });
});