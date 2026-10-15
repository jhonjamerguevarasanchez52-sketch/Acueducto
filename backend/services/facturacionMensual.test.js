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
      assert.equal(tabla, 'invoices');
      let valores;
      const query = {
        select() { return query; },
        eq() { return query; },
        insert(fila) { valores = fila; return query; },
        update() { return query; },
        single() {
          inserciones.push(valores);
          return Promise.resolve({ data: { ...valores, id: 'factura-1' }, error: null });
        },
        then(resolve, reject) {
          return Promise.resolve({ data: [], error: null }).then(resolve, reject);
        },
      };
      return query;
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
  assert.equal(inserciones[0].valor_total, 12000);
  assert.equal(inserciones[0].fecha_vencimiento, '2026-10-15');
  assert.equal(correos[0].to, 'ana@gmail.com');
  assert.match(correos[0].html, /\$12\.000/);
});

test('omite usuarios con factura existente y reporta fallos de correo', async () => {
  let inserciones = 0;
  const db = {
    from() {
      let insertar = false;
      const query = {
        select() { return query; },
        eq() { return query; },
        insert() { insertar = true; inserciones += 1; return query; },
        single() { return Promise.resolve({ data: null, error: null }); },
        then(resolve, reject) {
          return Promise.resolve({
            data: insertar ? null : [{ perfil_id: 'usuario-existente' }],
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
      data: [
        { id: 'usuario-existente', correo: 'existente@gmail.com' },
        { id: 'usuario-nuevo', correo: 'nuevo@gmail.com' },
      ],
      error: null,
    }),
    db,
    enviarCorreo: async () => { throw new Error('sin conexión'); },
  });

  assert.equal(inserciones, 1);
  assert.equal(resumen.facturasExistentes, 1);
  assert.equal(resumen.facturasCreadas, 1);
  assert.equal(resumen.correosFallidos, 1);
  assert.match(resumen.errores[0], /sin conexión/);
});

test('reintenta el correo de una factura automática ya creada', async () => {
  const updates = [];
  const db = {
    from() {
      const query = {
        select() { return query; },
        eq() { return query; },
        update(cambios) {
          updates.push(cambios);
          return query;
        },
        then(resolve, reject) {
          return Promise.resolve({
            data: [{
              id: 'factura-1',
              perfil_id: 'usuario-1',
              generada_automaticamente: true,
              correo_factura_enviado_at: null,
            }],
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
