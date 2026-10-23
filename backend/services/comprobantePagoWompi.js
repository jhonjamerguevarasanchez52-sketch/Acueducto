const paymentModel = require('../models/paymentModel');
const invoiceModel = require('../models/invoiceModel');
const profileModel = require('../models/profileModel');
const mailer = require('../config/mailer');
const { escaparHtml } = require('../utils/html');

const ZONA_HORARIA = 'America/Bogota';

function pesos(valor) {
  return `$${Math.round(Number(valor) || 0).toLocaleString('es-CO')} COP`;
}

function fechaLocal(fecha) {
  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: ZONA_HORARIA,
  }).format(new Date(fecha));
}

function construirHtml({ pago, factura, perfil }) {
  const nombre = [perfil.nombre, perfil.apellido].filter(Boolean).join(' ') || 'usuario';
  const valorServicio = Number(pago.monto ?? factura.valor_total);
  const cargoWompi = Number(pago.cargo_wompi || 0);
  const totalCobrado = Number(pago.monto_total ?? valorServicio + cargoWompi);
  const fecha = pago.fecha_confirmacion || pago.fecha_pago || new Date().toISOString();
  const numeroFactura = factura.numero_factura || factura.id;
  const detalles = factura.observacion
    ? `<p style="margin:8px 0 0;color:#475569">Detalle de la factura: ${escaparHtml(factura.observacion)}</p>`
    : '';

  return `<!doctype html>
<html lang="es"><body style="margin:0;background:#f1f5f9;font-family:Arial,sans-serif;color:#0f172a">
  <main style="max-width:620px;margin:24px auto;padding:28px;background:#fff;border-radius:12px">
    <h1 style="font-size:22px;margin:0 0 8px">Comprobante de pago aprobado</h1>
    <p>Hola ${escaparHtml(nombre)}, recibimos correctamente el pago de tu factura del Acueducto Campo Amor.</p>
    <table role="presentation" style="width:100%;border-collapse:collapse;margin:20px 0">
      <tr><td style="padding:9px;border-bottom:1px solid #e2e8f0">Factura</td><td style="padding:9px;border-bottom:1px solid #e2e8f0;text-align:right">${escaparHtml(numeroFactura)}</td></tr>
      <tr><td style="padding:9px;border-bottom:1px solid #e2e8f0">Periodo</td><td style="padding:9px;border-bottom:1px solid #e2e8f0;text-align:right">${escaparHtml(factura.periodo)}</td></tr>
      <tr><td style="padding:9px;border-bottom:1px solid #e2e8f0">Servicio del acueducto</td><td style="padding:9px;border-bottom:1px solid #e2e8f0;text-align:right">${pesos(valorServicio)}</td></tr>
      <tr><td style="padding:9px;border-bottom:1px solid #e2e8f0">Cargo de la transacción Wompi</td><td style="padding:9px;border-bottom:1px solid #e2e8f0;text-align:right">${pesos(cargoWompi)}</td></tr>
      <tr><td style="padding:12px 9px;font-weight:bold">Total pagado</td><td style="padding:12px 9px;text-align:right;font-weight:bold">${pesos(totalCobrado)}</td></tr>
    </table>
    ${detalles}
    <p><strong>Estado:</strong> Aprobado</p>
    <p><strong>Fecha del pago:</strong> ${escaparHtml(fechaLocal(fecha))} (hora de Colombia)</p>
    <p><strong>Medio:</strong> ${escaparHtml(pago.medio_pago_wompi || 'Wompi')}</p>
    <p><strong>Referencia de Wompi:</strong> ${escaparHtml(pago.id)}</p>
    <p><strong>Identificador de transacción:</strong> ${escaparHtml(pago.transaccion_id || 'No disponible')}</p>
    <p style="font-size:13px;color:#475569">Conserva este correo como comprobante. El valor del servicio corresponde a la factura; el cargo de Wompi se muestra por separado.</p>
  </main>
</body></html>`;
}

async function enviarComprobantePagoWompi(pagoId) {
  const { data: pago, error: errorPago } = await paymentModel.getById(pagoId);
  if (errorPago || !pago) throw new Error(`No se pudo consultar el pago: ${errorPago?.message || 'no existe'}`);
  if (!pago.confirmado || pago.estado_wompi !== 'APPROVED') {
    throw new Error('El pago aún no está confirmado por Wompi.');
  }
  if (pago.correo_comprobante_enviado_at) return { enviado: false, yaEnviado: true };

  const [resultadoFactura, resultadoPerfil] = await Promise.all([
    invoiceModel.getOwn(pago.factura_id, pago.perfil_id, {
      columns: 'id, numero_factura, periodo, valor_total, observacion, fecha_vencimiento',
    }),
    profileModel.getById(pago.perfil_id, { columns: 'id, nombre, apellido, correo' }),
  ]);

  if (resultadoFactura.error || !resultadoFactura.data) {
    throw new Error(`No se pudo consultar la factura: ${resultadoFactura.error?.message || 'no existe'}`);
  }
  if (resultadoPerfil.error || !resultadoPerfil.data?.correo) {
    throw new Error('El perfil no tiene un correo válido para enviar el comprobante.');
  }

  const factura = resultadoFactura.data;
  const perfil = resultadoPerfil.data;
  const respuesta = await mailer.enviarCorreo({
    to: perfil.correo,
    subject: `Comprobante de pago aprobado - factura ${factura.numero_factura || factura.id}`,
    html: construirHtml({ pago, factura, perfil }),
  });
  if (!respuesta) throw new Error('El servicio de correo no confirmó el envío. Revisa BREVO_API_KEY y EMAIL_USER.');

  const { error: errorMarca } = await paymentModel.update(pago.id, {
    correo_comprobante_enviado_at: new Date().toISOString(),
  });
  if (errorMarca) throw new Error(`El correo salió, pero no se pudo guardar su estado: ${errorMarca.message}`);

  return { enviado: true, correo: perfil.correo };
}

module.exports = { enviarComprobantePagoWompi, construirHtml, pesos };
