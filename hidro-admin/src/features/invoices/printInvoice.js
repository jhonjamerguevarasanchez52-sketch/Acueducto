// Impresión / descarga en PDF de una factura desde el panel. Se abre una
// ventana con solo la factura y su estilo y se lanza el diálogo de impresión
// (desde ahí el administrador elige "Guardar como PDF").

const ESTILOS_FACTURA = `
@page { size: A4; margin: 18mm; }
* { box-sizing: border-box; }
body { margin: 0; color: #172d35; font: 14px Arial, sans-serif; }
.invoice-sheet { position: relative; overflow: hidden; padding: 0; border: 1px solid #d5e5ec; background: #fff; color: #173448; }
.invoice-watermark { position: absolute; z-index: 0; top: 32%; right: 7%; width: 320px; max-width: 52%; opacity: .04; pointer-events: none; }
.invoice-watermark img { display: block; width: 100%; height: auto; }
.invoice-sheet > :not(.invoice-watermark) { position: relative; z-index: 1; }
.invoice-heading { display: flex; align-items: center; justify-content: space-between; gap: 24px; padding: 22px 24px; background: linear-gradient(120deg, #1e5fa0, #0a3665); color: #fff; }
.invoice-heading-brand { display: flex; align-items: center; gap: 14px; }
.invoice-logo-frame { display: grid; flex: none; place-items: center; width: 54px; height: 54px; overflow: hidden; border-radius: 12px; background: #fff; }
.invoice-logo { display: block; width: 100%; height: 100%; object-fit: cover; }
.invoice-brand { color: #dceff5; font-size: 11px; font-weight: 700; text-transform: uppercase; }
.invoice-heading h2 { margin: 7px 0 0; color: #fff; font-size: 24px; }
.invoice-number { flex: none; text-align: right; }
.invoice-number span { color: #dceff5; font-size: 11px; text-transform: uppercase; }
.invoice-number strong { display: block; margin-top: 6px; font-size: 16px; }
.invoice-meta { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; margin: 22px 24px; }
.invoice-meta div { padding: 12px; border: 1px solid #e1edf2; background: #f3f8fa; }
.invoice-meta div:nth-child(1) { border-top: 3px solid #35a7d8; }
.invoice-meta div:nth-child(2) { border-top: 3px solid #dca934; }
.invoice-meta div:nth-child(3) { border-top: 3px solid #34a879; }
.invoice-meta div:nth-child(4) { border-top: 3px solid #e77757; }
.invoice-meta span, .invoice-party > span { display: block; margin-bottom: 6px; color: #607987; font-size: 10px; font-weight: 700; text-transform: uppercase; }
.invoice-party { margin: 0 24px 22px; padding: 15px; border-left: 3px solid #4fc3f7; background: #f7fafc; }
.invoice-party p { margin: 4px 0 0; color: #607987; }
.invoice-lines { width: calc(100% - 48px); margin: 22px 24px 0; border-collapse: collapse; }
.invoice-lines th, .invoice-lines td { padding: 12px 10px; border-bottom: 1px solid #dce6ec; text-align: left; }
.invoice-lines th:last-child, .invoice-lines td:last-child { text-align: right; }
.invoice-lines th { color: #607987; font-size: 10px; text-transform: uppercase; }
.invoice-total { display: flex; justify-content: flex-end; gap: 28px; margin: 4px 24px 0; padding: 16px; border-left: 4px solid #00a878; background: linear-gradient(120deg, #eaf5fb, #e7f8ef); color: #173448; font-size: 17px; font-weight: 700; }
.invoice-note { margin: 20px 24px 0; padding: 14px 0 20px; border-top: 1px solid #dce6ec; color: #607987; }
@media (max-width: 600px) { .invoice-heading { gap: 12px; padding: 16px; } .invoice-heading h2 { font-size: 18px; } .invoice-logo-frame { width: 44px; height: 44px; } .invoice-meta { grid-template-columns: repeat(2, minmax(0, 1fr)); margin: 16px; } .invoice-party { margin: 0 16px 18px; } .invoice-lines { width: calc(100% - 32px); margin: 18px 16px 0; } .invoice-total { margin: 4px 16px 0; } .invoice-note { margin: 18px 16px 0; } }
@media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
`

/**
 * Abre la factura en una ventana nueva y lanza la impresión.
 *
 * @param {HTMLElement | null} documentoFactura nodo con la factura ya renderizada
 * @param {string} titulo título de la ventana (número de factura)
 * @returns {boolean} false si no hay factura o el navegador bloqueó la ventana
 */
export function imprimirFactura(documentoFactura, titulo) {
  if (!documentoFactura) return false
  const ventana = window.open('', '_blank')
  if (!ventana) return false

  ventana.addEventListener('afterprint', () => ventana.close(), { once: true })
  ventana.document.write(`<!doctype html>
    <html lang="es">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>${titulo}</title>
        <style>${ESTILOS_FACTURA}</style>
      </head>
      <body>${documentoFactura.innerHTML}</body>
    </html>`)
  ventana.document.close()
  ventana.setTimeout(() => {
    ventana.focus()
    ventana.print()
  }, 250)
  return true
}
