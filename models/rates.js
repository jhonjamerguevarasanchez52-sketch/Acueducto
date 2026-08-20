// Columnas reales (tabla rates en Supabase):
// id (uuid), tipo (text), cuota_fija (numeric), vigente_desde (date),
// vigente_hasta (date), created_at (timestamptz)
const supabase = require('../config/supabaseClient');
const createModel = require('./baseModel');

const base = createModel('rates');

module.exports = {
  ...base,

  async findByTipo(tipo) {
    const { data, error } = await supabase
      .from('rates')
      .select('*')
      .eq('tipo', tipo);
    if (error) throw error;
    return data;
  },

  async findVigente(tipo) {
    const hoy = new Date().toISOString().slice(0, 10);
    let query = supabase
      .from('rates')
      .select('*')
      .lte('vigente_desde', hoy)
      .or(`vigente_hasta.is.null,vigente_hasta.gte.${hoy}`);

    if (tipo) query = query.eq('tipo', tipo);

    const { data, error } = await query
      .order('vigente_desde', { ascending: false })
      .limit(1)
      .single();
    if (error) throw error;
    return data;
  },
};