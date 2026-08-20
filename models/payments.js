// Columnas reales (tabla payments en Supabase):
// id (uuid), factura_id (uuid), perfil_id (uuid), monto (numeric),
// metodo (enum public.metodo_pago), referencia (text),
// fecha_pago (timestamptz), confirmado (boolean), created_at (timestamptz)
const supabase = require('../config/supabaseClient');
const createModel = require('./baseModel');

const base = createModel('payments');

module.exports = {
  ...base,

  async findByFacturaid(facturaid) {
    const { data, error } = await supabase
      .from('payments')
      .select('*')
      .eq('factura_id', facturaid);
    if (error) throw error;
    return data;
  },

  async findByPerfilid(perfilid) {
    const { data, error } = await supabase
      .from('payments')
      .select('*')
      .eq('perfil_id', perfilid);
    if (error) throw error;
    return data;
  },

  async findByMetodo(metodo) {
    const { data, error } = await supabase
      .from('payments')
      .select('*')
      .eq('metodo', metodo);
    if (error) throw error;
    return data;
  },

  async confirmar(id) {
    const { data, error } = await supabase
      .from('payments')
      .update({ confirmado: true })
      .eq('id', id)
      .select();
    if (error) throw error;
    return data[0];
  },
};