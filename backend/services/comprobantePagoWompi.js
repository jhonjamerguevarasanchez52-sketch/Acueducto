const paymentModel = require('../models/paymentModel');
const invoiceModel = require('../models/invoiceModel');
const profileModel = require('../models/profileModel');
const mailer = require('../config/mailer');
const { escaparHtml } = require('../utils/html');
const { MARCA } = require('../utils/emailtemplates');
const { agregarMeses, listarPeriodos, nombrePeriodo } = require('./planPagoServicio');

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

// '2027-05-01' -> '1 de mayo de 2027' (fecha sin hora, no se corre de día).
function fechaCorta(fecha) {
  return new Intl.DateTimeFormat('es-CO', { dateStyle: 'long', timeZone: 'UTC' })
    .format(new Date(`${String(fecha).slice(0, 10)}T00:00:00Z`));
}

const MEDIOS_WOMPI = {
  CARD: 'Tarjeta débito o crédito',
  PSE: 'PSE',
  NEQUI: 'Nequi',
  BANCOLOMBIA_TRANSFER: 'Transferencia Bancolombia',
  BANCOLOMBIA_QR: 'QR Bancolombia',
  BANCOLOMBIA_COLLECT: 'Corresponsal Bancolombia',
  DAVIPLATA: 'Daviplata',
  PCOL: 'Puntos Colombia',
};

const nombrePlan = (meses) => ({ 1: 'Mensual', 6: 'Semestral', 12: 'Anual' })[meses] || `${meses} meses`;

