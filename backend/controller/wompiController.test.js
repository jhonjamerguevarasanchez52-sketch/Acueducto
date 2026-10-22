const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const ambienteOriginal = process.env.WOMPI_AMBIENTE;
const secretoOriginal = process.env.WOMPI_EVENTS_SECRET;
process.env.WOMPI_EVENTS_SECRET = 'test_events_webhook_unit';
process.env.WOMPI_AMBIENTE = 'test';

const paymentModel = require('../models/paymentModel');
const pagosService = require('../services/pagosService');
const comprobanteService = require('../services/comprobantePagoWompi');

const originales = {
  getById: paymentModel.getById,
  confirmarPago: pagosService.confirmarPago,
  enviarComprobante: comprobanteService.enviarComprobantePagoWompi,
};
let argumentosConfirmacion;
let enviosComprobante = 0;

paymentModel.getById = async () => ({
  data: {
    id: 'pago-unitario',
    monto: 12000,
    monto_total: 13251,
    confirmado: false,
    estado_wompi: 'PENDING',
    correo_comprobante_enviado_at: null,
  },
  error: null,
});
pagosService.confirmarPago = async (id, extra) => {
  argumentosConfirmacion = { id, extra };
  return { ok: true, pago: { id, confirmado: true, ...extra } };
};
comprobanteService.enviarComprobantePagoWompi = async (id) => {
  enviosComprobante += 1;
  assert.equal(id, 'pago-unitario');
  return { enviado: true };
};

const { webhook } = require('./wompiController');

function crearEventoAprobado() {
  const evento = {
    event: 'transaction.updated',
    environment: 'test',
    timestamp: 1792600000,
    data: {
      transaction: {
        id: 'wompi-tx-1',
        reference: 'pago-unitario',
        status: 'APPROVED',
        amount_in_cents: 1325100,
        currency: 'COP',
        payment_method_type: 'CARD',
      },
    },
    signature: {
      properties: [
        'transaction.id',
        'transaction.status',
        'transaction.amount_in_cents',
        'transaction.reference',
      ],
    },
  };
  const valores = evento.signature.properties.map((ruta) =>
    ruta.split('.').reduce((obj, clave) => obj?.[clave], evento.data)
  ).join('');
  evento.signature.checksum = crypto.createHash('sha256')
    .update(`${valores}${evento.timestamp}${process.env.WOMPI_EVENTS_SECRET}`)
    .digest('hex');
  return evento;
}

function crearRespuesta() {
  return {
    codigo: null,
    cuerpo: null,
    status(codigo) { this.codigo = codigo; return this; },
    json(cuerpo) { this.cuerpo = cuerpo; return this; },
  };
}

test('confirma el pago aprobado y envía el comprobante con el medio informado por Wompi', async (t) => {
  t.after(() => {
    paymentModel.getById = originales.getById;
    pagosService.confirmarPago = originales.confirmarPago;
    comprobanteService.enviarComprobantePagoWompi = originales.enviarComprobante;
    if (secretoOriginal === undefined) delete process.env.WOMPI_EVENTS_SECRET;
    else process.env.WOMPI_EVENTS_SECRET = secretoOriginal;
    if (ambienteOriginal === undefined) delete process.env.WOMPI_AMBIENTE;
    else process.env.WOMPI_AMBIENTE = ambienteOriginal;
  });

  argumentosConfirmacion = null;
  enviosComprobante = 0;
  const res = crearRespuesta();
  await webhook({ body: crearEventoAprobado() }, res);

  assert.equal(res.codigo, 200);
  assert.deepEqual(argumentosConfirmacion, {
    id: 'pago-unitario',
    extra: {
      metodo_confirmacion: 'wompi',
      estado_wompi: 'APPROVED',
      transaccion_id: 'wompi-tx-1',
      medio_pago_wompi: 'CARD',
    },
  });
  assert.equal(enviosComprobante, 1);

  // Una referencia que ya no existe no se puede corregir con reintentos del
  // proveedor; el webhook debe cerrarse como evento ignorado.
  paymentModel.getById = async () => ({
    data: null,
    error: { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' },
  });
  const eventoAntiguo = crearEventoAprobado();
  const resAntiguo = crearRespuesta();
  await webhook({ body: eventoAntiguo }, resAntiguo);
  assert.equal(resAntiguo.codigo, 200);
  assert.equal(resAntiguo.cuerpo.ignored, true);
});
