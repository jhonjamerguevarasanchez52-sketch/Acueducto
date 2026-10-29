import { formatDate, formatInvoiceNumber } from '../../utils/formatters.js'
import hidroAppLogo from '../../assets/hidroapp-logo.png'

export default async function exportTreasuryWorkbook({
  report = 'todos',
  sectionData,
  users,
  invoices,
  reportPayments,
  reportInvoices,
  reportConfirmedPayments,
  reportRevenue,
  reportPendingRevenue,
  reportFrom,
  reportTo,
  setActionError,
  setActionMessage,
}) {
    const required = report === 'balance' || report === 'pagos'
      ? ['pagos', 'usuarios', 'facturas']
      : report === 'facturas'
        ? ['facturas', 'usuarios']
        : ['usuarios', 'facturas', 'pagos']
    const missing = required.find((section) => sectionData[section] === undefined)
    if (missing) {
      setActionError(`No fue posible preparar el informe: revisa la carga de ${missing}.`)
      return
    }
    let ExcelJS
    try {
      ExcelJS = (await import('exceljs')).default
    } catch (error) {
      console.error('No fue posible cargar el generador Excel:', error)
      setActionError('No se pudo cargar el generador Excel. Reinicia el servidor del panel e inténtalo de nuevo.')
      return
    }

    const profileById = new Map(users.map((user) => [user.id, user]))
    const invoiceById = new Map(invoices.map((invoice) => [invoice.id, invoice]))
    const userName = (id) => {
      const user = profileById.get(id)
      return [user?.nombre, user?.apellido].filter(Boolean).join(' ') || 'Sin nombre'
    }
    const paymentRows = reportPayments.map((payment) => {
      const user = profileById.get(payment.perfil_id)
      const invoice = invoiceById.get(payment.factura_id)
      return {
        Fecha: formatDate(payment.fecha_pago),
        Suscriptor: userName(payment.perfil_id),
        Correo: user?.correo || '',
        Dirección: user?.direccion || user?.zona || '',
        Factura: formatInvoiceNumber(invoice || { id: payment.factura_id }),
        Periodo: invoice?.periodo || '',
        Monto: Number(payment.monto || 0),
        Método: payment.metodo || '',
        Estado: payment.confirmado ? 'Confirmado' : 'Pendiente por confirmar',
        Referencia: payment.referencia || payment.transaccion_id || '',
        'ID de pago': payment.id,
      }
    })
    const invoiceRows = reportInvoices.map((invoice) => {
      const user = profileById.get(invoice.perfil_id)
      return {
        'Fecha de emisión': formatDate(invoice.fecha_emision),
        Factura: formatInvoiceNumber(invoice),
        Periodo: invoice.periodo,
        Suscriptor: userName(invoice.perfil_id),
        Correo: user?.correo || '',
        Dirección: user?.direccion || user?.zona || '',
        Tipo: invoice.tipo || 'servicio',
        Valor: Number(invoice.valor_total || 0),
        Estado: invoice.estado,
        Vencimiento: formatDate(invoice.fecha_vencimiento),
        Observación: invoice.observacion || '',
      }
    })
    const accountRows = users.filter((user) => user.rol === 'usuario').map((user) => {
      const billed = reportInvoices.filter((invoice) => invoice.perfil_id === user.id)
        .reduce((sum, invoice) => sum + Number(invoice.valor_total || 0), 0)
      const paid = reportConfirmedPayments.filter((payment) => payment.perfil_id === user.id)
        .reduce((sum, payment) => sum + Number(payment.monto || 0), 0)
      const dueInvoices = reportInvoices.filter((invoice) => invoice.perfil_id === user.id && ['pendiente', 'vencida'].includes(invoice.estado))
      return {
        Suscriptor: [user.nombre, user.apellido].filter(Boolean).join(' '),
        Correo: user.correo || '',
        Teléfono: user.telefono || '',
        Dirección: user.direccion || user.zona || '',
        Lote: user.numero_lote || '',
        Estado: user.activo ? 'Activo' : 'Inactivo',
        'Facturado en el periodo': billed,
        'Pagado confirmado en el periodo': paid,
        'Saldo de facturas pendientes': dueInvoices.reduce((sum, invoice) => sum + Number(invoice.valor_total || 0), 0),
        'Facturas pendientes': dueInvoices.length,
      }
    })
    const monthlyTotals = new Map()
    reportConfirmedPayments.forEach((payment) => {
      const month = String(payment.fecha_pago || '').slice(0, 7) || 'Sin fecha'
      monthlyTotals.set(month, (monthlyTotals.get(month) || 0) + Number(payment.monto || 0))
    })
    const balanceRows = [
      { Concepto: 'Ingresos recibidos y confirmados', Cantidad: reportConfirmedPayments.length, Valor: reportRevenue },
      { Concepto: 'Pagos pendientes de confirmar', Cantidad: reportPayments.filter((payment) => !payment.confirmado).length, Valor: reportPendingRevenue },
      { Concepto: 'Facturas emitidas', Cantidad: reportInvoices.length, Valor: reportInvoices.reduce((sum, invoice) => sum + Number(invoice.valor_total || 0), 0) },
      { Concepto: 'Facturas pendientes o vencidas', Cantidad: reportInvoices.filter((invoice) => ['pendiente', 'vencida'].includes(invoice.estado)).length, Valor: reportInvoices.filter((invoice) => ['pendiente', 'vencida'].includes(invoice.estado)).reduce((sum, invoice) => sum + Number(invoice.valor_total || 0), 0) },
      ...[...monthlyTotals.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([month, value]) => ({ Concepto: `Recaudo confirmado · ${month}`, Cantidad: '', Valor: value })),
    ]
    const sheetRows = {
      balance: { 'Balance de ingresos': balanceRows },
      pagos: { 'Pagos de usuarios': paymentRows },
      facturas: { 'Facturas emitidas': invoiceRows },
      usuarios: { 'Estado por usuario': accountRows },
      todos: {
        'Balance de ingresos': balanceRows,
        'Pagos de usuarios': paymentRows,
        'Facturas emitidas': invoiceRows,
        'Estado por usuario': accountRows,
      },
    }
    const workbook = new ExcelJS.Workbook()
    workbook.creator = 'HIDRO-APP · Acueducto Campoamor'
    workbook.subject = 'Informes de tesorería'
    workbook.title = `Informe ${report}`
    workbook.created = new Date()
    const logoResponse = await fetch(hidroAppLogo)
    const logoBlob = await logoResponse.blob()
    const logoBitmap = await createImageBitmap(logoBlob)
    const watermarkCanvas = document.createElement('canvas')
    watermarkCanvas.width = logoBitmap.width
    watermarkCanvas.height = logoBitmap.height
    const watermarkContext = watermarkCanvas.getContext('2d')
    watermarkContext.globalAlpha = 0.075
    watermarkContext.drawImage(logoBitmap, 0, 0)
    const watermarkBase64 = watermarkCanvas.toDataURL('image/png').split(',')[1]
    const logoBase64 = await logoBlob.arrayBuffer().then((buffer) => {
      let binary = ''
      new Uint8Array(buffer).forEach((byte) => { binary += String.fromCharCode(byte) })
      return btoa(binary)
    })
    const brandImage = workbook.addImage({ base64: logoBase64, extension: 'png' })
    const watermarkImage = workbook.addImage({ base64: watermarkBase64, extension: 'png' })
    const reportTitles = {
      balance: 'Balance de ingresos',
      pagos: 'Pagos de usuarios',
      facturas: 'Facturas emitidas',
      usuarios: 'Estado de cuenta por usuario',
      todos: 'Informe integral de tesorería',
    }
    Object.entries(sheetRows[report]).forEach(([name, rows]) => {
      const safeRows = rows.length ? rows : [{ 'Sin registros en el periodo': 'No hay información para las fechas seleccionadas.' }]
      const columns = Object.keys(safeRows[0])
      const worksheet = workbook.addWorksheet(name, {
        views: [{ state: 'frozen', ySplit: 4 }],
        pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
      })
      worksheet.columns = columns.map((key) => ({
        key,
        width: Math.min(34, Math.max(key.length + 3, ...safeRows.slice(0, 100).map((row) => String(row[key] ?? '').length + 2))),
      }))
      worksheet.mergeCells(1, 1, 1, columns.length)
      worksheet.mergeCells(2, 1, 2, columns.length)
      worksheet.getCell('A1').value = `${reportTitles[report]} · ${name}`
      worksheet.getCell('A1').font = { name: 'Aptos Display', size: 18, bold: true, color: { argb: 'FFFFFFFF' } }
      worksheet.getCell('A1').alignment = { vertical: 'middle', horizontal: 'left', indent: 3 }
      worksheet.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF123B5D' } }
      worksheet.getCell('A2').value = `ACUEDUCTO CAMPOAMOR  |  Periodo: ${reportFrom || 'Sin límite'} al ${reportTo || 'Sin límite'}  |  Generado: ${new Date().toLocaleString('es-CO')}`
      worksheet.getCell('A2').font = { name: 'Aptos', size: 10, color: { argb: 'FF426579' }, italic: true }
      worksheet.getCell('A2').alignment = { vertical: 'middle', horizontal: 'left', indent: 3 }
      worksheet.getRow(1).height = 43
      worksheet.getRow(2).height = 25
      worksheet.getRow(3).height = 9
      worksheet.addImage(brandImage, { tl: { col: 0.18, row: 0.08 }, ext: { width: 38, height: 38 } })
      worksheet.addImage(watermarkImage, { tl: { col: Math.max(1, columns.length - 4), row: 5 }, ext: { width: 190, height: 190 } })
      const header = worksheet.getRow(4)
      header.values = columns
      header.height = 30
      header.eachCell((cell) => {
        cell.font = { name: 'Aptos', size: 10, bold: true, color: { argb: 'FFFFFFFF' } }
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF087F82' } }
        cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true }
        cell.border = { bottom: { style: 'medium', color: { argb: 'FF65C9B5' } } }
      })
      safeRows.forEach((record, index) => {
        const row = worksheet.addRow(columns.map((column) => record[column] ?? ''))
        row.height = 23
        row.eachCell((cell, columnNumber) => {
          cell.font = { name: 'Aptos', size: 10, color: { argb: 'FF263B4D' } }
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: index % 2 === 0 ? 'FFF2F8FA' : 'FFFFFFFF' } }
          cell.alignment = { vertical: 'middle', horizontal: typeof cell.value === 'number' ? 'right' : 'left' }
          cell.border = { bottom: { style: 'hair', color: { argb: 'FFDCE8EC' } } }
          const headerName = columns[columnNumber - 1]
          if (/monto|valor|facturado|pagado|saldo/i.test(headerName) && typeof cell.value === 'number') {
            cell.numFmt = '"$" #,##0;[Red]-"$" #,##0'
            cell.font = { name: 'Aptos', size: 10, bold: true, color: { argb: 'FF145B4B' } }
          }
          if (headerName === 'Estado') {
            const status = String(cell.value || '').toLowerCase()
            const color = status.includes('confirmado') || status === 'pagada' || status === 'activo'
              ? 'FFE1F4EB'
              : status.includes('pendiente') || status === 'vencida'
                ? 'FFFFF1D8'
                : status === 'anulada' || status === 'inactivo' ? 'FFFCE6E6' : null
            if (color) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } }
          }
        })
      })
      worksheet.autoFilter = { from: { row: 4, column: 1 }, to: { row: Math.max(4, worksheet.rowCount), column: columns.length } }
      worksheet.getColumn(1).alignment = { vertical: 'middle' }
      worksheet.headerFooter.oddFooter = '&L&HAcueducto Campoamor&CInforme de tesorería&R&P de &N'
    })
    const suffix = `${reportFrom || 'inicio'}-${reportTo || 'hoy'}`
    const buffer = await workbook.xlsx.writeBuffer()
    const file = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url = URL.createObjectURL(file)
    const link = document.createElement('a')
    link.href = url
    link.download = `informe-${report}-${suffix}.xlsx`
    link.click()
    URL.revokeObjectURL(url)
    setActionError('')
    setActionMessage('Informe Excel descargado. Los ingresos incluyen solo pagos confirmados.')
}
