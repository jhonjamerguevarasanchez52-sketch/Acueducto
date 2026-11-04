const { enviarCorreo } = require('../config/mailer');
const { correoAviso } = require('../utils/emailtemplates');

// Envía el mismo aviso por correo a varios perfiles. Un correo que falla no
// detiene a los demás. Devuelve cuántos salieron y cuántos fallaron.
async function enviarAvisosCorreo(perfiles, mensaje) {
  const resultados = await Promise.all(perfiles.map(async (perfil) => {
    if (!perfil.correo) return false;
    try {
      const correo = correoAviso(perfil.nombre || '', mensaje);
      const respuesta = await enviarCorreo({
        to: perfil.correo,
        subject: correo.asunto,
        html: correo.html,
      });
      if (!respuesta) throw new Error('El servicio de correo no confirmó el envío.');
      return true;
    } catch (errorCorreo) {
      console.error(`[avisos] No se pudo enviar correo a ${perfil.correo}:`, errorCorreo.message);
      return false;
    }
  }));
  const enviados = resultados.filter(Boolean).length;
  return { enviados, fallidos: resultados.length - enviados };
}

module.exports = { enviarAvisosCorreo };
