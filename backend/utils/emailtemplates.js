// Plantillas transaccionales HIDROAPP, construidas con tablas y estilos en línea
// para compatibilidad con Gmail, Outlook y pantallas móviles.
const MARCA = {
  nombre: 'HIDROAPP',
  organizacion: 'Acueducto Campo Amor',
  colorPrimario: '#087E8B',
  colorOscuro: '#123B4A',
  colorAcento: '#39B8A5',
  colorFondo: '#F1F7F7',
  logoUrl: process.env.LOGO_URL || '',
};

function escapar(texto = '') {
  return String(texto)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function plantillaCorreo({ titulo, nombre, mensaje, contenidoHtml, codigo, nota, botonTexto, botonUrl, avisoSeguridad = false }) {
  const logo = MARCA.logoUrl
    ? `<img src="${escapar(MARCA.logoUrl)}" alt="${MARCA.nombre}" width="54" style="display:block;margin:0 auto 10px;border:0;max-width:54px;height:auto;">`
    : `<div style="margin:0 auto 10px;width:48px;height:48px;line-height:48px;border-radius:50%;background:#ffffff;color:${MARCA.colorPrimario};font-size:27px;font-weight:bold;text-align:center;">&#128167;</div>`;
  const bloqueCodigo = codigo ? `
    <tr><td align="center" style="padding:12px 24px 8px;">
      <div style="display:inline-block;background:#EAF6F5;border:1px dashed ${MARCA.colorPrimario};border-radius:12px;padding:16px 26px;">
        <span style="font-family:'Courier New',monospace;font-size:32px;font-weight:bold;letter-spacing:8px;color:${MARCA.colorOscuro};">${escapar(codigo)}</span>
      </div>
    </td></tr>
    ${nota ? `<tr><td align="center" style="padding:8px 24px 0;font-family:Arial,sans-serif;font-size:13px;color:#627782;">${escapar(nota)}</td></tr>` : ''}` : '';
  const bloqueBoton = botonTexto && botonUrl ? `
    <tr><td align="center" style="padding:22px 24px 8px;">
      <a href="${escapar(botonUrl)}" style="display:inline-block;background:${MARCA.colorPrimario};color:#ffffff;font-family:Arial,sans-serif;font-size:15px;font-weight:bold;text-decoration:none;padding:14px 26px;border-radius:8px;">${escapar(botonTexto)}</a>
    </td></tr>` : '';
  const cuerpo = contenidoHtml || escapar(mensaje || '').replace(/\r?\n/g, '<br>');

  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapar(titulo)}</title></head>
<body style="margin:0;padding:0;background:${MARCA.colorFondo};font-family:Arial,Helvetica,sans-serif;color:#263A43;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${MARCA.colorFondo};padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;">
        <tr><td align="center" style="background:${MARCA.colorOscuro};background-image:linear-gradient(135deg,${MARCA.colorOscuro},${MARCA.colorPrimario});padding:28px 22px 25px;">
          ${logo}<div style="font-size:22px;font-weight:bold;letter-spacing:1.5px;color:#ffffff;">${MARCA.nombre}</div>
          <div style="font-size:13px;color:#D5EFEC;margin-top:5px;">${MARCA.organizacion}</div>
        </td></tr>
        <tr><td style="padding:28px 28px 8px;font-size:22px;line-height:1.3;font-weight:bold;color:${MARCA.colorOscuro};">${escapar(titulo)}</td></tr>
        <tr><td style="padding:8px 28px 18px;font-size:15px;line-height:1.7;color:#40545D;">
          ${nombre ? `Hola <strong>${escapar(nombre)}</strong>,<br><br>` : ''}${cuerpo}
        </td></tr>
        ${bloqueCodigo}${bloqueBoton}
        ${avisoSeguridad ? `<tr><td style="padding:12px 28px 22px;font-size:12px;line-height:1.6;color:#74858D;">Si no solicitaste este cambio, comunícate con el administrador del acueducto. Nunca compartas tus códigos.</td></tr>` : ''}
        <tr><td align="center" style="background:#EAF2F3;padding:18px 22px;font-size:12px;line-height:1.6;color:#61747C;">
          © ${new Date().getFullYear()} ${MARCA.organizacion}<br>Mensaje automático de HIDROAPP.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

const correoAviso = (nombre, mensaje, titulo = 'Aviso del Acueducto') => ({
  asunto: titulo,
  html: plantillaCorreo({ titulo, nombre, mensaje }),
});

const correoVerificacion = (nombre, codigo) => ({
  asunto: 'Verifica tu cuenta · HIDROAPP',
  html: plantillaCorreo({ titulo: 'Verifica tu cuenta', nombre, mensaje: 'Ingresa este código en la app para activar tu cuenta:', codigo, nota: 'Este código vence en 15 minutos.', avisoSeguridad: true }),
});

const correoRecuperacion = (nombre, codigo) => ({
  asunto: 'Recupera tu contraseña · HIDROAPP',
  html: plantillaCorreo({ titulo: 'Recuperación de contraseña', nombre, mensaje: 'Recibimos una solicitud para restablecer tu contraseña. Usa este código en la app:', codigo, nota: 'Este código vence en 15 minutos.', avisoSeguridad: true }),
});

const correoPasswordActualizada = (nombre) => ({
  asunto: 'Tu contraseña fue actualizada · HIDROAPP',
  html: plantillaCorreo({ titulo: 'Contraseña actualizada', nombre, mensaje: 'Tu contraseña se actualizó correctamente. Si no realizaste este cambio, contacta de inmediato al administrador del acueducto.', avisoSeguridad: true }),
});

module.exports = { MARCA, plantillaCorreo, correoAviso, correoVerificacion, correoRecuperacion, correoPasswordActualizada, escapar };
