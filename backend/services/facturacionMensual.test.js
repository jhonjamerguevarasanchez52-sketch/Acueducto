const test = require('node:test');
const assert = require('node:assert/strict');
const {
  VALOR_MENSUAL,
  periodoAnterior,
  fechaVencimiento,
  generarFacturasMensuales,
} = require('./facturacionMensual');

test('periodoAnterior usa el calendario de Colombia y cruza correctamente el año', () => {
  assert.equal(periodoAnterior(new Date('2026-01-01T05:00:00.000Z')), '2025-12');
  assert.equal(periodoAnterior(new Date('2026-10-01T04:59:59.000Z')), '2026-08');
  assert.equal(periodoAnterior(new Date('2026-10-01T05:00:00.000Z')), '2026-09');
});

test('fechaVencimiento es el día 15 del mes siguiente', () => {
  assert.equal(fechaVencimiento('2026-09'), '2026-10-15');
  assert.equal(fechaVencimiento('2026-12'), '2027-01-15');
  assert.throws(() => fechaVencimiento('2026-13'), /AAAA-MM/);
});

test('genera una factura de 12.000 y envía un correo por usuario activo nuevo', async () => {
  const inserciones = [];
  const correos = [];
  const db = {
    from(tabla) {
      const query = {
        select() { return query; },
        eq() { return query; },
        neq() { return query; },
        update() { return query; },
        then(resolve, reject) {
          return Promise.resolve({ data: [], error: null }).then(resolve, reject);
        },
      };
      assert.ok(['invoices', 'invoice_service_periods'].includes(tabla));
      return query;
    },
    async rpc(nombre, parametros) {
      assert.equal(nombre, 'crear_factura_mensual_si_no_cubierta');
      inserciones.push(parametros);
      return { data: [{
        id: 'factura-1',
        valor_total: parametros.p_valor_total,
        fecha_vencimiento: parametros.p_fecha_vencimiento,
        generada_automaticamente: true,
      }], error: null };
    },
  };

  const resumen = await generarFacturasMensuales({
    periodo: '2026-09',
    fechaEmision: new Date('2026-10-01T05:00:00.000Z'),
    obtenerPerfilesActivos: async () => ({
      data: [{ id: 'usuario-1', nombre: 'Ana', correo: 'ana@gmail.com' }],
      error: null,
    }),
    db,
    enviarCorreo: async (correo) => {
      correos.push(correo);
      return { messageId: 'enviado' };
    },
  });

  assert.equal(VALOR_MENSUAL, 12000);
  assert.equal(resumen.facturasCreadas, 1);
  assert.equal(resumen.correosEnviados, 1);
  assert.equal(inserciones[0].p_valor_total, 12000);
  assert.equal(inserciones[0].p_fecha_vencimiento, '2026-10-15');
  assert.equal(correos[0].to, 'ana@gmail.com');
  assert.match(correos[0].html, /\$12\.000/);
});

test('omite usuarios con factura existente y reporta fallos de correo', async () => {
  const inserciones = [];
  const db = {
    from(tabla) {
      const query = {
        select() { return query; },
        eq() { return query; },
        neq() { return query; },
        then(resolve, reject) {
          return Promise.resolve({
            data: tabla === 'invoices' ? [{
              id: 'factura-existente',
              perfil_id: 'usuario-existente',
              generada_automaticamente: true,
              correo_factura_enviado_at: new Date().toISOString(),
            }] : [],
            error: null,
          }).then(resolve, reject);
        },
      };
      return query;
    },
    async rpc(_nombre, parametros) {
      inserciones.push(parametros);
      return { data: [{ id: 'factura-nueva', generada_automaticamente: true }], error: null };
    },
  };

  const resumen = await generarFacturasMensuales({
    periodo: '2026-09',
    obtenerPerfilesActivos: async () => ({
      data: [
        { id: 'usuario-existente', correo: 'existente@gmail.com' },
        { id: 'usuario-nuevo', correo: 'nuevo@gmail.com' },
      ],
      error: null,
    }),
    db,
    enviarCorreo: async () => { throw new Error('sin conexión'); },
  });

  assert.equal(inserciones.length, 1);
  assert.equal(resumen.facturasExistentes, 1);
  assert.equal(resumen.facturasCreadas, 1);
  assert.equal(resumen.correosFallidos, 1);
  assert.match(resumen.errores[0], /sin conexión/);
});

