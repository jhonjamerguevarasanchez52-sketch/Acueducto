const test = require('node:test');
const assert = require('node:assert/strict');

const paymentModel = require('../models/paymentModel');
const invoiceModel = require('../models/invoiceModel');
const profileModel = require('../models/profileModel');
const mailer = require('../config/mailer');
const { enviarComprobantePagoWompi } = require('./comprobantePagoWompi');

test('envía el comprobante detallado una vez y deja marca para los reintentos', async (t) => {
  const originales = {
    getById: paymentModel.getById,
    update: paymentModel.update,
    getOwn: invoiceModel.getOwn,
    profileGetById: profileModel.getById,
    enviarCorreo: mailer.enviarCorreo,
  };
  t.after(() => {
    paymentModel.getById = originales.getById;
    paymentModel.update = originales.update;
    invoiceModel.getOwn = originales.getOwn;
    profileModel.getById = originales.profileGetById;
    mailer.enviarCorreo = originales.enviarCorreo;
  });

  let pago = {
    id: 'pago-1',
    factura_id: 'factura-1',
    perfil_id: 'perfil-1',
    monto: 12000,
    cargo_wompi: 1251,
    monto_total: 13251,
    metodo: 'wompi',
    medio_pago_wompi: 'CARD',
    transaccion_id: 'tx-1',
    confirmado: true,
    estado_wompi: 'APPROVED',
    fecha_confirmacion: '2026-10-21T12:00:00.000Z',
    correo_comprobante_enviado_at: null,
  };
  let envios = 0;
  let correoCapturado;

  paymentModel.getById = async () => ({ data: pago, error: null });
  paymentModel.update = async (_id, cambios) => {
    pago = { ...pago, ...cambios };
    return { data: pago, error: null };
  };
  invoiceModel.getOwn = async () => ({
    data: {
      id: 'factura-1',
      numero_factura: 47,
      periodo: '2026-09',
      valor_total: 12000,
      observacion: '<cargo especial>',
    },
    error: null,
  });
  profileModel.getById = async () => ({
    data: { id: 'perfil-1', nombre: 'Ana', apellido: 'Pérez', correo: 'ana@example.com' },
    error: null,
  });
  mailer.enviarCorreo = async (correo) => {
    envios += 1;
    correoCapturado = correo;
    return { messageId: 'correo-1' };
  };

  const primero = await enviarComprobantePagoWompi('pago-1');
  const segundo = await enviarComprobantePagoWompi('pago-1');

  assert.deepEqual(primero, { enviado: true, correo: 'ana@example.com' });
  assert.deepEqual(segundo, { enviado: false, yaEnviado: true });
  assert.equal(envios, 1);
  assert.match(correoCapturado.subject, /factura 47/);
  assert.match(correoCapturado.html, /Servicio del acueducto/);
  assert.match(correoCapturado.html, /\$12\.000 COP/);
  assert.match(correoCapturado.html, /\$1\.251 COP/);
  assert.match(correoCapturado.html, /\$13\.251 COP/);
  assert.match(correoCapturado.html, /&lt;cargo especial&gt;/);
  assert.ok(pago.correo_comprobante_enviado_at);
});
