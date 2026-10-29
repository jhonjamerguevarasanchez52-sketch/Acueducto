export const formatMoney = (value) => Number(value || 0).toLocaleString('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
})

export const formatDate = (value) => value ? new Date(value).toLocaleDateString('es-CO') : '—'
export const formatInvoiceNumber = (invoice) => invoice.numero_factura
  ? `FAC-${String(invoice.numero_factura).padStart(6, '0')}`
  : `FAC-${String(invoice.id || '').slice(0, 8).toUpperCase()}`

