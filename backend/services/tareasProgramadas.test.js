const test = require('node:test');
const assert = require('node:assert/strict');

const invoiceModel = require('../models/invoiceModel');
const notificationModel = require('../models/notificationModel');
const supabaseAdmin = require('../config/supabaseAdminClient');
const { sumarDias, enviarRecordatoriosDeVencimiento } = require('./tareasProgramadas');
const { secretoValido } = require('../middleware/tareasMiddleware');

test('sumarDias cruza meses y años en calendario', () => {
  assert.equal(sumarDias('2026-10-29', 3), '2026-11-01');
  assert.equal(sumarDias('2026-12-30', 3), '2027-01-02');
});

test('el recordatorio avisa en la app y por correo, una sola vez por factura', async (t) => {
  const originales = {
    listDueForReminder: invoiceModel.listDueForReminder,
    insert: notificationModel.insert,
    from: supabaseAdmin.from,
  };
  t.after(() => {
    invoiceModel.listDueForReminder = originales.listDueForReminder;
    notificationModel.insert = originales.insert;
    supabaseAdmin.from = originales.from;
  });

  let fechaConsultada;
  invoiceModel.listDueForReminder = async (fecha) => {
    fechaConsultada = fecha;
    return {
      data: [
        {
          id: 'f1', perfil_id: 'p1', numero_factura: 41, periodo: '2026-10',
          valor_total: 12000, fecha_vencimiento: '2026-11-15',
          profiles: { nombre: 'Ana', correo: 'ana@correo.com', activo: true },
        },
        {
          id: 'f2', perfil_id: 'p2', numero_factura: 42, periodo: '2026-10',
          valor_total: 12000, fecha_vencimiento: '2026-11-15',
          profiles: { nombre: 'Inactivo', correo: 'x@correo.com', activo: false },
        },
      ],
      error: null,
    };
  };
  const avisos = [];
  notificationModel.insert = async (fila) => { avisos.push(fila); return { error: null }; };
  const marcadas = [];
  supabaseAdmin.from = () => ({
    update(cambios) {
      return { eq: async (_columna, id) => { marcadas.push({ id, ...cambios }); return { error: null }; } };
    },
  });
  const correos = [];

  const resumen = await enviarRecordatoriosDeVencimiento({
    hoy: '2026-11-12',
    enviarCorreo: async (correo) => { correos.push(correo); return { ok: true }; },
  });

  assert.equal(fechaConsultada, '2026-11-15');
  assert.equal(resumen.recordatorios, 1);
  assert.equal(avisos.length, 1, 'un usuario desactivado no recibe recordatorio');
  assert.match(avisos[0].mensaje, /\$12\.000/);
  assert.equal(correos[0].to, 'ana@correo.com');
  assert.deepEqual(marcadas.map((m) => m.id), ['f1']);
  assert.ok(marcadas[0].recordatorio_enviado_at);
});

test('las tareas solo aceptan el CRON_SECRET exacto', (t) => {
  const original = process.env.CRON_SECRET;
  t.after(() => { process.env.CRON_SECRET = original; });
  process.env.CRON_SECRET = 'secreto-de-prueba-muy-largo-123';
  assert.equal(secretoValido('secreto-de-prueba-muy-largo-123'), true);
  assert.equal(secretoValido('secreto-de-prueba-muy-largo-12'), false);
  assert.equal(secretoValido(undefined), false);
  delete process.env.CRON_SECRET;
  assert.equal(secretoValido(''), false);
});
