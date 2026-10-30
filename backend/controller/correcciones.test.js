// Regresiones de los errores encontrados en la auditoría de punta a punta.
const test = require('node:test');
const assert = require('node:assert/strict');

const invoiceModel = require('../models/invoiceModel');
const paymentModel = require('../models/paymentModel');
const notificationModel = require('../models/notificationModel');
const recibosPagoService = require('../services/recibosPagoService');
const { errorConsulta } = require('../utils/httpErrores');
const { extraerCambiosPerfil } = require('../utils/perfilCampos');
const { actualizarFactura } = require('./facturaController');
const { registrarPagoFisicoConRecibo } = require('./pagoController');
const { eliminarNotificacion } = require('./notificacionController');

function respuesta() {
  return {
    statusCode: null, body: null,
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; return this; },
  };
}

function silenciar(t) {
  const original = console.error;
  console.error = () => {};
  t.after(() => { console.error = original; });
}

test('errores de datos de Postgres se responden 4xx, no 500', (t) => {
  silenciar(t);
  const casos = { '22P02': 400, '22001': 400, '23502': 400, '23503': 409, '23505': 409, '23514': 400 };
  for (const [code, status] of Object.entries(casos)) {
    const res = respuesta();
    errorConsulta(res, { code, message: 'detalle interno de postgres' });
    assert.equal(res.statusCode, status, code);
    assert.ok(!res.body.error.includes('postgres'), 'no filtra el detalle interno');
  }
  const res = respuesta();
  errorConsulta(res, { code: '08006', message: 'conexión caída' });
  assert.equal(res.statusCode, 500, 'un fallo real del servidor sigue siendo 500');
});

test('perfil: solo acepta texto, recorta y no deja vaciar nombre ni apellido', () => {
  assert.deepEqual(extraerCambiosPerfil({ telefono: ' 300 ', zona: null, rol: 'administrador' }).cambios, { telefono: '300', zona: null });
  assert.equal(extraerCambiosPerfil({ telefono: 3001234567 }).cambios.telefono, '3001234567');
  assert.match(extraerCambiosPerfil({ zona: ['x'] }).error, /zona debe ser texto/);
  assert.match(extraerCambiosPerfil({ nombre: { a: 1 } }).error, /nombre debe ser texto/);
  assert.match(extraerCambiosPerfil({ nombre: '   ' }).error, /nombre no puede quedar vacío/);
  assert.match(extraerCambiosPerfil({ apellido: null }).error, /apellido/);
  assert.match(extraerCambiosPerfil({ direccion: 'x'.repeat(151) }).error, /máximo 150/);
  assert.deepEqual(extraerCambiosPerfil({}).cambios, {});
});

test('actualizar factura distingue no encontrada, conflicto y valor inválido', async (t) => {
  silenciar(t);
  const original = invoiceModel.update;
  t.after(() => { invoiceModel.update = original; });
  const req = (body) => ({ params: { id: 'f1' }, body });

  let res = respuesta();
  await actualizarFactura(req({ valor_total: -5 }), res);
  assert.equal(res.statusCode, 400);

  invoiceModel.update = async () => ({ data: null, error: { code: 'PGRST116', message: '0 rows' } });
  res = respuesta();
  await actualizarFactura(req({ estado: 'pendiente' }), res);
  assert.equal(res.statusCode, 404);

  invoiceModel.update = async () => ({ data: null, error: { code: '23505', message: 'duplicate key' } });
  res = respuesta();
  await actualizarFactura(req({ estado: 'pendiente' }), res);
  assert.equal(res.statusCode, 409);
  assert.match(res.body.error, /otra factura activa/);

  invoiceModel.update = async () => ({ data: null, error: { code: '22P02', message: 'uuid' } });
  res = respuesta();
  await actualizarFactura(req({ estado: 'anulada' }), res);
  assert.equal(res.statusCode, 400);
});

test('el recibo de pago físico se guarda con el cliente del servidor', async (t) => {
  const originales = {
    getOwn: invoiceModel.getOwn, findPendingByInvoice: paymentModel.findPendingByInvoice,
    create: paymentModel.create, subirRecibo: recibosPagoService.subirRecibo,
  };
  t.after(() => Object.assign(invoiceModel, { getOwn: originales.getOwn }));
  t.after(() => Object.assign(paymentModel, { findPendingByInvoice: originales.findPendingByInvoice, create: originales.create }));
  t.after(() => { recibosPagoService.subirRecibo = originales.subirRecibo; });

  invoiceModel.getOwn = async () => ({ data: { id: 'f1', perfil_id: 'p1', valor_total: 12000, estado: 'pendiente' }, error: null });
  paymentModel.findPendingByInvoice = async () => ({ data: null, error: null });
  recibosPagoService.subirRecibo = async () => ({ path: 'p1/f1/r.jpg', error: null });
  let argumentos;
  paymentModel.create = async (...a) => { argumentos = a; return { data: { id: 'pago-1' }, error: null }; };

  const res = respuesta();
  await registrarPagoFisicoConRecibo({
    params: { facturaId: 'f1' }, usuario: { id: 'p1' }, db: { cliente: 'usuario' },
    headers: { 'content-type': 'image/jpeg' }, body: Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]),
  }, res);

  assert.equal(res.statusCode, 201, JSON.stringify(res.body));
  assert.equal(argumentos.length, 1, 'no se pasa req.db: la app no tiene permiso de insertar pagos');
  assert.equal(argumentos[0].perfil_id, 'p1');
});

