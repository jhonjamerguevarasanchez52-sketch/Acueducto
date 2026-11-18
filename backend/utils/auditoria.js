const supabaseAdmin = require('../config/supabaseAdminClient');

// Registra una acción del administrador. Nunca rompe la petición:
// si falla el registro, solo lo deja en el log del servidor.
async function registrarAuditoria({ adminId, accion, tabla, registroId, detalle }) {
try {
    const { data: actor } = await supabaseAdmin.from('profiles')
      .select('id, nombre, apellido, correo, rol').eq('id', adminId).maybeSingle();
    const { error } = await supabaseAdmin.from('admin_audit_log').insert({
    admin_id: adminId,
    actor_snapshot: actor ? {
      id: actor.id,
      nombre: [actor.nombre, actor.apellido].filter(Boolean).join(' '),
      correo: actor.correo,
      rol: actor.rol,
    } : { id: adminId },
    subject_user_id: detalle?.subject_user_id || detalle?.perfil_id || null,
    accion,
    tabla,
    registro_id: registroId,
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
