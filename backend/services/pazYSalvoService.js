const { randomUUID } = require('node:crypto');
const supabaseAdmin = require('../config/supabaseAdminClient');
const { enviarCorreo } = require('../config/mailer');
const { escaparHtml } = require('../utils/html');
const { consultarEstadoCuenta } = require('./estadoCuentaService');
const { generarPdfPazYSalvos } = require('../utils/pazYSalvoPdf');
const { registrarAuditoria } = require('../utils/auditoria');

function numeroCertificado() {
  const fecha = new Date().toISOString().slice(0, 10).replaceAll('-', '');
  return `PS-${fecha}-${randomUUID().slice(0, 8).toUpperCase()}`;
}

function actorSnapshot(actor) {
  return {
    id: actor.id,
    nombre: [actor.nombre, actor.apellido].filter(Boolean).join(' '),
    correo: actor.email || actor.correo || null,
    rol: actor.rol,
  };
}

async function generarCertificados({ perfilIds, enviar, actor }) {
  const ids = [...new Set((perfilIds || []).filter((id) => typeof id === 'string'))];
  if (!ids.length) {
    const error = new Error('Selecciona al menos un perfil.');
    error.statusCode = 400;
    throw error;
  }
  if (ids.length > 100) {
    const error = new Error('Genera certificados para máximo 100 perfiles por solicitud.');
    error.statusCode = 400;
    throw error;
  }

  const { data: perfiles, error: errorPerfiles } = await supabaseAdmin.from('profiles')
    .select('id, nombre, apellido, correo, rol, numero_lote, direccion, zona, activo')
    .in('id', ids);
  if (errorPerfiles) throw errorPerfiles;
  const estados = await consultarEstadoCuenta(ids);
  const resultados = [];
  const emitidos = [];
  const actorData = actorSnapshot(actor);

  for (const perfil of perfiles || []) {
    const estado = estados.get(perfil.id) || { estadoCuenta: 'al_dia', saldoPendiente: 0, facturasPendientes: [] };
    if (estado.saldoPendiente > 0) {
      resultados.push({
        perfil_id: perfil.id,
        nombre: `${perfil.nombre} ${perfil.apellido}`.trim(),
        correo: perfil.correo,
        estado: 'no_emitido',
        saldo_pendiente: estado.saldoPendiente,
        facturas_pendientes: estado.facturasPendientes,
        motivo: 'Tiene facturas pendientes; no se puede certificar paz y salvo.',
      });
      continue;
    }

    const [{ data: facturas, error: errorFacturas }, { data: pagos, error: errorPagos }] = await Promise.all([
      supabaseAdmin.from('invoices').select('*').eq('perfil_id', perfil.id).order('fecha_emision', { ascending: true }),
      supabaseAdmin.from('payments').select('*').eq('perfil_id', perfil.id).eq('confirmado', true).order('fecha_pago', { ascending: true }),
    ]);
    if (errorFacturas) throw errorFacturas;
    if (errorPagos) throw errorPagos;

    const cert = {
      certificate_number: numeroCertificado(),
      profile_id: perfil.id,
      profile_snapshot: perfil,
      invoice_snapshot: facturas || [],
      confirmed_payments_snapshot: pagos || [],
      outstanding_balance: 0,
      generated_by_id: actor.id,
      generated_by_snapshot: actorData,
      generated_at: new Date().toISOString(),
      email_sent_to: enviar ? perfil.correo : null,
      email_status: enviar ? 'failed' : 'not_requested',
    };
    const { data: registro, error: errorRegistro } = await supabaseAdmin
      .from('clearance_certificates').insert(cert).select('*').single();
    if (errorRegistro) throw errorRegistro;

    let emailStatus = 'not_requested';
    let emailError = null;
    if (enviar) {
      try {
        if (!perfil.correo) throw new Error('El perfil no tiene correo registrado.');
        const pdf = generarPdfPazYSalvos([registro]);
        const respuesta = await enviarCorreo({
          to: perfil.correo,
          subject: `Paz y salvo ${registro.certificate_number} - Acueducto Campo Amor`,
          html: `<p>Hola ${escaparHtml(perfil.nombre)},</p><p>Adjuntamos tu certificado de paz y salvo <strong>${escaparHtml(registro.certificate_number)}</strong>, expedido el ${new Date(registro.generated_at).toLocaleDateString('es-CO')}.</p><p>El certificado refleja el estado de cuenta hasta la fecha de expedición.</p>`,
          attachments: [{ name: `${registro.certificate_number}.pdf`, content: pdf.toString('base64') }],
        });
        if (!respuesta) throw new Error('El proveedor de correo no confirmó el envío.');
        emailStatus = 'sent';
      } catch (err) {
        emailStatus = 'failed';
        emailError = err.message;
      }
      await supabaseAdmin.from('clearance_certificates')
        .update({ email_status: emailStatus, email_error: emailError }).eq('id', registro.id);
    }

    const item = {
      ...registro,
      email_status: emailStatus,
      email_error: emailError,
      estado: 'emitido',
      saldo_pendiente: 0,
    };
    resultados.push(item);
    emitidos.push(item);
    await registrarAuditoria({
      adminId: actor.id,
      accion: 'paz_y_salvo_generado',
      tabla: 'clearance_certificates',
      registroId: registro.id,
      detalle: { subject_user_id: perfil.id, certificate_number: registro.certificate_number, email_status: emailStatus },
    });
  }

  const combinedPdf = emitidos.length ? generarPdfPazYSalvos(emitidos) : null;
  return {
    resultados,
    emitidos: emitidos.length,
    pdfBase64: combinedPdf?.toString('base64') || null,
    filename: emitidos.length === 1
      ? `${emitidos[0].certificate_number}.pdf`
      : `paz-y-salvo-${new Date().toISOString().slice(0, 10)}.pdf`,
  };
}

async function listarCertificados() {
  return supabaseAdmin.from('clearance_certificates').select('*').order('generated_at', { ascending: false }).limit(500);
}

async function descargarCertificado(id) {
  const { data, error } = await supabaseAdmin.from('clearance_certificates').select('*').eq('id', id).single();
  if (error) throw error;
  const pdf = generarPdfPazYSalvos([data]);
  return { certificate: data, pdfBase64: pdf.toString('base64'), filename: `${data.certificate_number}.pdf` };
}

async function reenviarCertificado(id) {
  const { data, error } = await supabaseAdmin.from('clearance_certificates').select('*').eq('id', id).single();
  if (error) throw error;
  if (!data.email_sent_to) throw new Error('El certificado no tiene un destinatario guardado.');
  const pdf = generarPdfPazYSalvos([data]);
  const response = await enviarCorreo({
    to: data.email_sent_to,
    subject: `Paz y salvo ${data.certificate_number} - Acueducto Campo Amor`,
    html: `<p>Adjuntamos nuevamente el certificado de paz y salvo <strong>${escaparHtml(data.certificate_number)}</strong>.</p>`,
    attachments: [{ name: `${data.certificate_number}.pdf`, content: pdf.toString('base64') }],
  });
  if (!response) throw new Error('El proveedor de correo no confirmó el envío.');
  const { error: updateError } = await supabaseAdmin.from('clearance_certificates')
    .update({ email_status: 'sent', email_error: null }).eq('id', id);
  if (updateError) throw updateError;
  return { email: data.email_sent_to };
}

module.exports = { generarCertificados, listarCertificados, descargarCertificado, reenviarCertificado };
