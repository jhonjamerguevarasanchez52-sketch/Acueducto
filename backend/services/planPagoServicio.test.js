const test = require('node:test');
const assert = require('node:assert/strict');
const { calcularPeriodosPlan } = require('./planPagoServicio');

test('calcula cobertura semestral y siguiente facturación cruzando el año', () => {
  const plan = calcularPeriodosPlan('2026-10', 6);

  assert.deepEqual(plan.periodos, ['2026-10', '2026-11', '2026-12', '2027-01', '2027-02', '2027-03']);
  assert.equal(plan.periodoFin, '2027-03');
  assert.equal(plan.proximoPeriodo, '2027-04');
  assert.equal(plan.fechaProximaFacturacion, '2027-05-01');
});

test('calcula cobertura anual y conserva la fecha próxima de facturación', () => {
  const plan = calcularPeriodosPlan('2026-03', 12);

  assert.equal(plan.periodos.length, 12);
  assert.equal(plan.periodoFin, '2027-02');
  assert.equal(plan.proximoPeriodo, '2027-03');
  assert.equal(plan.fechaProximaFacturacion, '2027-04-01');
});

test('acepta el plan mensual y rechaza periodos o planes inválidos', () => {
  assert.equal(calcularPeriodosPlan('2026-12', 1).proximoPeriodo, '2027-01');
  assert.throws(() => calcularPeriodosPlan('2026-00', 6), /periodo inicial/);
  assert.throws(() => calcularPeriodosPlan('2026-12', 3), /1, 6 o 12/);
});

test('lista los meses de un plan y los nombra en español', () => {
  const { listarPeriodos, nombrePeriodo } = require('./planPagoServicio');
  assert.deepEqual(listarPeriodos('2026-11', '2027-02'), ['2026-11', '2026-12', '2027-01', '2027-02']);
  assert.deepEqual(listarPeriodos('2026-11'), ['2026-11']);
  assert.equal(nombrePeriodo('2027-03'), 'marzo de 2027');
});
