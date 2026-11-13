const supabaseAdmin = require('../config/supabaseAdminClient');
const invoiceModel = require('../models/invoiceModel');
const mailer = require('../config/mailer');
const { notificar } = require('../utils/notificar');
const { escaparHtml } = require('../utils/html');
const { formatearPesos } = require('../utils/formato');
const { fechaBogota, fechaLarga } = require('../utils/fechas');
const { generarFacturasMensuales } = require('./facturacionMensual');

// Tareas que antes dependían de que el administrador se acordara de hacerlas.
// Las dispara una vez al día pg_cron (ver migración 20261030) llamando a
// POST /api/tareas/diarias, o a mano con `npm run tareas-diarias`.
// Todas son idempotentes: correrlas dos veces el mismo día no duplica nada.

// La facturación del mes anterior se intenta los días 1 a 5: si el servidor
// estaba caído el día 1, se recupera solo. Fuera de esa ventana el cron no
// factura; si hiciera falta, el administrador lo hace desde el panel. Las
// cuentas creadas después de terminar el mes no se facturan (facturacionMensual).
const DIAS_VENTANA_FACTURACION = 5;
const DIAS_AVISO_ANTES_DE_VENCER = 3;

function sumarDias(fechaIso, dias) {
  const fecha = new Date(`${fechaIso}T00:00:00Z`);
  fecha.setUTCDate(fecha.getUTCDate() + dias);
  return fecha.toISOString().slice(0, 10);
}

async function marcarFacturasVencidas() {
  const { data, error } = await supabaseAdmin.rpc('marcar_facturas_vencidas');
  if (error) throw new Error(`No se pudieron marcar las facturas vencidas: ${error.message}`);
  return Number(data) || 0;
}

async function enviarRecordatoriosDeVencimiento({ hoy, enviarCorreo = mailer.enviarCorreo } = {}) {
  const fechaObjetivo = sumarDias(hoy, DIAS_AVISO_ANTES_DE_VENCER);
  const { data: facturas, error } = await invoiceModel.listDueForReminder(fechaObjetivo);
  if (error) throw new Error(`No se pudieron consultar las facturas por vencer: ${error.message}`);

  const resumen = { recordatorios: 0, fallidos: 0 };
  for (const factura of facturas || []) {
    const perfil = factura.profiles || {};
    if (perfil.activo === false) continue;

    const valor = formatearPesos(factura.valor_total);
    const fecha = fechaLarga(factura.fecha_vencimiento);
    await notificar(
      factura.perfil_id,
      `Tu factura ${factura.numero_factura} por ${valor} vence el ${fecha}. Págala desde la app en "Pagar".`,
      'factura',
    );

    let correoOk = true;
    if (perfil.correo) {
      try {
        const respuesta = await enviarCorreo({
          to: perfil.correo,
          subject: `Tu factura vence el ${fecha} - Acueducto Campo Amor`,
          html: `<p>Hola ${escaparHtml(perfil.nombre || '')},</p>
                 <p>Te recordamos que tu factura del periodo <strong>${escaparHtml(factura.periodo)}</strong>
                 por <strong>${valor}</strong> vence el <strong>${escaparHtml(fecha)}</strong>.</p>
                 <p>Puedes pagarla en segundos desde la aplicación (PSE, Nequi o tarjeta) o en la oficina del acueducto.</p>`,
        });
        correoOk = Boolean(respuesta);
      } catch (err) {
        console.error('[tareas] recordatorio no enviado a', perfil.correo, ':', err.message);
        correoOk = false;
      }
    }

    // Se marca aunque el correo falle: el aviso dentro de la app ya quedó y
    // no queremos repetirlo mañana.
    const { error: errorMarca } = await supabaseAdmin
      .from('invoices')
      .update({ recordatorio_enviado_at: new Date().toISOString() })
      .eq('id', factura.id);
    if (errorMarca) console.error('[tareas] no se pudo marcar el recordatorio:', errorMarca.message);

    if (correoOk) resumen.recordatorios += 1;
    else resumen.fallidos += 1;
  }
  return resumen;
}

async function ejecutarTareasDiarias({ ahora = new Date() } = {}) {
  const hoy = fechaBogota(ahora);
  const dia = Number(hoy.slice(8, 10));
  const resumen = { fecha: hoy, facturacion: null, vencidas: 0, recordatorios: null, errores: [] };

  // 1. Facturación del mes anterior (días 1 a 5). Va primero para que las
  //    facturas nuevas no se crucen con el vencimiento del mismo día.
  if (dia <= DIAS_VENTANA_FACTURACION) {
    try {
      const facturacion = await generarFacturasMensuales({ fechaEmision: ahora });
      resumen.facturacion = {
        periodo: facturacion.periodo,
        valorPorFactura: facturacion.valorPorFactura,
        creadas: facturacion.facturasCreadas,
        existentes: facturacion.facturasExistentes,
        correosEnviados: facturacion.correosEnviados,
        correosFallidos: facturacion.correosFallidos,
        avisos: facturacion.avisos,
      };
      resumen.errores.push(...facturacion.errores);
    } catch (err) {
      resumen.errores.push(`Facturación: ${err.message}`);
    }
  }

  // 2. Vencer facturas atrasadas (también lo hace pg_cron en SQL; repetirlo
  //    aquí no hace daño y cubre instalaciones sin pg_cron).
  try {
    resumen.vencidas = await marcarFacturasVencidas();
  } catch (err) {
    resumen.errores.push(err.message);
  }

  // 3. Recordatorio unos días antes de la fecha límite.
  try {
    resumen.recordatorios = await enviarRecordatoriosDeVencimiento({ hoy });
  } catch (err) {
    resumen.errores.push(err.message);
  }

  return resumen;
}

module.exports = {
  DIAS_AVISO_ANTES_DE_VENCER,
  sumarDias,
  marcarFacturasVencidas,
  enviarRecordatoriosDeVencimiento,
  ejecutarTareasDiarias,
};
