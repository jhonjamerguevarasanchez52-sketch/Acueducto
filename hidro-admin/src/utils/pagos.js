// Reglas de los pagos en el panel. Son las mismas del backend
// (pagoController.js y la función SQL factura_tiene_pago_activo); si cambian
// allá, cambian aquí.

// Wompi no avisa cuando el usuario cierra el checkout sin pagar.
export const MINUTOS_CHECKOUT_ABANDONADO = 30

const ZONA_HORARIA = 'America/Bogota'

export function checkoutAbandonado(pago, ahora = Date.now()) {
  return pago.metodo === 'wompi' && pago.estado_wompi === 'PENDING' && !pago.transaccion_id
    && ahora - new Date(pago.fecha_pago).getTime() > MINUTOS_CHECKOUT_ABANDONADO * 60 * 1000
}

/**
 * Estado legible de un pago y qué puede hacer el administrador con él.
 * clave: confirmado | revision | wompi_en_curso | abandonado | rechazado |
 *        reemplazado | por_devolver | devuelto
 */
export function estadoPago(pago, ahora = Date.now()) {
  if (pago.confirmado) return { clave: 'confirmado', etiqueta: 'Confirmado', tono: 'ok' }
  if (pago.metodo !== 'wompi') {
    return pago.estado_wompi
      ? { clave: 'reemplazado', etiqueta: 'Reemplazado', tono: 'neutro' }
      : { clave: 'revision', etiqueta: 'Recibo por revisar', tono: 'alerta' }
  }
  switch (pago.estado_wompi) {
    case 'APPROVED_NO_APLICADO':
      return { clave: 'por_devolver', etiqueta: 'Cobrado sin aplicar · devolver', tono: 'error' }
    case 'MONTO_INVALIDO':
      return { clave: 'por_devolver', etiqueta: 'Monto inválido · devolver', tono: 'error' }
    case 'REEMBOLSADO':
      return { clave: 'devuelto', etiqueta: 'Devuelto al usuario', tono: 'neutro' }
    case 'SUPERSEDED':
      return { clave: 'reemplazado', etiqueta: 'Intento reemplazado', tono: 'neutro' }
    case 'DECLINED':
    case 'VOIDED':
    case 'ERROR':
      return { clave: 'rechazado', etiqueta: 'Rechazado por Wompi', tono: 'neutro' }
    default:
      return checkoutAbandonado(pago, ahora)
        ? { clave: 'abandonado', etiqueta: 'Checkout abandonado', tono: 'neutro' }
        : { clave: 'wompi_en_curso', etiqueta: 'En curso en Wompi', tono: 'alerta' }
  }
}

// Dinero que todavía puede entrar: recibos por revisar y pagos en curso en Wompi.
export function esPagoPendiente(pago, ahora = Date.now()) {
  const { clave } = estadoPago(pago, ahora)
  return clave === 'revision' || clave === 'wompi_en_curso'
}

// Pagos que esperan una acción del administrador.
export function requiereAccion(pago, ahora = Date.now()) {
  const { clave } = estadoPago(pago, ahora)
  return clave === 'revision' || clave === 'por_devolver'
}

/**
 * Acciones disponibles en la tabla de pagos.
 * - confirmar: solo recibos físicos (Wompi se confirma solo por su webhook).
 * - eliminar: recibos físicos e intentos rechazados (no hubo cobro).
 * - liberar: checkout abandonado (se marca reemplazado, no se borra).
 * - devolver: Wompi cobró sin aplicar; se marca tras devolver el dinero.
 */
export function accionesPago(pago, ahora = Date.now()) {
  switch (estadoPago(pago, ahora).clave) {
    case 'revision': return ['confirmar', 'eliminar']
    case 'rechazado': return ['eliminar']
    case 'abandonado': return ['liberar']
    case 'por_devolver': return ['devolver']
    default: return []
  }
}

// Fecha en que el dinero se dio por recibido: la de confirmación si la hay.
export function fechaRecaudo(pago) {
  return (pago.confirmado && pago.fecha_confirmacion) || pago.fecha_pago || null
}

// Día de calendario en Colombia (AAAA-MM-DD) de una marca de tiempo.
export function diaColombia(valor) {
  if (!valor) return ''
  const fecha = new Date(valor)
  if (Number.isNaN(fecha.getTime())) return String(valor).slice(0, 10)
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA_HORARIA, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(fecha)
}
