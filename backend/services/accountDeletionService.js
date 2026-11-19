const supabaseAdmin = require('../config/supabaseAdminClient');
const authModel = require('../models/authModel');
const { enviarCorreo } = require('../config/mailer');
const { escaparHtml } = require('../utils/html');

const ERROR_RELACION_INEXISTENTE = '42P01';

async function consultarTabla(tabla, construir) {
  const resultado = await construir(supabaseAdmin.from(tabla));
  if (resultado.error?.code === ERROR_RELACION_INEXISTENTE) return [];
  if (resultado.error) throw new Error(`No se pudo archivar ${tabla}: ${resultado.error.message}`);
  return resultado.data || [];
}

async function leerHistorial(profileId) {
  const [invoices, payments, reportedBreakdowns, assignedBreakdowns, outages, alerts,
    notifications, actorEvents, subjectEvents] = await Promise.all([
    consultarTabla('invoices', (q) => q.select('*').eq('perfil_id', profileId)),
    consultarTabla('payments', (q) => q.select('*').eq('perfil_id', profileId)),
    consultarTabla('breakdowns', (q) => q.select('*').eq('perfil_id', profileId)),
    consultarTabla('breakdowns', (q) => q.select('*').eq('fontanero_id', profileId)),
    consultarTabla('service_outages', (q) => q.select('*').eq('perfil_id', profileId)),
    consultarTabla('payment_alerts', (q) => q.select('*').eq('perfil_id', profileId)),
    consultarTabla('notifications', (q) => q.select('*').eq('perfil_id', profileId)),
    consultarTabla('admin_audit_log', (q) => q.select('*').eq('admin_id', profileId)),
    consultarTabla('admin_audit_log', (q) => q.select('*').eq('subject_user_id', profileId)),
  ]);
  const breakdownsAssigned = [...new Map(assignedBreakdowns.map((row) => [row.id, row])).values()];
  const confirmedByInvoice = new Map();
  for (const payment of payments.filter((row) => row.confirmado)) {
    confirmedByInvoice.set(payment.factura_id, (confirmedByInvoice.get(payment.factura_id) || 0) + Number(payment.monto || 0));
  }
  const pendingInvoices = invoices.filter((row) => ['pendiente', 'vencida'].includes(row.estado))
    .map((row) => ({
      ...row,
      saldo_pendiente: Math.max(0, Number(row.valor_total || 0) - (confirmedByInvoice.get(row.id) || 0)),
    }))
    .filter((row) => row.saldo_pendiente > 0);
  const pendingTotal = pendingInvoices.reduce((sum, row) => sum + row.saldo_pendiente, 0);
  const adminEvents = [...new Map([...actorEvents, ...subjectEvents].map((row) => [row.id, row])).values()];
  return {
    invoices,
    payments,
    reported_breakdowns: reportedBreakdowns,
    assigned_breakdowns: breakdownsAssigned,
    outages,
    payment_alerts: alerts,
    notifications,
    admin_events: adminEvents,
    breakdown_summary: {
      reported_count: reportedBreakdowns.length,
      assigned_count: breakdownsAssigned.length,
      accepted_or_in_process_count: breakdownsAssigned.filter((row) => row.estado === 'en_proceso').length,
      resolved_count: breakdownsAssigned.filter((row) => row.estado === 'resuelta').length,
      no_reported_breakdowns: reportedBreakdowns.length === 0,
      no_assigned_breakdowns: breakdownsAssigned.length === 0,
    },
    pending_invoices: pendingInvoices,
    pending_total: Number(pendingTotal.toFixed(2)),
  };
}

