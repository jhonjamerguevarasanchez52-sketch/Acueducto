const supabaseAdmin = require('../config/supabaseAdminClient');

// Registra una acción del administrador en admin_audit_log. Nunca rompe la
// petición: si falla el registro, solo lo deja en el log del servidor.
async function registrarAuditoria({ adminId, accion, tabla, registroId, detalle }) {
  // Sin un administrador identificado no hay a quién atribuir la acción.
  if (!adminId) return;
  try {
    const { error } = await supabaseAdmin.from('admin_audit_log').insert({
      admin_id: adminId,
      accion,
      tabla,
      registro_id: registroId || null,
      detalle: detalle || null,
    });

    if (error) {
      console.error('No se pudo registrar auditoría:', error.message);
    }
  } catch (err) {
    console.error('No se pudo registrar auditoría:', err.message);
  }
}

module.exports = { registrarAuditoria };