test('reintenta el correo de una factura automática ya creada', async () => {
  const updates = [];
  const db = {
    from(tabla) {
      const query = {
        select() { return query; },
        eq() { return query; },
        neq() { return query; },
        update(cambios) {
          updates.push(cambios);
          return query;
        },
        then(resolve, reject) {
          return Promise.resolve({
            data: tabla === 'invoices' ? [{
              id: 'factura-1',
              perfil_id: 'usuario-1',
              generada_automaticamente: true,
              correo_factura_enviado_at: null,
            }] : [],
            error: null,
          }).then(resolve, reject);
        },
      };
      return query;
    },
  };

  const resumen = await generarFacturasMensuales({
    periodo: '2026-09',
    obtenerPerfilesActivos: async () => ({
      data: [{ id: 'usuario-1', correo: 'ana@gmail.com' }],
      error: null,
    }),
    db,
    enviarCorreo: async () => ({ messageId: 'enviado' }),
  });

  assert.equal(resumen.facturasCreadas, 0);
  assert.equal(resumen.facturasExistentes, 1);
  assert.equal(resumen.correosEnviados, 1);
  assert.ok(updates[0].correo_factura_enviado_at);
});

test('no genera factura mensual para un periodo cubierto por un prepago', async () => {
  let llamadasRpc = 0;
  let correos = 0;
  const db = {
    from() {
      const query = {
        select() { return query; },
        eq() { return query; },
        neq() { return query; },
        then(resolve, reject) {
          return Promise.resolve({ data: [], error: null }).then(resolve, reject);
        },
      };
      return query;
    },
    // La función SQL devuelve un conjunto vacío cuando el mes ya está cubierto.
    async rpc() {
      llamadasRpc += 1;
      return { data: [], error: null };
    },
  };

  const resumen = await generarFacturasMensuales({
    periodo: '2027-01',
    obtenerPerfilesActivos: async () => ({
      data: [{ id: 'usuario-prepago', correo: 'ana@gmail.com' }],
      error: null,
    }),
    db,
    enviarCorreo: async () => { correos += 1; return { messageId: 'no-debe-enviarse' }; },
  });

  assert.equal(resumen.facturasCreadas, 0);
  assert.equal(resumen.periodosPrepagados, 1);
  assert.equal(llamadasRpc, 1);
  assert.equal(correos, 0);
});

test('una factura anulada no impide volver a facturar ese mes', async () => {
  const filtros = [];
  let creadas = 0;
  const db = {
    from() {
      const query = {
        select() { return query; },
        eq(campo, valor) { filtros.push(['eq', campo, valor]); return query; },
        neq(campo, valor) { filtros.push(['neq', campo, valor]); return query; },
        then(resolve, reject) {
          return Promise.resolve({ data: [], error: null }).then(resolve, reject);
        },
      };
      return query;
    },
    async rpc(_nombre, parametros) {
      creadas += 1;
      return { data: [{ id: 'nueva', perfil_id: parametros.p_perfil_id, generada_automaticamente: true }], error: null };
    },
  };

  const resumen = await generarFacturasMensuales({
    periodo: '2026-10',
    obtenerPerfilesActivos: async () => ({ data: [{ id: 'usuario-1', correo: 'a@b.co' }], error: null }),
    db,
    enviarCorreo: async () => ({ messageId: 'ok' }),
  });

  assert.deepEqual(filtros.find(([tipo]) => tipo === 'neq'), ['neq', 'estado', 'anulada']);
  assert.equal(creadas, 1);
  assert.equal(resumen.facturasCreadas, 1);
});