function crearHtmlCorreo({ nombre, pendingInvoices, pendingTotal }) {
  const filas = pendingInvoices.length
    ? pendingInvoices.map((invoice) => `<tr><td style="padding:8px;border-bottom:1px solid #ddd">${escaparHtml(invoice.numero_factura || invoice.id)}</td><td style="padding:8px;border-bottom:1px solid #ddd">${escaparHtml(invoice.periodo || '')}</td><td style="padding:8px;border-bottom:1px solid #ddd">${escaparHtml(invoice.estado || '')}</td><td style="padding:8px;border-bottom:1px solid #ddd">$${Number(invoice.saldo_pendiente ?? invoice.valor_total ?? 0).toLocaleString('es-CO')} COP</td></tr>`).join('')
    : '<tr><td colspan="4" style="padding:10px">No hay facturas pendientes registradas.</td></tr>';
  return `<p>Hola ${escaparHtml(nombre)},</p>
    <p>Te informamos que tu cuenta del Acueducto Campo Amor fue eliminada correctamente.</p>
    <h3>Resumen de saldos pendientes</h3>
    <table style="border-collapse:collapse;width:100%;text-align:left"><thead><tr><th style="padding:8px">Factura</th><th style="padding:8px">Periodo</th><th style="padding:8px">Estado</th><th style="padding:8px">Saldo</th></tr></thead><tbody>${filas}</tbody></table>
    <p><strong>Total pendiente: $${Number(pendingTotal).toLocaleString('es-CO')} COP</strong></p>
    <p>Este mensaje es el comprobante de la eliminación y del estado de cuenta al momento de eliminar el perfil. Para aclaraciones, comunícate con la administración del acueducto.</p>`;
}

async function actualizarArchivo(id, cambios, estricto = false) {
  const { error } = await supabaseAdmin.from('deleted_users').update(cambios).eq('id', id);
  if (error) {
    console.error('No se pudo actualizar el archivo de eliminación:', error.message);
    if (estricto) throw new Error(`No se pudo actualizar el archivo de eliminación: ${error.message}`);
  }
}

