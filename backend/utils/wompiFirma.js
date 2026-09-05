const crypto = require('crypto');

/**
 * Calcula la firma de integridad que exige el checkout de Wompi:
 * SHA256(reference + amountInCents + currency + WOMPI_INTEGRITY_KEY).
 * https://docs.wompi.co/docs/colombia/widget-checkout-web/#firma-de-integridad
 *
 * Se calcula siempre en el backend (nunca en el cliente) porque ata de forma
 * criptográfica la referencia y el monto: si el cliente pudiera generarla,
 * podría abrir el checkout de Wompi con un monto distinto al de la factura.
 */
function calcularFirmaIntegridad({ reference, amountInCents, currency }) {
  const llave = process.env.WOMPI_INTEGRITY_KEY;
  if (!llave) {
    throw new Error('WOMPI_INTEGRITY_KEY no está configurado');
  }

  const cadena = `${reference}${amountInCents}${currency}${llave}`;
  return crypto.createHash('sha256').update(cadena).digest('hex');
}

module.exports = { calcularFirmaIntegridad };
