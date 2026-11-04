// Formatos de texto compartidos por controladores, servicios y correos.

function normalizarCorreo(correo) {
  return String(correo || '').toLowerCase().trim();
}

// 12000 -> '$12.000' (separador de miles colombiano, sin decimales).
function formatearPesos(valor) {
  return `$${Math.round(Number(valor) || 0).toLocaleString('es-CO')}`;
}

module.exports = { normalizarCorreo, formatearPesos };
