const TASA = Number(process.env.WOMPI_FEE_RATE ?? 0.0265);
const FIJO = Number(process.env.WOMPI_FIXED_FEE_COP ?? 700);
const IVA = Number(process.env.WOMPI_FEE_IVA_RATE ?? 0.19);

function cotizarWompi(valorServicio) {
  const base = Math.ceil(Number(valorServicio));
  if (!Number.isSafeInteger(base) || base <= 0) throw new Error('Valor de servicio inválido.');
  if (![TASA, FIJO, IVA].every(Number.isFinite) || TASA < 0 || FIJO < 0 || IVA < 0) {
    throw new Error('La tarifa de Wompi no está configurada correctamente.');
  }

  // La tarifa porcentual se aplica al total cobrado. Se despeja el total
  // necesario para que, después de la tarifa fija, porcentaje e IVA, quede
  // al menos el valor de la factura para el acueducto.
  const total = Math.ceil((base + FIJO * (1 + IVA)) / (1 - TASA * (1 + IVA)));
  return { valorServicio: base, cargoWompi: total - base, totalCobrar: total };
}

module.exports = { cotizarWompi };
