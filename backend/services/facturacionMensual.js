const supabaseAdmin = require('../config/supabaseAdminClient');
const profileModel = require('../models/profileModel');
const mailer = require('../config/mailer');

const VALOR_MENSUAL = 12000;
const ZONA_HORARIA = 'America/Bogota';

function obtenerFechaBogota(fecha) {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA_HORARIA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(fecha);
  const valor = (tipo) => partes.find((parte) => parte.type === tipo).value;
  return { anio: Number(valor('year')), mes: Number(valor('month')), dia: Number(valor('day')) };
}

function periodoAnterior(fecha = new Date()) {
  const { anio, mes } = obtenerFechaBogota(fecha);
  const fechaAnterior = new Date(Date.UTC(anio, mes - 2, 1));
  return `${fechaAnterior.getUTCFullYear()}-${String(fechaAnterior.getUTCMonth() + 1).padStart(2, '0')}`;
}

function validarPeriodo(periodo) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(periodo)) {
    throw new Error('El periodo debe tener el formato AAAA-MM.');
  }
}

function fechaVencimiento(periodo) {
  validarPeriodo(periodo);
  const [anio, mes] = periodo.split('-').map(Number);
  const proximoMes = new Date(Date.UTC(anio, mes, 15));
  return proximoMes.toISOString().slice(0, 10);
}

function escaparHtml(valor = '') {
  return String(valor).replace(/[&<>"']/g, (caracter) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[caracter]);
}

function esDuplicado(error) {
  return error && error.code === '23505';
}

function columnaOpcionalNoDisponible(error, columna) {
  return error && ['42703', 'PGRST204'].includes(error.code)
    && String(error.message || '').includes(columna);
}

async function generarFacturasMensuales({
  periodo = periodoAnterior(),
  fechaEmision = new Date(),
  obtenerPerfilesActivos = () => profileModel.listActiveForBilling(),
  db = supabaseAdmin,
  enviarCorreo = (opciones) => mailer.enviarCorreo(opciones),
} = {}) {
  validarPeriodo(periodo);

  const { data: perfiles, error: errorPerfiles } = await obtenerPerfilesActivos();
  if (errorPerfiles) {
    throw new Error(`No se pudieron consultar los usuarios activos: ${errorPerfiles.message}`);
  }

  const { data: existentes, error: errorExistentes } = await db
    .from('invoices')
    .select('*')
    .eq('periodo', periodo)
    .eq('tipo', 'servicio')
    .neq('estado', 'anulada');
  if (errorExistentes) {
    throw new Error(`No se pudieron consultar las facturas del periodo ${periodo}: ${errorExistentes.message}`);
  }

  const facturasExistentes = new Map((existentes || []).map((factura) => [factura.perfil_id, factura]));
  const resumen = {
    periodo,
    valorPorFactura: VALOR_MENSUAL,
    usuariosActivos: (perfiles || []).length,
    facturasCreadas: 0,
    facturasExistentes: 0,
    periodosPrepagados: 0,
    correosEnviados: 0,
    correosFallidos: 0,
    errores: [],
  };
  const vencimiento = fechaVencimiento(periodo);

  for (const perfil of perfiles || []) {
    let factura = facturasExistentes.get(perfil.id);
    if (factura) {
      resumen.facturasExistentes += 1;
      if (!factura.generada_automaticamente || factura.correo_factura_enviado_at) continue;
    } else {
      const { data: resultado, error: errorFactura } = await db.rpc(
        'crear_factura_mensual_si_no_cubierta',
        {
          p_perfil_id: perfil.id,
          p_periodo: periodo,
          p_valor_total: VALOR_MENSUAL,
          p_fecha_emision: fechaEmision.toISOString(),
          p_fecha_vencimiento: vencimiento,
        },
      );

      if (errorFactura) {
        if (esDuplicado(errorFactura)) {
          resumen.facturasExistentes += 1;
          continue;
        }
        resumen.errores.push(`No se pudo crear la factura de ${perfil.id}: ${errorFactura.message}`);
        continue;
      }

      factura = Array.isArray(resultado) ? resultado[0] : resultado;
      if (!factura) {
        // El periodo ya está cubierto por un plan semestral/anual del usuario.
        resumen.periodosPrepagados += 1;
        continue;
      }
      resumen.facturasCreadas += 1;
    }

    if (!perfil.correo) {
      resumen.correosFallidos += 1;
      resumen.errores.push(`El perfil ${perfil.id} no tiene correo registrado.`);
      continue;
    }

    try {
      const respuesta = await enviarCorreo({
        to: perfil.correo,
        subject: `Nueva factura - periodo ${periodo} - Acueducto Campoamor`,
        html: `<p>Hola ${escaparHtml(perfil.nombre || '')},</p>
               <p>Se generó tu factura del periodo <strong>${periodo}</strong> por un valor de
               <strong>$${VALOR_MENSUAL.toLocaleString('es-CO')}</strong>.</p>
               <p>Fecha límite de pago: ${new Date(`${vencimiento}T12:00:00`).toLocaleDateString('es-CO')}.</p>
               <p>Puedes consultar el detalle desde la aplicación de Acueducto Campoamor.</p>`,
      });
      if (!respuesta) throw new Error('El servicio de correo no confirmó el envío.');
      if (factura && factura.generada_automaticamente) {
        const { error: errorActualizacion } = await db
          .from('invoices')
          .update({ correo_factura_enviado_at: new Date().toISOString() })
          .eq('id', factura.id);
        if (errorActualizacion && !columnaOpcionalNoDisponible(errorActualizacion, 'correo_factura_enviado_at')) {
          throw new Error(`Correo enviado, pero no se pudo guardar su estado: ${errorActualizacion.message}`);
        }
      }
      resumen.correosEnviados += 1;
    } catch (errorCorreo) {
      resumen.correosFallidos += 1;
      resumen.errores.push(`No se pudo enviar el correo a ${perfil.correo}: ${errorCorreo.message}`);
    }
  }

  return resumen;
}

module.exports = {
  VALOR_MENSUAL,
  periodoAnterior,
  fechaVencimiento,
  generarFacturasMensuales,
};
