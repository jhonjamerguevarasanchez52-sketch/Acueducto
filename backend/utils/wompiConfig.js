const ambiente = (process.env.WOMPI_AMBIENTE || 'test').trim().toLowerCase();

function obtenerProblemaConfiguracion() {
  if (!['test', 'prod'].includes(ambiente)) {
    return 'WOMPI_AMBIENTE debe ser test o prod.';
  }

  const modo = ambiente === 'prod' ? 'prod' : 'test';
  const requisitos = [
    ['WOMPI_PUBLIC_KEY', ambiente === 'prod' ? 'pub_prod_' : 'pub_test_'],
    ['WOMPI_INTEGRITY_KEY', `${modo}_integrity_`],
    ['WOMPI_EVENTS_SECRET', `${modo}_events_`],
  ];

  for (const [nombre, prefijoEsperado] of requisitos) {
    const valor = process.env[nombre]?.trim();
    if (!valor) return `Falta configurar ${nombre} para Wompi ${ambiente}.`;
    if (!valor.startsWith(prefijoEsperado)) {
      return `${nombre} no corresponde al ambiente Wompi ${ambiente}.`;
    }
  }

  const moneda = (process.env.WOMPI_CURRENCY || 'COP').trim().toUpperCase();
  if (moneda !== 'COP') return 'WOMPI_CURRENCY debe ser COP.';

  return null;
}

function obtenerConfiguracionPublica() {
  return {
    publicKey: process.env.WOMPI_PUBLIC_KEY || null,
    ambiente,
    currency: (process.env.WOMPI_CURRENCY || 'COP').trim().toUpperCase(),
    disponible: obtenerProblemaConfiguracion() === null,
  };
}

module.exports = { obtenerProblemaConfiguracion, obtenerConfiguracionPublica };