// Factura de pago para el correo: tablas y estilos en línea para que se vea
// igual en Gmail, Outlook y el celular.
function construirHtml({ pago, factura, perfil }) {
  const e = escaparHtml;
  const nombre = [perfil.nombre, perfil.apellido].filter(Boolean).join(' ') || 'Usuario';
  const valorServicio = Number(pago.monto ?? factura.valor_total);
  const cargoWompi = Number(pago.cargo_wompi || 0);
  const totalCobrado = Number(pago.monto_total ?? valorServicio + cargoWompi);
  const fecha = pago.fecha_confirmacion || pago.fecha_pago || new Date().toISOString();
  const numeroFactura = factura.numero_factura || factura.id;
  const esServicio = factura.tipo !== 'extraordinaria';
  const periodos = esServicio
    ? listarPeriodos(factura.periodo_inicio || factura.periodo, factura.periodo_fin)
    : [];
  const meses = periodos.length || 1;
  const textoPeriodo = periodos.length > 1
    ? `${nombrePeriodo(periodos[0])} a ${nombrePeriodo(periodos[periodos.length - 1])}`
    : nombrePeriodo(factura.periodo);
  const proximoPeriodo = periodos.length ? agregarMeses(periodos[periodos.length - 1], 1) : null;
  const fechaProxima = factura.fecha_proxima_facturacion
    || (proximoPeriodo ? `${agregarMeses(proximoPeriodo, 1)}-01` : null);
  const medio = MEDIOS_WOMPI[pago.medio_pago_wompi] || pago.medio_pago_wompi || 'Wompi';
  const { colorPrimario, colorOscuro, colorFondo, nombre: marca, organizacion, logoUrl } = MARCA;

  const celda = 'padding:11px 14px;border-bottom:1px solid #E3ECEE;font-size:14px;color:#263A43;';
  const lineas = esServicio
    ? periodos.map((periodo) => `
          <tr data-concepto="mensualidad">
            <td style="${celda}">Servicio de acueducto<br><span style="font-size:12px;color:#74858D;">Mensualidad</span></td>
            <td style="${celda}">${e(nombrePeriodo(periodo))}</td>
            <td style="${celda}text-align:right;white-space:nowrap;">${pesos(valorServicio / meses)}</td>
          </tr>`).join('')
    : `
          <tr data-concepto="extraordinaria">
            <td style="${celda}">${e(factura.observacion || 'Cuota extraordinaria')}</td>
            <td style="${celda}">${e(factura.periodo || '—')}</td>
            <td style="${celda}text-align:right;white-space:nowrap;">${pesos(valorServicio)}</td>
          </tr>`;
  const dato = (etiqueta, valor) => `
              <tr><td style="padding:3px 0;font-size:13px;color:#74858D;">${etiqueta}</td></tr>
              <tr><td style="padding:0 0 8px;font-size:14px;color:#263A43;font-weight:bold;">${valor}</td></tr>`;
  const datosSuscriptor = [
    dato('Nombre', e(nombre)),
    perfil.correo ? dato('Correo', e(perfil.correo)) : '',
    perfil.direccion ? dato('Dirección', e(perfil.direccion)) : '',
    perfil.zona ? dato('Zona', e(perfil.zona)) : '',
    perfil.numero_lote ? dato('Lote', e(perfil.numero_lote)) : '',
    perfil.telefono ? dato('Teléfono', e(perfil.telefono)) : '',
  ].join('');
  const datosFactura = [
    dato('Factura N.º', e(numeroFactura)),
    dato('Fecha de pago', e(fechaLocal(fecha))),
    esServicio ? dato('Plan', `${nombrePlan(meses)} (${meses} ${meses === 1 ? 'mensualidad' : 'mensualidades'})`) : dato('Tipo', 'Cuota extraordinaria'),
    dato(periodos.length > 1 ? 'Periodo cubierto' : 'Periodo', e(textoPeriodo)),
    esServicio && factura.observacion ? dato('Nota', e(factura.observacion)) : '',
  ].join('');
  const logo = logoUrl
    ? `<img src="${e(logoUrl)}" alt="${marca}" width="44" height="44" style="display:block;border:0;border-radius:10px;">`
    : '<div style="width:44px;height:44px;line-height:44px;border-radius:10px;background:#ffffff;text-align:center;font-size:24px;">&#128167;</div>';
  const proxima = proximoPeriodo ? `
        <tr><td style="padding:0 28px 22px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#EAF6F5;border-radius:12px;">
            <tr><td style="padding:16px 18px;font-size:14px;line-height:1.6;color:${colorOscuro};">
              <strong>Próxima factura:</strong> ${e(nombrePeriodo(proximoPeriodo))}, se genera el ${e(fechaCorta(fechaProxima))}.
              ${periodos.length > 1 ? '<br>Mientras tu plan esté vigente no recibirás facturas mensuales.' : ''}
            </td></tr>
          </table>
        </td></tr>` : '';

  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:${colorFondo};font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${colorFondo};">
    <tr><td align="center" style="padding:24px 12px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;">
        <tr><td style="background:${colorOscuro};padding:22px 28px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td width="52" valign="middle">${logo}</td>
              <td valign="middle" style="padding-left:12px;">
                <div style="font-size:19px;font-weight:bold;letter-spacing:1.5px;color:#ffffff;">${marca}</div>
                <div style="font-size:12px;color:#BFE3E0;">${organizacion}</div>
              </td>
              <td align="right" valign="middle">
                <div style="font-size:11px;letter-spacing:1px;color:#BFE3E0;">FACTURA DE PAGO</div>
                <div style="font-size:20px;font-weight:bold;color:#ffffff;">N.º ${e(numeroFactura)}</div>
              </td>
            </tr>
          </table>
        </td></tr>
        <tr><td style="padding:26px 28px 6px;">
          <span style="display:inline-block;background:#E3F6EC;color:#16794A;font-size:12px;font-weight:bold;letter-spacing:1px;padding:6px 12px;border-radius:20px;">&#10003; PAGADA</span>
          <h1 style="margin:14px 0 6px;font-size:22px;color:${colorOscuro};">Comprobante de pago aprobado</h1>
          <p style="margin:0;font-size:15px;line-height:1.6;color:#40545D;">Hola ${e(nombre)}, recibimos correctamente tu pago. Este correo es tu constancia: consérvalo.</p>
        </td></tr>
        <tr><td style="padding:18px 28px 8px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td valign="top" width="50%" style="padding-right:10px;">
                <div style="font-size:11px;font-weight:bold;letter-spacing:1px;color:${colorPrimario};padding-bottom:6px;">FACTURADO A</div>
                <table role="presentation" cellpadding="0" cellspacing="0">${datosSuscriptor}</table>
              </td>
              <td valign="top" width="50%" style="padding-left:10px;">
                <div style="font-size:11px;font-weight:bold;letter-spacing:1px;color:${colorPrimario};padding-bottom:6px;">DATOS DE LA FACTURA</div>
                <table role="presentation" cellpadding="0" cellspacing="0">${datosFactura}</table>
              </td>
            </tr>
          </table>
        </td></tr>
        <tr><td style="padding:12px 28px 4px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E3ECEE;border-radius:12px;border-collapse:separate;overflow:hidden;">
            <tr style="background:#F4F8F9;">
              <td style="padding:10px 14px;font-size:11px;font-weight:bold;letter-spacing:1px;color:#61747C;">CONCEPTO</td>
              <td style="padding:10px 14px;font-size:11px;font-weight:bold;letter-spacing:1px;color:#61747C;">PERIODO</td>
              <td style="padding:10px 14px;font-size:11px;font-weight:bold;letter-spacing:1px;color:#61747C;text-align:right;">VALOR</td>
            </tr>${lineas}
            <tr>
              <td colspan="2" style="padding:10px 14px;font-size:14px;color:#40545D;">Servicio del acueducto (valor neto)</td>
              <td style="padding:10px 14px;font-size:14px;color:#40545D;text-align:right;white-space:nowrap;">${pesos(valorServicio)}</td>
            </tr>
            <tr>
              <td colspan="2" style="padding:4px 14px 10px;font-size:14px;color:#40545D;">Comisión de la pasarela Wompi</td>
              <td style="padding:4px 14px 10px;font-size:14px;color:#40545D;text-align:right;white-space:nowrap;">${pesos(cargoWompi)}</td>
            </tr>
            <tr style="background:${colorPrimario};">
              <td colspan="2" style="padding:14px;font-size:15px;font-weight:bold;color:#ffffff;">Total pagado</td>
              <td style="padding:14px;font-size:18px;font-weight:bold;color:#ffffff;text-align:right;white-space:nowrap;">${pesos(totalCobrado)}</td>
            </tr>
          </table>
        </td></tr>
        <tr><td style="padding:18px 28px 18px;">
          <div style="font-size:11px;font-weight:bold;letter-spacing:1px;color:${colorPrimario};padding-bottom:8px;">DATOS DE LA TRANSACCIÓN</div>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;color:#40545D;">
            <tr><td style="padding:4px 0;color:#74858D;">Estado</td><td style="padding:4px 0;text-align:right;font-weight:bold;color:#16794A;">Aprobado</td></tr>
            <tr><td style="padding:4px 0;color:#74858D;">Medio de pago</td><td style="padding:4px 0;text-align:right;">${e(medio)}</td></tr>
            <tr><td style="padding:4px 0;color:#74858D;">Transacción Wompi</td><td style="padding:4px 0;text-align:right;">${e(pago.transaccion_id || 'No disponible')}</td></tr>
            <tr><td style="padding:4px 0;color:#74858D;">Referencia</td><td style="padding:4px 0;text-align:right;word-break:break-all;">${e(pago.id)}</td></tr>
            <tr><td style="padding:4px 0;color:#74858D;">Fecha y hora</td><td style="padding:4px 0;text-align:right;">${e(fechaLocal(fecha))} (hora de Colombia)</td></tr>
          </table>
        </td></tr>${proxima}
        <tr><td style="background:#EAF2F3;padding:18px 28px;font-size:12px;line-height:1.6;color:#61747C;text-align:center;">
          El valor del servicio llega completo al ${organizacion}; la comisión de Wompi se cobra aparte para cubrir la pasarela de pago.<br>
          También puedes consultar esta factura en la app ${marca}, en <strong>Mis facturas</strong>.
        </td></tr>
      </table>
    </td></tr>
  </table>
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
      columns: 'id, numero_factura, tipo, periodo, periodo_inicio, periodo_fin, meses_cubiertos, '
        + 'valor_total, observacion, fecha_vencimiento, fecha_proxima_facturacion',
    }),
    profileModel.getById(pago.perfil_id, {
      columns: 'id, nombre, apellido, correo, telefono, direccion, zona, numero_lote',
    }),
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
    subject: `Factura N.º ${factura.numero_factura || factura.id} pagada - Acueducto Campo Amor`,
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
