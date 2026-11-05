const { enviarCorreo, esCupoAgotado } = require('../config/mailer');
const { correoAviso } = require('../utils/emailtemplates');
const { mapearConLimite } = require('../utils/concurrencia');

// Correos simultáneos hacia Brevo. Más que esto no acelera nada y arriesga
// que Brevo rechace el lote por exceso de peticiones.
const CORREOS_A_LA_VEZ = 5;

// Envía el mismo aviso por correo a varios perfiles. Un correo que falla no
// detiene a los demás, salvo que Brevo diga que se agotó el cupo del plan: ahí
// no tiene sentido seguir intentando. Devuelve cuántos salieron, cuántos
// fallaron y si se agotó el cupo.
async function enviarAvisosCorreo(perfiles, mensaje) {
  let cupoAgotado = false;

  const resultados = await mapearConLimite(perfiles, CORREOS_A_LA_VEZ, async (perfil) => {
    if (!perfil.correo || cupoAgotado) return false;
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
      if (esCupoAgotado(errorCorreo)) {
        if (!cupoAgotado) console.error('[avisos] Brevo rechazó el envío por cupo agotado; se detienen los correos restantes.');
        cupoAgotado = true;
      } else {
        console.error(`[avisos] No se pudo enviar correo a ${perfil.correo}:`, errorCorreo.message);
      }
      return false;
    }
  });

  const enviados = resultados.filter(Boolean).length;
  return { enviados, fallidos: resultados.length - enviados, cupoAgotado };
}

module.exports = { enviarAvisosCorreo, CORREOS_A_LA_VEZ };
