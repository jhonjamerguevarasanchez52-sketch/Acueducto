const supabaseAdmin = require('../config/supabaseAdminClient');
const { notificar } = require('../utils/notificar');
const { enviarCorreo } = require('../config/mailer');
const { escaparHtml } = require('../utils/html');
const { fechaHoraColombia } = require('../utils/fechas');

// Notifica a los fontaneros activos sin convertir un fallo de correo en un
// falso error del reporte que ya quedó guardado.
async function notificarNuevaAveria(averia) {
  try {
    const [{ data: fontaneros, error }, { data: reportante }] = await Promise.all([
      supabaseAdmin
        .from('profiles')
        .select('id,correo')
        .eq('rol', 'fontanero')
        .eq('activo', true),
      supabaseAdmin
        .from('profiles')
        .select('nombre,apellido,correo,telefono,zona,direccion')
        .eq('id', averia.perfil_id)
        .maybeSingle(),
    ]);

    if (error) throw error;
    if (!fontaneros || fontaneros.length === 0) {
      console.warn('[averías] Reporte guardado sin fontanero activo para notificar.');
      return;
    }

    const nombre = [reportante?.nombre, reportante?.apellido].filter(Boolean).join(' ') || 'No disponible';
    const ubicacion = [averia.direccion || reportante?.direccion, averia.zona || reportante?.zona]
      .filter(Boolean).join(' · ') || 'No registrada';
    const html = `<p>Se reportó una nueva avería:</p>
      <p><strong>Reportó:</strong> ${escaparHtml(nombre)}</p>
      <p><strong>Correo:</strong> ${escaparHtml(reportante?.correo)}</p>
      <p><strong>Teléfono:</strong> ${escaparHtml(reportante?.telefono)}</p>
      <p><strong>Ubicación:</strong> ${escaparHtml(ubicacion)}</p>
      <p><strong>Descripción:</strong> ${escaparHtml(averia.descripcion)}</p>
      <p><strong>Fecha:</strong> ${escaparHtml(fechaHoraColombia(averia.fecha_reporte))} (hora de Colombia)</p>`;

    // allSettled: si falla un correo, igual se crean los avisos dentro de la app.
    const resultados = await Promise.allSettled(fontaneros.flatMap((fontanero) => [
      enviarCorreo({
        to: fontanero.correo,
        subject: 'Nueva avería reportada - Acueducto Campo Amor',
        html,
      }),
      notificar(fontanero.id, `Nueva avería de ${nombre}, en ${ubicacion}. ${averia.descripcion}`, 'averia'),
    ]));
    for (const r of resultados) {
      if (r.status === 'rejected') console.error('Error avisando al fontanero:', r.reason?.message);
    }
  } catch (error) {
    console.error('Error avisando al fontanero por correo:', error.message);
  }
}

module.exports = { notificarNuevaAveria };
