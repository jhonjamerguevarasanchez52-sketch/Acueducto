const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

test('calcularFirmaIntegridad', async (t) => {
  const llaveOriginal = process.env.WOMPI_INTEGRITY_KEY;
  t.after(() => {
    if (llaveOriginal === undefined) delete process.env.WOMPI_INTEGRITY_KEY;
    else process.env.WOMPI_INTEGRITY_KEY = llaveOriginal;
  });

  await t.test('lanza si WOMPI_INTEGRITY_KEY no está configurado', () => {
    delete process.env.WOMPI_INTEGRITY_KEY;
    delete require.cache[require.resolve('./wompiFirma')];
    const { calcularFirmaIntegridad } = require('./wompiFirma');

    assert.throws(
      () => calcularFirmaIntegridad({ reference: 'r1', amountInCents: 1000, currency: 'COP' }),
      /WOMPI_INTEGRITY_KEY no está configurado/
    );
  });

  await t.test('calcula el SHA256 esperado según la fórmula de Wompi', () => {
    process.env.WOMPI_INTEGRITY_KEY = 'llave-de-prueba';
    delete require.cache[require.resolve('./wompiFirma')];
    const { calcularFirmaIntegridad } = require('./wompiFirma');

    const reference = 'factura-123';
    const amountInCents = 1500000;
    const currency = 'COP';

    const esperado = crypto
      .createHash('sha256')
      .update(`${reference}${amountInCents}${currency}llave-de-prueba`)
      .digest('hex');

    const resultado = calcularFirmaIntegridad({ reference, amountInCents, currency });
    assert.equal(resultado, esperado);
  });

  await t.test('un monto distinto produce una firma distinta', () => {
    process.env.WOMPI_INTEGRITY_KEY = 'llave-de-prueba';
    delete require.cache[require.resolve('./wompiFirma')];
    const { calcularFirmaIntegridad } = require('./wompiFirma');

    const base = { reference: 'factura-123', amountInCents: 1500000, currency: 'COP' };
    const firmaOriginal = calcularFirmaIntegridad(base);
    const firmaMontoDistinto = calcularFirmaIntegridad({ ...base, amountInCents: 1500001 });

    assert.notEqual(firmaOriginal, firmaMontoDistinto);
  });
});
