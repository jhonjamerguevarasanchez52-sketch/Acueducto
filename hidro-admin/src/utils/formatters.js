export const formatMoney = (value) => Number(value || 0).toLocaleString('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
})

const ZONA_HORARIA = 'America/Bogota'
const SOLO_FECHA = /^\d{4}-\d{2}-\d{2}$/

// "2026-10-15" (vencimientos, vigencias) es una fecha de calendario, no un
// instante: new Date() la leería como medianoche UTC y en Colombia (UTC-5) se
// vería como el 14. Por eso se formatea en UTC. Las marcas con hora se
// muestran siempre en hora de Colombia, esté donde esté el navegador.
export const formatDate = (value) => {
  if (!value) return '—'
  const texto = String(value)
  const soloFecha = SOLO_FECHA.test(texto)
  const fecha = new Date(soloFecha ? `${texto}T00:00:00Z` : texto)
  if (Number.isNaN(fecha.getTime())) return '—'
  return fecha.toLocaleDateString('es-CO', { timeZone: soloFecha ? 'UTC' : ZONA_HORARIA })
}

export const formatDateTime = (value) => {
  if (!value) return '—'
  const fecha = new Date(value)
  if (Number.isNaN(fecha.getTime())) return '—'
  return fecha.toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short', timeZone: ZONA_HORARIA })
}

export const formatInvoiceNumber = (invoice) => invoice.numero_factura
  ? `FAC-${String(invoice.numero_factura).padStart(6, '0')}`
  : `FAC-${String(invoice.id || '').slice(0, 8).toUpperCase()}`