async function eliminarCuenta({ userId, actor, deletionType, exitNote }) {
  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles').select('*').eq('id', userId).maybeSingle();
  if (profileError) throw new Error(`No se pudo consultar el perfil: ${profileError.message}`);
  if (!profile) return { notFound: true };

  if (profile.rol === 'fontanero' && !String(exitNote || '').trim()) {
    const error = new Error('El fontanero debe escribir una nota antes de eliminar su perfil.');
    error.statusCode = 400;
    throw error;
  }

  const { data: authResult } = await supabaseAdmin.auth.admin.getUserById(userId);
  const email = profile.correo || authResult?.user?.email;
  if (!email) throw new Error('El perfil no tiene un correo válido para notificar la eliminación.');

  const history = await leerHistorial(userId);
  const safeProfile = { ...profile };
  for (const key of ['codigo_verificacion', 'codigo_verificacion_expiracion', 'codigo_recuperacion', 'codigo_expiracion']) delete safeProfile[key];

  const actorSnapshot = {
    id: actor.id,
    nombre: [actor.nombre, actor.apellido].filter(Boolean).join(' ') || actor.email || 'Cuenta propia',
    correo: actor.email || actor.correo || null,
    rol: actor.rol || null,
  };
  const { data: previous } = await supabaseAdmin.from('deleted_users').select('id,status')
    .eq('deleted_user_id', userId).in('status', ['pending', 'error']).maybeSingle();
  let archiveId = previous?.id;
  if (archiveId) {
    await actualizarArchivo(archiveId, {
      role: profile.rol, email, full_name: `${profile.nombre || ''} ${profile.apellido || ''}`.trim(),
      deletion_type: deletionType, deleted_by_id: actor.id, deleted_by_snapshot: actorSnapshot,
      exit_note: String(exitNote || '').trim() || null, profile_snapshot: safeProfile,
      history_snapshot: history, pending_invoices: history.pending_invoices,
      pending_total: history.pending_total, status: 'pending', error_message: null,
    }, true);
  } else {
    const { data: archive, error: archiveError } = await supabaseAdmin.from('deleted_users').insert({
      deleted_user_id: userId,
      role: profile.rol,
      email,
      full_name: `${profile.nombre || ''} ${profile.apellido || ''}`.trim(),
      deletion_type: deletionType,
      deleted_by_id: actor.id,
      deleted_by_snapshot: actorSnapshot,
      exit_note: String(exitNote || '').trim() || null,
      profile_snapshot: safeProfile,
      history_snapshot: history,
      pending_invoices: history.pending_invoices,
      pending_total: history.pending_total,
      status: 'pending',
      email_status: 'pending',
    }).select('id').single();
    if (archiveError) {
      const requiereMigracion = ['42P01', 'PGRST205'].includes(archiveError.code);
      const error = new Error(requiereMigracion
        ? 'Falta preparar el archivo de cuentas eliminadas. Ejecuta la migración 20261118_archivar_movimientos_al_eliminar_cuenta.sql en Supabase.'
        : `No se pudo archivar la cuenta: ${archiveError.message}`);
      if (requiereMigracion) error.statusCode = 503;
      throw error;
    }
    archiveId = archive.id;
  }

  const { error: deletionError } = await authModel.deleteUser(userId);
  if (deletionError) {
    await actualizarArchivo(archiveId, { status: 'error', error_message: deletionError.message });
    const bloqueaHistorial = deletionError.code === '23503'
      || /database error deleting user|foreign key constraint|violates foreign key/i.test(deletionError.message || '');
    const error = new Error(bloqueaHistorial
      ? 'La base de datos aún bloquea la eliminación del historial contable. Ejecuta la migración 20261118_archivar_movimientos_al_eliminar_cuenta.sql y vuelve a intentarlo.'
      : deletionError.message);
    error.statusCode = bloqueaHistorial ? 409 : 500;
    throw error;
  }

  await actualizarArchivo(archiveId, { status: 'deleted', deleted_at: new Date().toISOString() });

  let emailSent = false;
  try {
    const result = await enviarCorreo({
      to: email,
      subject: 'Confirmación de eliminación de cuenta y estado de cuenta',
      html: crearHtmlCorreo({ nombre: profile.nombre || 'usuario', pendingInvoices: history.pending_invoices, pendingTotal: history.pending_total }),
    });
    if (!result) throw new Error('El proveedor de correo no confirmó el envío.');
    await actualizarArchivo(archiveId, { email_status: 'sent', email_error: null });
    emailSent = true;
  } catch (mailError) {
    await actualizarArchivo(archiveId, { email_status: 'failed', email_error: mailError.message });
    console.error('Cuenta eliminada; falló el correo de confirmación:', mailError.message);
  }

  if (deletionType === 'administrador') {
    await supabaseAdmin.from('admin_audit_log').insert({
      admin_id: actor.id === userId ? null : actor.id,
      actor_snapshot: actorSnapshot,
      subject_user_id: userId,
      accion: 'usuario_eliminado',
      tabla: 'profiles',
      registro_id: userId,
      detalle: { deleted_user_id: userId, role: profile.rol, email, archive_id: archiveId, pending_total: history.pending_total },
    });
  }

  return { archiveId, pendingTotal: history.pending_total, pendingInvoiceCount: history.pending_invoices.length, emailSent };
}

async function listarCuentasEliminadas() {
  return supabaseAdmin.from('deleted_users').select('*').order('requested_at', { ascending: false });
}

async function reenviarCorreoArchivo(archiveId) {
  const { data: archive, error } = await supabaseAdmin.from('deleted_users')
    .select('*').eq('id', archiveId).single();
  if (error) throw new Error(error.message);
  if (archive.status !== 'deleted') throw new Error('La cuenta todavía no figura como eliminada.');
  const nombre = archive.profile_snapshot?.nombre || archive.full_name || 'usuario';
  const result = await enviarCorreo({
    to: archive.email,
    subject: 'Confirmación de eliminación de cuenta y estado de cuenta',
    html: crearHtmlCorreo({ nombre, pendingInvoices: archive.pending_invoices || [], pendingTotal: archive.pending_total || 0 }),
  });
  if (!result) throw new Error('El proveedor de correo no confirmó el envío.');
  const { error: updateError } = await supabaseAdmin.from('deleted_users')
    .update({ email_status: 'sent', email_error: null }).eq('id', archiveId);
  if (updateError) throw new Error(updateError.message);
  return { email: archive.email };
}

module.exports = { eliminarCuenta, listarCuentasEliminadas, reenviarCorreoArchivo };
