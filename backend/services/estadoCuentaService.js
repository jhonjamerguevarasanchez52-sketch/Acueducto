const supabaseAdmin = require('../config/supabaseAdminClient');

async function consultarEstadoCuenta(perfilIds) {
  if (!perfilIds.length) return new Map();
  const [facturasResult, pagosResult] = await Promise.all([
    supabaseAdmin.from('invoices').select('*').in('perfil_id', perfilIds),
    supabaseAdmin.from('payments').select('factura_id, perfil_id, monto, confirmado').in('perfil_id', perfilIds),
  ]);
  if (facturasResult.error) throw facturasResult.error;
  if (pagosResult.error) throw pagosResult.error;

  const pagosConfirmados = new Map();
  for (const pago of pagosResult.data || []) {
    if (!pago.confirmado) continue;
    pagosConfirmados.set(pago.factura_id, (pagosConfirmados.get(pago.factura_id) || 0) + Number(pago.monto || 0));
  }
  const estadoPorPerfil = new Map(perfilIds.map((id) => [id, { saldoPendiente: 0, facturasPendientes: [] }]));
  for (const factura of facturasResult.data || []) {
    if (!['pendiente', 'vencida'].includes(factura.estado)) continue;
    const saldo = Math.max(0, Number(factura.valor_total || 0) - (pagosConfirmados.get(factura.id) || 0));
    if (!saldo) continue;
    const estado = estadoPorPerfil.get(factura.perfil_id);
    if (!estado) continue;
    estado.saldoPendiente += saldo;
    estado.facturasPendientes.push({ ...factura, saldo_pendiente: saldo });
  }
  for (const estado of estadoPorPerfil.values()) {
    estado.saldoPendiente = Number(estado.saldoPendiente.toFixed(2));
    estado.estadoCuenta = estado.saldoPendiente === 0 ? 'al_dia' : 'saldo_pendiente';
  }
  return estadoPorPerfil;
}

module.exports = { consultarEstadoCuenta };
