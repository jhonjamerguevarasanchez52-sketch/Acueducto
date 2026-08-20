// Campos asumidos: id, name, price_per_unit, category
// ('residencial' | 'comercial' | 'industrial'), effective_date
const supabase = require('../config/supabaseClient');
const createModel = require("./basemodel.js");

const base = createModel('rates');

module.exports = {
  ...base,

  async findByCategory(category) {
    const { data, error } = await supabase
      .from('rates')
      .select('*')
      .eq('category', category);
    if (error) throw error;
    return data;
  },

  async findCurrent() {
    const { data, error } = await supabase
      .from('rates')
      .select('*')
      .lte('effective_date', new Date().toISOString())
      .order('effective_date', { ascending: false })
      .limit(1)
      .single();
    if (error) throw error;
    return data;
  },
};