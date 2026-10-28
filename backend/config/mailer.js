const { BrevoClient } = require('@getbrevo/brevo');

const apiKey = process.env.BREVO_API_KEY;
const remitenteCorreo = process.env.EMAIL_USER;
const remitenteNombre = process.env.EMAIL_SENDER_NAME || 'Acueducto Campo Amor';
const nombreAcueducto = 'Acueducto Campo Amor';

function escaparHtml(valor) {
  return String(valor).replace(/[&<>"']/g, (caracter) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[caracter]);
}

// Plantilla compatible con clientes de correo: estilos en línea y tablas para
// que el mismo diseño se conserve en Gmail, Outlook y dispositivos móviles.
function construirCorreoHtml({ subject, html }) {
  // Algunas plantillas (avisos y comprobantes) ya son documentos HTML
  // completos y tienen su propio diseño. No anidar un segundo <html> dentro.
  if (typeof html === 'string' && /<!doctype\s+html|<html(?:\s|>)/i.test(html)) {
    return html;
  }

  const titulo = escaparHtml(subject || nombreAcueducto);
  return `<!doctype html>
<html lang="es">
  <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"></head>
  <body style="margin:0;padding:0;background-color:#eef4f7;font-family:Arial,Helvetica,sans-serif;color:#183447;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${titulo} · ${nombreAcueducto}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#eef4f7;padding:32px 12px;">
      <tr><td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:600px;background:#ffffff;border:1px solid #dce8ee;border-radius:12px;overflow:hidden;">
          <tr><td style="padding:25px 32px;background-color:#0a3665;border-bottom:4px solid #35a7d8;">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr>
              <td valign="middle" style="padding-right:13px;"><span style="display:block;width:42px;height:42px;line-height:42px;text-align:center;border-radius:50%;background:#ffffff;color:#0a6682;font-size:13px;font-weight:bold;letter-spacing:.4px;">AC</span></td>
              <td valign="middle"><div style="color:#ffffff;font-size:18px;font-weight:bold;letter-spacing:.2px;">${nombreAcueducto}</div><div style="margin-top:4px;color:#c9e5f2;font-size:12px;">Servicio de acueducto · Campo Amor</div></td>
            </tr></table>
          </td></tr>
          <tr><td style="padding:32px;color:#294554;font-size:15px;line-height:1.65;">
            <h1 style="margin:0 0 22px;color:#0a3665;font-size:21px;line-height:1.3;">${titulo}</h1>
            <div style="font-size:15px;line-height:1.7;">${html || ''}</div>
          </td></tr>
          <tr><td style="padding:20px 32px;background:#f5f9fb;border-top:1px solid #e2edf2;color:#607987;font-size:12px;line-height:1.6;">
            <strong style="color:#315365;">${nombreAcueducto}</strong><br>
            Mensaje automático enviado desde la aplicación. Si necesitas ayuda, comunícate con la administración del acueducto.
          </td></tr>
        </table>
        <div style="padding:16px 8px 0;color:#8296a0;font-size:11px;line-height:1.5;text-align:center;">Cuidamos el agua y mantenemos informada a nuestra comunidad.</div>
      </td></tr>
    </table>
  </body>
</html>`;
}

if (!apiKey) {
  console.warn('[mailer] BREVO_API_KEY no está definido: los correos no se enviarán.');
}
if (!remitenteCorreo) {
  console.warn('[mailer] EMAIL_USER no está definido: falta el remitente verificado en Brevo.');
}

const brevo = new BrevoClient({ apiKey });

/**
 * Envía un correo transaccional a través de Brevo.
 * Mantiene la misma firma que la implementación anterior con Nodemailer
 * para no tocar los controladores que ya la usan.
 *
 * @param {{ to: string, subject: string, html: string }} opciones
 */
async function enviarCorreo({ to, subject, html }) {
  if (!apiKey || !remitenteCorreo) {
    console.warn('[mailer] Correo no enviado: falta BREVO_API_KEY o EMAIL_USER.');
    return null;
  }
  return brevo.transactionalEmails.sendTransacEmail({
    subject,
    sender: { name: remitenteNombre, email: remitenteCorreo },
    to: [{ email: to }],
    htmlContent: construirCorreoHtml({ subject, html }),
  });
}

module.exports = { enviarCorreo, construirCorreoHtml };
