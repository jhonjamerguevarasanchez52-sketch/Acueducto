git restore frontend/hidroapp/pubspec.lock// backend/utils/emailTemplates.js
// Plantilla HTML corporativa para los correos de HIDROAPP.
// Usa tablas + estilos en línea para que se vea igual en Gmail, Outlook y móvil.

const MARCA = {
  nombre: 'HIDROAPP',
  organizacion: 'Acueducto Campo Amor',
  colorPrimario: '#0B6FA4',   // azul agua (cámbialo por el color de tu logo)
  colorOscuro: '#08496B',
  colorAcento: '#19B5C9',     // turquesa
  colorFondo: '#EEF4F8',
  // Debe ser una URL pública (https).
  logoUrl: process.env.LOGO_URL || '',
};

function escapar(texto = '') {
  return String(texto)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function plantillaCorreo({ titulo, nombre, mensaje, codigo, nota, botonTexto, botonUrl }) {
  const logo = MARCA.logoUrl
    ? `<img src="${MARCA.logoUrl}" alt="${MARCA.nombre}" width="90" style="display:block;margin:0 auto 12px;border:0;max-width:90px;height:auto;">`
    : '';

  const bloqueCodigo = codigo
    ? `
    <tr><td align="center" style="padding:8px 32px 8px;">
      <div style="display:inline-block;background:${MARCA.colorFondo};border:2px dashed ${MARCA.colorPrimario};border-radius:12px;padding:16px 32px;">
        <span style="font-family:'Courier New',monospace;font-size:34px;font-weight:bold;letter-spacing:10px;color:${MARCA.colorOscuro};">${escapar(codigo)}</span>
      </div>
    </td></tr>
    ${nota ? `<tr><td align="center" style="padding:8px 32px 0;font-family:Arial,sans-serif;font-size:13px;color:#6B7C88;">${escapar(nota)}</td></tr>` : ''}`
    : '';

  const bloqueBoton = botonTexto && botonUrl
    ? `
    <tr><td align="center" style="padding:24px 32px 8px;">
      <a href="${botonUrl}" style="display:inline-block;background:${MARCA.colorPrimario};color:#ffffff;font-family:Arial,sans-serif;font-size:16px;font-weight:bold;text-decoration:none;padding:14px 32px;border-radius:8px;">${escapar(botonTexto)}</a>
    </td></tr>`
    : '';

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapar(titulo)}</title>
</head>
<body style="margin:0;padding:0;background:${MARCA.colorFondo};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${MARCA.colorFondo};padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 18px rgba(8,73,107,0.12);">

        <!-- Encabezado con logo -->
        <tr><td align="center" style="background:${MARCA.colorPrimario};background-image:linear-gradient(135deg,${MARCA.colorOscuro},${MARCA.colorPrimario} 60%,${MARCA.colorAcento});padding:32px 24px;">
          ${logo}
          <div style="font-family:Arial,sans-serif;font-size:26px;font-weight:bold;color:#ffffff;letter-spacing:2px;">${MARCA.nombre}</div>
          <div style="font-family:Arial,sans-serif;font-size:13px;color:#D6F2F7;margin-top:4px;">${MARCA.organizacion}</div>
        </td></tr>

        <!-- Título -->
        <tr><td style="padding:32px 32px 8px;font-family:Arial,sans-serif;font-size:22px;font-weight:bold;color:${MARCA.colorOscuro};">
          ${escapar(titulo)}
        </td></tr>

        <!-- Mensaje -->
        <tr><td style="padding:8px 32px 16px;font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#33434F;">
          ${nombre ? `Hola <strong>${escapar(nombre)}</strong>,<br><br>` : ''}${escapar(mensaje)}
        </td></tr>

        ${bloqueCodigo}
        ${bloqueBoton}

        <!-- Aviso de seguridad -->
        <tr><td style="padding:24px 32px 8px;font-family:Arial,sans-serif;font-size:12px;line-height:1.5;color:#8A99A5;">
          Si tú no solicitaste este correo, puedes ignorarlo con tranquilidad. Nunca compartas tus códigos con nadie.
        </td></tr>

        <!-- Pie -->
        <tr><td align="center" style="background:${MARCA.colorOscuro};padding:20px 24px;font-family:Arial,sans-serif;font-size:12px;color:#BFD6E3;">
          © ${new Date().getFullYear()} ${MARCA.organizacion} · ${MARCA.nombre}<br>
          Este es un mensaje automático, por favor no respondas a este correo.
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

const correoVerificacion = (nombre, codigo) => ({
  asunto: 'Verifica tu cuenta · HIDROAPP',
  html: plantillaCorreo({
    titulo: 'Verifica tu cuenta',
    nombre,
    mensaje: 'Ingresa este código en la app para activar tu cuenta:',
    codigo,
    nota: 'Este código vence en 15 minutos.',
  }),
});

const correoRecuperacion = (nombre, codigo) => ({
  asunto: 'Recupera tu contraseña · HIDROAPP',
  html: plantillaCorreo({
    titulo: 'Recuperación de contraseña',
    nombre,
    mensaje: 'Recibimos una solicitud para restablecer tu contraseña. Usa este código en la app:',
    codigo,
    nota: 'Este código vence en 15 minutos.',
  }),
});

const correoPasswordActualizada = (nombre) => ({
  asunto: 'Tu contraseña fue actualizada · HIDROAPP',
  html: plantillaCorreo({
    titulo: 'Contraseña actualizada',
    nombre,
    mensaje:
      'Tu contraseña se actualizó correctamente. Si no realizaste este cambio, contacta de inmediato al administrador del acueducto.',
  }),
});

module.exports = {
  plantillaCorreo,
  correoVerificacion,
  correoRecuperacion,
  correoPasswordActualizada,
};