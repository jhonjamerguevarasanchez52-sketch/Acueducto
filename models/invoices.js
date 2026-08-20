// Columnas reales (tabla invoices en Supabase):
// id (uuid), perfil_id (uuid), periodo (text), valor_total (numeric),
// fecha_emision (date), fecha_vencimiento (date),
// estado (enum public.estado_factura), created_at (timestamptz)
const supabase = require('../config/supabaseClient');
const createModel = require('./baseModel');

const base = createModel('invoices');

module.exports = {
  ...base,

  async findByPerfilId(perfilid) {
    const { data, error } = await supabase
      .from('invoices')
      .select('*')
      .eq('perfil_id', perfilid);
    if (error) throw error;
    return data;
  },

  async findByEstado(estado) {
    const { data, error } = await supabase
      .from('invoices')
      .select('*')
      .eq('estado', estado);
    if (error) throw error;
    return data;
  },

  async findByPeriodo(periodo) {
    const { data, error } = await supabase
      .from('invoices')
      .select('*')
      .eq('periodo', periodo);
    if (error) throw error;
    return data;
  },

  async marcarPagada(id) {
    const { data, error } = await supabase
      .from('invoices')
      .update({ estado: 'pagada' })
      .eq('id', id)
      .select();
    if (error) throw error;
    return data[0];
  },
};