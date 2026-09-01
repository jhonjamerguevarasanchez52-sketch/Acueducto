const { BrevoClient } = require('@getbrevo/brevo');

const apiKey = process.env.BREVO_API_KEY;
const remitenteCorreo = process.env.EMAIL_USER;
const remitenteNombre = process.env.EMAIL_SENDER_NAME || 'Acueducto Campoamor';

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
  return brevo.transactionalEmails.sendTransacEmail({
    subject,
    sender: { name: remitenteNombre, email: remitenteCorreo },
    to: [{ email: to }],
    htmlContent: html,
  });
}

module.exports = { enviarCorreo };
