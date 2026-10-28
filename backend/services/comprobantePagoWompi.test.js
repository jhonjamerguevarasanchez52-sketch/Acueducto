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
  assert.match(correoCapturado.subject, /Factura N.º 47 pagada/);
  assert.match(correoCapturado.html, /Servicio del acueducto/);
  assert.match(correoCapturado.html, /\$12\.000 COP/);
  assert.match(correoCapturado.html, /\$1\.251 COP/);
  assert.match(correoCapturado.html, /\$13\.251 COP/);
  assert.match(correoCapturado.html, /&lt;cargo especial&gt;/);
  assert.ok(pago.correo_comprobante_enviado_at);
});

test('el comprobante de un semestre lista cada mes pagado y la próxima factura', () => {
  const { construirHtml } = require('./comprobantePagoWompi');
  const html = construirHtml({
    pago: {
      id: 'pago-6', monto: 72000, cargo_wompi: 3205, monto_total: 75205,
      transaccion_id: 'tx-6', medio_pago_wompi: 'PSE', fecha_confirmacion: '2026-11-03T15:00:00.000Z',
    },
    factura: {
      id: 'factura-6', numero_factura: 41, tipo: 'prepago', periodo: '2026-10',
      periodo_inicio: '2026-10', periodo_fin: '2027-03', meses_cubiertos: 6,
      valor_total: 72000, fecha_proxima_facturacion: '2027-05-01',
    },
    perfil: { nombre: 'Ana' },
  });

  assert.match(html, /octubre de 2026 a marzo de 2027/);
  assert.match(html, /Semestral \(6 mensualidades\)/);
  assert.equal((html.match(/data-concepto="mensualidad"/g) || []).length, 6, 'una línea por mes pagado');
  assert.match(html, /PAGADA/);
  assert.match(html, /FACTURADO A/);
  assert.match(html, /Factura N\.º/);
  assert.match(html, /febrero de 2027/);
  assert.match(html, /\$12\.000 COP/);
  assert.match(html, /\$72\.000 COP/);
  assert.match(html, /\$75\.205 COP/);
  assert.match(html, /Próxima factura:<\/strong> abril de 2027, se genera el 1 de mayo de 2027/);
  assert.match(html, /Mientras tu plan esté vigente no recibirás facturas mensuales/);
});
