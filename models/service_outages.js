// Campos asumidos: id, zone, reason, start_time, end_time,
// status ('programado' | 'en_curso' | 'finalizado')
const supabase = require('../config/supabaseClient');
const createModel = require("./basemodel.js");

const base = createModel('service_outages');

module.exports = {
  ...base,

  async findByZone(zone) {
    const { data, error } = await supabase
      .from('service_outages')
      .select('*')
      .eq('zone', zone);
    if (error) throw error;
    return data;
  },

  async findActive() {
    const { data, error } = await supabase
      .from('service_outages')
      .select('*')
      .eq('status', 'en_curso');
    if (error) throw error;
    return data;
  },
};