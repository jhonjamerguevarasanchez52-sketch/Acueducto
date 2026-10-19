const supabaseAdmin = require('../config/supabaseAdminClient');

// Registra una acción del administrador. Nunca rompe la petición:
// si falla el registro, solo lo deja en el log del servidor.
async function registrarAuditoria({ adminId, accion, tabla, registroId, detalle }) {
try {
    const { error } = await supabaseAdmin.from('admin_audit_log').insert({
    admin_id: adminId,
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