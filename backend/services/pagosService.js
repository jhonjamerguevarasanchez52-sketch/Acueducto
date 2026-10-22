const paymentModel = require('../models/paymentModel');

/**
 * Marca un pago como confirmado.
 * Lo usan tanto la confirmación manual del administrador como el webhook
 * de Wompi, para que la lógica de "aplicar un pago" viva en un solo sitio.
 *
 * Al pasar `confirmado` a true, el trigger procesar_pago_confirmado de la
 * base de datos se encarga de lo demás, todo en una sola transacción:
 * valida la factura (monto, dueño, que no esté pagada o anulada), la marca
 * como pagada, notifica al usuario, reconecta el servicio si estaba cortado
 * y rechaza los otros pagos pendientes de la misma factura. Si alguna
 * validación falla, el trigger lanza una excepción y el pago NO queda
 * confirmado.
 *
 * @param {string} pagoId      id del registro en payments
 * @param {object} [extra]     campos adicionales a guardar en el pago
 *                             (por ejemplo estado_wompi, transaccion_id)
 * @returns {{ ok: boolean, error?: string, pago?: object }}
 */
async function confirmarPago(pagoId, extra = {}) {
  const { data: pago, error: pagoError } = await paymentModel.getById(pagoId);

  if (pagoError || !pago) {
    return { ok: false, error: 'Pago no encontrado' };
  }

  // Repetir una confirmación ya aplicada no debe cambiar la fecha ni volver
  // a disparar el trigger que procesa la factura.
  if (pago.confirmado) return { ok: true, pago };

  const { data: pagoActualizado, error: updateError } = await paymentModel.update(pagoId, {
    confirmado: true,
    fecha_confirmacion: new Date().toISOString(),
    ...extra,
  });

  if (updateError) {
    // Incluye los rechazos del trigger (factura ya pagada, monto distinto, etc.)
    return { ok: false, error: updateError.message };
  }

  return { ok: true, pago: pagoActualizado };
}

module.exports = { confirmarPago };
