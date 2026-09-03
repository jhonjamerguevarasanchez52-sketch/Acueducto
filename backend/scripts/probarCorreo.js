/**
 * Script de prueba del envío de correos (Brevo).
 *
 *   node scripts/probarCorreo.js                → envía a EMAIL_USER
 *   node scripts/probarCorreo.js otro@correo.com → envía a esa dirección
 *
 * Sirve para verificar que BREVO_API_KEY y el remitente (EMAIL_USER)
 * están bien configurados antes de depender de ellos en el registro.
 */
require('dotenv').config();
const { enviarCorreo } = require('../config/mailer');

const destino = process.argv[2] || process.env.EMAIL_USER;

async function main() {
  console.log('BREVO_API_KEY:', process.env.BREVO_API_KEY ? 'definida ✅' : 'FALTA ❌');
  console.log('EMAIL_USER   :', process.env.EMAIL_USER || 'FALTA ❌');
  console.log('Enviando correo de prueba a:', destino);
  console.log('---');

  if (!destino) {
    console.error('No hay destinatario. Define EMAIL_USER o pásalo como argumento.');
    process.exit(1);
  }

  try {
    const respuesta = await enviarCorreo({
      to: destino,
      subject: 'Prueba de correo - Acueducto Campoamor',
      html: `<p>Este es un correo de prueba enviado desde el backend.</p>
             <p>Fecha: ${new Date().toLocaleString('es-CO')}</p>
             <p>Si lo recibes, la configuración de Brevo funciona correctamente. 🚰</p>`,
    });
    console.log('Correo enviado ✅');
    console.log('Respuesta de Brevo:', JSON.stringify(respuesta, null, 2));
  } catch (err) {
    console.error('Falló el envío ❌');
    console.error('Mensaje:', err.message);
    if (err.body) console.error('Detalle Brevo:', JSON.stringify(err.body, null, 2));
    if (err.response?.body) console.error('Detalle:', JSON.stringify(err.response.body, null, 2));
    process.exit(1);
  }
}

main();
