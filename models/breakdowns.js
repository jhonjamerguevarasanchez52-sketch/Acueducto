// Columnas reales (tabla breakdowns en Supabase):
// id (uuid), perfil_id (uuid), fontanero_id (uuid), descripcion (text),
// zona (text), estado (enum public.estado_averia),
// fecha_reporte (timestamptz), fecha_resolucion (timestamptz)
const supabase = require('../config/supabaseClient');
const createModel = require('./baseModel');

const base = createModel('breakdowns');

module.exports = {
  ...base,

  async findByEstado(estado) {
    const { data, error } = await supabase
      .from('breakdowns')
      .select('*')
      .eq('estado', estado);
    if (error) throw error;
    return data;
  },

  async findByPerfilId(perfilid) {
    const { data, error } = await supabase
      .from('breakdowns')
      .select('*')
      .eq('perfil_id', perfilid);
    if (error) throw error;
    return data;
  },

  async findByFontaneroId(fontaneroId) {
    const { data, error } = await supabase
      .from('breakdowns')
      .select('*')
      .eq('fontanero_id', fontaneroId);
    if (error) throw error;
    return data;
  },

  async findByZona(zona) {
    const { data, error } = await supabase
      .from('breakdowns')
      .select('*')
      .eq('zona', zona);
    if (error) throw error;
    return data;
  },

  async marcarResuelta(id) {
    const { data, error } = await supabase
      .from('breakdowns')
      .update({ estado: 'resuelta', fecha_resolucion: new Date().toISOString() })
      .eq('id', id)
      .select();
    if (error) throw error;
    return data[0];
  },
};