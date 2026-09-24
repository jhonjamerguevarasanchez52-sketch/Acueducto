const supabaseAdmin = require('../config/supabaseAdminClient');

const TABLE = 'invoices';

function createForProfiles({ perfilIds, periodo, valorTotal, concepto, fechaVencimiento }) {
  const observacion = `Cuota extraordinaria: ${concepto}`;
  const facturas = perfilIds.map((perfilId) => ({
    perfil_id: perfilId,
    periodo,
    valor_total: valorTotal,
    tipo: 'extraordinaria',
    estado: 'pendiente',
    fecha_emision: new Date().toISOString(),
    fecha_vencimiento: fechaVencimiento || null,
    observacion,
  }));

  return supabaseAdmin.from(TABLE).insert(facturas).select();
}

module.exports = { createForProfiles };