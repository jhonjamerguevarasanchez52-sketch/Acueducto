// Pruebas de propiedades: recorren todos los meses de 2000 a 2099 y miles de
// montos para comprobar que periodos, fechas y cobros Wompi son consistentes.
const test = require('node:test');
const assert = require('node:assert/strict');

const { calcularPeriodosPlan, listarPeriodos, nombrePeriodo, agregarMeses } = require('./planPagoServicio');
const { fechaVencimiento, periodoAnterior } = require('./facturacionMensual');
const { cotizarWompi } = require('../utils/wompiTarifa');
const { construirHtml } = require('./comprobantePagoWompi');

const TASA = Number(process.env.WOMPI_FEE_RATE ?? 0.0265);
const FIJO = Number(process.env.WOMPI_FIXED_FEE_COP ?? 700);
const IVA = Number(process.env.WOMPI_FEE_IVA_RATE ?? 0.19);
const neto = (total) => total - (total * TASA + FIJO) * (1 + IVA);

// Cálculo independiente (aritmética de enteros, sin Date) para comparar.
function mesesDesde(periodo, n) {
  const [a, m] = periodo.split('-').map(Number);
  const total = a * 12 + (m - 1) + n;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`;
}

function rng(semilla) {
  let s = semilla >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; };
}

for (let anio = 2000; anio <= 2099; anio++) {
  for (const meses of [1, 6, 12]) {
    test(`plan de ${meses} meses para cada mes de ${anio}`, () => {
      for (let mes = 1; mes <= 12; mes++) {
        const inicio = `${anio}-${String(mes).padStart(2, '0')}`;
        const plan = calcularPeriodosPlan(inicio, meses);
        const fin = mesesDesde(inicio, meses - 1);
        assert.equal(plan.periodos.length, meses);
        assert.equal(plan.periodoInicio, inicio);
        assert.equal(plan.periodoFin, fin);
        assert.equal(plan.proximoPeriodo, mesesDesde(inicio, meses));
        // El cron factura un mes el día 1 del mes siguiente.
        assert.equal(plan.fechaProximaFacturacion, `${mesesDesde(inicio, meses + 1)}-01`);
        plan.periodos.forEach((p, i) => assert.equal(p, mesesDesde(inicio, i)));
        assert.equal(new Set(plan.periodos).size, meses, 'sin meses repetidos');
        assert.deepEqual(listarPeriodos(inicio, fin), plan.periodos);
        assert.equal(agregarMeses(fin, 1), plan.proximoPeriodo);
        // El vencimiento de la mensualidad siguiente cae después de facturarla.
        assert.ok(fechaVencimiento(plan.proximoPeriodo) > plan.fechaProximaFacturacion);
      }
    });
  }
}

test('rechaza periodos y planes inválidos', () => {
  const malos = ['', '2026', '2026-1', '2026-13', '2026-00', '26-10', '09/10/2026', '2026-10-01', ' 2026-10', null, undefined, 202610];
  for (const p of malos) assert.throws(() => calcularPeriodosPlan(p, 6), String(p));
  for (const m of [0, 2, 3, 5, 7, 11, 13, 24, -6, 6.5, NaN, '6x']) assert.throws(() => calcularPeriodosPlan('2026-10', m), String(m));
  for (const p of malos) assert.deepEqual(listarPeriodos(p), [], String(p));
});

test('nombra en español los 12 meses y deja intacto un texto no reconocido', () => {
  const esperados = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  esperados.forEach((nombre, i) => assert.equal(nombrePeriodo(`2027-${String(i + 1).padStart(2, '0')}`), `${nombre} de 2027`));
  assert.equal(nombrePeriodo('09/10/2026'), '09/10/2026');
  assert.equal(nombrePeriodo(null), '');
});

// Cobro Wompi: para todo monto, el acueducto recibe al menos el valor y el
// total es el mínimo posible (un peso menos ya no alcanzaría).
for (let desde = 1; desde <= 300000; desde += 10000) {
  test(`cotización Wompi mínima y suficiente de ${desde} a ${desde + 9999}`, () => {
    for (let valor = desde; valor < desde + 10000; valor++) {
      const { valorServicio, cargoWompi, totalCobrar } = cotizarWompi(valor);
      assert.equal(valorServicio, valor);
      assert.equal(totalCobrar, valor + cargoWompi);
      assert.ok(Number.isInteger(totalCobrar) && cargoWompi > 0);
      assert.ok(neto(totalCobrar) >= valor - 1e-9, `${valor}: no llega limpio`);
      assert.ok(neto(totalCobrar - 1) < valor, `${valor}: cobra de más`);
    }
  });
}

test('cotización rechaza montos inválidos', () => {
  for (const v of [0, -1, NaN, Infinity, 'abc', null]) assert.throws(() => cotizarWompi(v), String(v));
});

test('el cargo Wompi crece con el monto (nunca baja al pagar más meses)', () => {
  let anterior = 0;
  for (let meses = 1; meses <= 24; meses++) {
    const { cargoWompi } = cotizarWompi(12000 * meses);
    assert.ok(cargoWompi >= anterior);
    anterior = cargoWompi;
  }
});

test('el periodo facturado por el cron es siempre el mes anterior en hora de Colombia', () => {
  // Cada hora de 5 años: medianoche en Bogotá es 05:00 UTC.
  for (let t = Date.UTC(2026, 0, 1); t < Date.UTC(2031, 0, 1); t += 3600 * 1000) {
    const bogota = new Date(t - 5 * 3600 * 1000);
    const esperado = mesesDesde(`${bogota.getUTCFullYear()}-${String(bogota.getUTCMonth() + 1).padStart(2, '0')}`, -1);
    assert.equal(periodoAnterior(new Date(t)), esperado, new Date(t).toISOString());
  }
});

for (let lote = 0; lote < 50; lote++) {
  test(`comprobante coherente para planes aleatorios (lote ${lote + 1})`, () => {
    const r = rng(1000 + lote);
    for (let i = 0; i < 20; i++) {
      const meses = [1, 6, 12][Math.floor(r() * 3)];
      const inicio = `${2026 + Math.floor(r() * 4)}-${String(1 + Math.floor(r() * 12)).padStart(2, '0')}`;
      const plan = calcularPeriodosPlan(inicio, meses);
      const valor = 12000 * meses;
      const { cargoWompi, totalCobrar } = cotizarWompi(valor);
      const html = construirHtml({
        pago: { id: `p${i}`, monto: valor, cargo_wompi: cargoWompi, monto_total: totalCobrar, transaccion_id: `tx<${i}>`, fecha_confirmacion: '2026-11-03T15:00:00Z' },
        factura: { id: `f${i}`, numero_factura: i, tipo: meses > 1 ? 'prepago' : 'servicio', periodo: inicio, periodo_inicio: inicio, periodo_fin: plan.periodoFin, meses_cubiertos: meses, valor_total: valor },
        perfil: { nombre: '<b>Ana</b>' },
      });
      assert.ok(!html.includes('<b>Ana</b>'), 'escapa el nombre');
      assert.ok(!html.includes(`tx<${i}>`), 'escapa la transacción');
      assert.ok(html.includes(`$${totalCobrar.toLocaleString('es-CO')} COP`), 'total cobrado');
      assert.ok(html.includes(nombrePeriodo(plan.proximoPeriodo)), 'próxima factura');
      const filasMes = (html.match(/data-concepto="mensualidad"/g) || []).length;
      // Una línea por cada mes pagado, y el subtotal del servicio completo.
      assert.equal(filasMes, meses, `filas de mensualidad (${meses})`);
      assert.ok(html.includes(`$${valor.toLocaleString('es-CO')} COP`), 'subtotal del servicio');
      for (const p of plan.periodos) if (meses > 1) assert.ok(html.includes(nombrePeriodo(p)), p);
    }
  });
}
