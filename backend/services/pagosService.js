const supabaseAdmin = require('../config/supabaseAdminClient');
const { notificar } = require('../utils/notificar');

/**
 * Marca un pago como confirmado y su factura asociada como pagada.
 * Lo usan tanto la confirmación manual del administrador como el webhook
 * de Wompi, para que la lógica de "aplicar un pago" viva en un solo sitio.
 *
 * @param {string} pagoId      id del registro en payments
 * @param {object} [extra]     campos adicionales a guardar en el pago
 *                             (por ejemplo estado_wompi, transaccion_id)
 * @returns {{ ok: boolean, error?: string, pago?: object }}
 */
async function confirmarPago(pagoId, extra = {}) {
  const { data: pago, error: pagoError } = await supabaseAdmin
    .from('payments')
    .select('*')
    .eq('id', pagoId)
    .single();

  if (pagoError || !pago) {
    return { ok: false, error: 'Pago no encontrado' };
  }

  if (pago.confirmado) {
    return { ok: true, pago }; // idempotente: ya estaba confirmado
  }

  const { data: pagoActualizado, error: updateError } = await supabaseAdmin
    .from('payments')
    .update({
      confirmado: true,
      fecha_confirmacion: new Date().toISOString(),
      ...extra,
    })
    .eq('id', pagoId)
    .select()
    .single();

  if (updateError) {
    return { ok: false, error: updateError.message };
  }

  if (pago.factura_id) {
    const { error: facturaError } = await supabaseAdmin
      .from('invoices')
      .update({ estado: 'pagada' })
      .eq('id', pago.factura_id);

    if (facturaError) {
      // El pago ya quedó marcado como confirmado (el dinero sí se recibió),
      // pero la factura no se pudo actualizar: no lo ocultamos como éxito,
      // para que quede visibles en logs y alguien lo corrija a mano.
      console.error(
        `[pagos] el pago ${pagoId} se confirmó pero la factura ${pago.factura_id} no se pudo marcar como pagada:`,
        facturaError.message
      );
      return {
        ok: false,
        error: 'El pago se confirmó, pero no se pudo actualizar la factura. Contacta al administrador.',
        pago: pagoActualizado,
      };
    }
  }

  await notificar(
    pago.perfil_id,
    `Tu pago por $${pago.monto} fue confirmado. ¡Gracias!`,
    'pago'
  );

  return { ok: true, pago: pagoActualizado };
}

module.exports = { confirmarPago };
