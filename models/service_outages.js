// Columnas reales (tabla service_outages en Supabase):
// id (uuid), perfil_id (uuid), factura_id (uuid), motivo (text),
// fecha_corte (timestamptz), fecha_reconexion (timestamptz),
// estado (enum public.estado_corte)
const supabase = require('../config/supabaseClient');
const createModel = require('./baseModel');

const base = createModel('service_outages');

module.exports = {
  ...base,

  async findByPerfilId(perfilId) {
    const { data, error } = await supabase
      .from('service_outages')
      .select('*')
      .eq('perfil_id', perfilId);
    if (error) throw error;
    return data;
  },

  async findByFacturaId(facturaId) {
    const { data, error } = await supabase
      .from('service_outages')
      .select('*')
      .eq('factura_id', facturaId);
    if (error) throw error;
    return data;
  },

  async findByEstado(estado) {
    const { data, error } = await supabase
      .from('service_outages')
      .select('*')
      .eq('estado', estado);
    if (error) throw error;
    return data;
  },

  async reconectar(id) {
    const { data, error } = await supabase
      .from('service_outages')
      .update({ fecha_reconexion: new Date().toISOString() })
      .eq('id', id)
      .select();
    if (error) throw error;
    return data[0];
  },
};