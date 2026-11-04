const test = require('node:test');
const assert = require('node:assert/strict');

const { cotizarWompi } = require('./wompiTarifa');

test('el total deja al menos el valor de servicio después de tarifa e IVA', () => {
  const valorServicio = 12000;
  const tasa = Number(process.env.WOMPI_FEE_RATE ?? 0.0265);
  const fijo = Number(process.env.WOMPI_FIXED_FEE_COP ?? 700);
  const iva = Number(process.env.WOMPI_FEE_IVA_RATE ?? 0.19);
  const cotizacion = cotizarWompi(valorServicio);
  const costo = (cotizacion.totalCobrar * tasa + fijo) * (1 + iva);
  const neto = cotizacion.totalCobrar - costo;
  const netoConUnPesoMenos = cotizacion.totalCobrar - 1 - ((cotizacion.totalCobrar - 1) * tasa + fijo) * (1 + iva);

  assert.equal(cotizacion.valorServicio, valorServicio);
  assert.equal(cotizacion.totalCobrar, cotizacion.valorServicio + cotizacion.cargoWompi);
  assert.ok(neto >= valorServicio);
  assert.ok(netoConUnPesoMenos < valorServicio);
});

test('los planes de 1, 6 y 12 meses llegan limpios a la cuenta del acueducto', () => {
  const esperados = { 12000: 13251, 72000: 75205, 144000: 149550 };
  for (const [neto, total] of Object.entries(esperados)) {
    const cotizacion = cotizarWompi(Number(neto));
    assert.equal(cotizacion.totalCobrar, total);
    // Comisión Wompi: 2,65 % del total + $700, más IVA del 19 % sobre la comisión.
    const descuentoWompi = (cotizacion.totalCobrar * 0.0265 + 700) * 1.19;
    assert.ok(cotizacion.totalCobrar - descuentoWompi >= Number(neto));
  }
});
