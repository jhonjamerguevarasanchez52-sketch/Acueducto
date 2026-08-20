// Columnas reales (tabla payment_alerts en Supabase):
// id (uuid), factura_id (uuid), perfil_id (uuid), mensaje (text),
// fecha_envio (timestamptz), canal (text)
const supabase = require('../config/supabaseClient');
const createModel = require('./baseModel');

const base = createModel('payment_alerts');

module.exports = {
  ...base,

  async findByPerfilid(perfilid) {
    const { data, error } = await supabase
      .from('payment_alerts')
      .select('*')
      .eq('perfil_id', perfilid);
    if (error) throw error;
    return data;
  },

  async findByFacturaid(facturaid) {
    const { data, error } = await supabase
      .from('payment_alerts')
      .select('*')
      .eq('factura_id', facturaid);
    if (error) throw error;
    return data;
  },

  async findByCanal(canal) {
    const { data, error } = await supabase
      .from('payment_alerts')
      .select('*')
      .eq('canal', canal);
    if (error) throw error;
    return data;
  },
};