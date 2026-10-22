const crypto = require('crypto');
const paymentModel = require('../models/paymentModel');
const { confirmarPago } = require('../services/pagosService');
const { obtenerConfiguracionPublica } = require('../utils/wompiConfig');

const EVENTS_SECRET = process.env.WOMPI_EVENTS_SECRET;

/**
 * Verifica la firma del evento de Wompi.
 * checksum = SHA256( valores de signature.properties, en orden
 *                     + timestamp + WOMPI_EVENTS_SECRET )
 * https://docs.wompi.co/docs/colombia/eventos/
 */
function firmaValida(evento) {
  if (!EVENTS_SECRET) {
    console.error('[wompi] WOMPI_EVENTS_SECRET no está configurado');
    return false;
  }

  const props = evento?.signature?.properties;
  const checksumRecibido = evento?.signature?.checksum;
  const timestamp = evento?.timestamp;

  if (!Array.isArray(props) || !checksumRecibido || timestamp === undefined) {
    return false;
  }

  let cadena = '';
  for (const ruta of props) {
    const valor = ruta.split('.').reduce((obj, clave) => (obj == null ? obj : obj[clave]), evento.data);
    if (valor === undefined || valor === null) return false;
    cadena += valor;
  }
  cadena += timestamp;
  cadena += EVENTS_SECRET;

  const checksumCalculado = crypto.createHash('sha256').update(cadena).digest('hex');

  // Comparación en tiempo constante
  const a = Buffer.from(checksumCalculado, 'hex');
  const b = Buffer.from(String(checksumRecibido), 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// POST /api/wompi/webhook - Wompi notifica el resultado de una transacción
async function webhook(req, res) {
  const evento = req.body;

  if (!firmaValida(evento)) {
    return res.status(401).json({ error: 'Firma inválida' });
  }

  const configuracion = obtenerConfiguracionPublica();
  if (evento.environment !== configuracion.ambiente) {
    console.warn('[wompi] se rechazó un evento de un ambiente distinto al configurado.');
    return res.status(400).json({ error: 'Ambiente de Wompi no coincide' });
  }

  if (evento.event !== 'transaction.updated') {
    return res.status(200).json({ received: true, ignored: true });
  }

  try {
    const trx = evento?.data?.transaction;
    if (!trx?.reference || !trx?.status || !trx?.id) {
      return res.status(400).json({ error: 'Evento de transacción inválido' });
    }

    const referencia = trx.reference; // id del registro en payments
    const estadoWompi = trx.status; // APPROVED | DECLINED | VOIDED | ERROR
    const montoRecibidoCentavos = trx.amount_in_cents;

    const { data: pago, error: pagoError } = await paymentModel.getById(referencia, 'id, confirmado, monto');

    // Los errores operativos responden 500 para que Wompi vuelva a intentar.
    if (pagoError) {
      console.error('[wompi] error consultando pago para referencia', referencia, ':', pagoError.message);
      return res.status(500).json({ error: 'No se pudo consultar el pago' });
    }

    if (!pago) {
      console.warn('[wompi] pago no encontrado para referencia', referencia);
      return res.status(200).json({ received: true, ignored: true });
    }

    // Un pago ya confirmado no se toca: Wompi puede reenviar el evento o
    // mandar uno tardío (por ejemplo DECLINED de un intento anterior).
    if (pago.confirmado) return;

    if (estadoWompi === 'APPROVED') {
      // El monto ya viene atado a la referencia por la firma de integridad
      // (ver utils/wompiFirma.js), pero igual lo verificamos aquí: si no
      // coincide con lo que se guardó al registrar el pago, algo no cuadra
      // y no debe marcarse la factura como pagada.
      const montoEsperadoCentavos = Math.round(Number(pago.monto) * 100);
      if (montoRecibidoCentavos !== montoEsperadoCentavos) {
        console.error(
          `[wompi] monto recibido (${montoRecibidoCentavos}) no coincide con el esperado (${montoEsperadoCentavos}) para el pago ${pago.id}; no se confirma.`
        );
        const { error: updateError } = await paymentModel.update(pago.id, {
          estado_wompi: 'MONTO_INVALIDO',
          transaccion_id: trx.id,
        });
        if (updateError) throw updateError;
        return res.status(200).json({ received: true });
      }

      const resultado = await confirmarPago(pago.id, {
        estado_wompi: estadoWompi,
        transaccion_id: trx.id,
      });

      if (!resultado.ok) {
        // Wompi cobró pero el trigger rechazó el pago (por ejemplo, la factura
        // ya estaba pagada). Se deja marcado para localizarlo y devolver el dinero.
        console.error('[wompi] confirmarPago no tuvo éxito para', pago.id, ':', resultado.error);
        const { error: updateError } = await paymentModel.update(pago.id, {
          estado_wompi: 'APPROVED_NO_APLICADO',
          transaccion_id: trx.id,
        });
        if (updateError) throw updateError;
      }
    } else {
      const { error: updateError } = await paymentModel.update(pago.id, {
        estado_wompi: estadoWompi,
        transaccion_id: trx.id,
      });
      if (updateError) throw updateError;
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error('[wompi] error procesando webhook:', err.message);
    if (!res.headersSent) return res.status(500).json({ error: 'No se pudo procesar el evento de pago' });
    return undefined;
  }
}

// GET /api/wompi/config - datos públicos que necesita el frontend.
// WOMPI_INTEGRITY_KEY nunca debe salir de aquí: es el secreto con el que se
// firma cada transacción (reference + amount + currency); si el cliente lo
// tuviera, podría falsificar la firma de integridad de cualquier monto.
function config(req, res) {
  return res.status(200).json(obtenerConfiguracionPublica());
}

module.exports = { webhook, config };