test('eliminar notificación usa el cliente del servidor filtrando por dueño', async (t) => {
  const original = notificationModel.removeOwn;
  t.after(() => { notificationModel.removeOwn = original; });
  let argumentos;
  notificationModel.removeOwn = async (...a) => { argumentos = a; return { data: { id: 'n1' }, error: null }; };
  const res = respuesta();
  await eliminarNotificacion({ params: { id: 'n1' }, usuario: { id: 'p1' }, db: { cliente: 'usuario' } }, res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(argumentos, ['n1', 'p1']);
});

test('solo el fontanero puede cambiar el estado de una avería', () => {
  const fuente = require('node:fs').readFileSync(require.resolve('../routes/averiaRoutes'), 'utf8');
  const ruta = fuente.split('\n').find((linea) => /router\.put\('\/:id'/.test(linea));
  assert.ok(ruta, 'existe PUT /averias/:id');
  assert.match(ruta, /verificarToken, verificarRol\('fontanero'\), actualizarAveria/);
  assert.doesNotMatch(ruta, /administrador|usuario/);
});

test('fechas de los correos en hora de Colombia, sin correrse un día', () => {
  const { fechaLarga, fechaHoraColombia } = require('../utils/fechas');
  assert.equal(fechaLarga('2026-10-15'), '15 de octubre de 2026');
  assert.equal(fechaLarga('2027-01-01T00:00:00Z'), '1 de enero de 2027');
  assert.equal(fechaLarga(null), '');
  assert.equal(fechaLarga('no es fecha'), '');
  // 11:30 p. m. del 28 en Colombia = 4:30 a. m. del 29 en UTC.
  assert.match(fechaHoraColombia('2026-10-29T04:30:00Z'), /28 de octubre de 2026.*11:30/);
  assert.equal(fechaHoraColombia(undefined), '');
});

test('el aviso al fontanero usa la hora de Colombia y no se corta si falla un correo', async (t) => {
  const supabaseAdmin = require('../config/supabaseAdminClient');
  const mailer = require('../config/mailer');
  const notificarModulo = require('../utils/notificar');
  const originales = { from: supabaseAdmin.from, enviarCorreo: mailer.enviarCorreo, notificar: notificarModulo.notificar };
  t.after(() => { supabaseAdmin.from = originales.from; mailer.enviarCorreo = originales.enviarCorreo; notificarModulo.notificar = originales.notificar; });
  silenciar(t);

  const consulta = (data) => {
    const q = { select: () => q, eq: () => q, maybeSingle: () => Promise.resolve({ data, error: null }), then: (ok) => Promise.resolve({ data, error: null }).then(ok) };
    return q;
  };
  // 1.ª consulta: fontaneros activos; 2.ª: datos de quien reportó.
  let llamada = 0;
  supabaseAdmin.from = () => {
    llamada += 1;
    return llamada === 1
      ? consulta([{ id: 'f1', correo: 'fontanero@gmail.com' }])
      : consulta({ nombre: 'Ana', apellido: 'Paz', correo: 'ana@gmail.com', telefono: '300', zona: 'Centro', direccion: 'Calle 1' });
  };
  const correos = [];
  mailer.enviarCorreo = async (c) => { correos.push(c); throw new Error('Brevo caído'); };
  const avisos = [];
  notificarModulo.notificar = async (...a) => { avisos.push(a); return true; };

  delete require.cache[require.resolve('../services/notificarAveria')];
  const { notificarNuevaAveria } = require('../services/notificarAveria');
  await notificarNuevaAveria({ perfil_id: 'u1', descripcion: 'Fuga', fecha_reporte: '2026-10-29T04:30:00Z' });

  assert.equal(correos.length, 1);
  assert.match(correos[0].html, /11:30.*hora de Colombia/);
  assert.equal(avisos.length, 1, 'el aviso en la app se crea aunque falle el correo');
  delete require.cache[require.resolve('../services/notificarAveria')];
});

test('la plantilla del correo no anida un documento que ya es HTML completo', () => {
  const { construirCorreoHtml } = require('../config/mailer');
  const simple = construirCorreoHtml({ subject: 'Hola <b>', html: '<p>texto</p>' });
  assert.equal((simple.match(/<html/gi) || []).length, 1);
  assert.ok(simple.includes('Hola &lt;b&gt;'), 'el asunto se escapa');
  const completo = '<!doctype html><html><body>factura</body></html>';
  assert.equal(construirCorreoHtml({ subject: 'x', html: completo }), completo);
});
