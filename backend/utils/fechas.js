// Fechas para correos y textos: siempre en hora de Colombia, sin depender de
// la zona horaria del servidor (Render corre en UTC).
const ZONA_HORARIA = 'America/Bogota';

// '2026-10-15' (fecha sin hora) -> '15 de octubre de 2026'. Se lee como fecha
// de calendario para que no se corra un día al cambiar de zona horaria.
function fechaLarga(valor) {
  if (!valor) return '';
  const fecha = new Date(`${String(valor).slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(fecha.getTime())) return '';
  return new Intl.DateTimeFormat('es-CO', { dateStyle: 'long', timeZone: 'UTC' }).format(fecha);
}

// Marca de tiempo -> '28 de octubre de 2026, 11:30 p. m.' en hora de Colombia.
function fechaHoraColombia(valor) {
  if (!valor) return '';
  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) return '';
  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: ZONA_HORARIA,
  }).format(fecha);
}

module.exports = { ZONA_HORARIA, fechaLarga, fechaHoraColombia };
