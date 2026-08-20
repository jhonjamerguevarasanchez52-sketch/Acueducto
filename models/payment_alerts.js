// Campos asumidos: id, user_id, invoice_id, message, sent_at,
// status ('enviada' | 'leida')
const supabase = require('../config/supabaseClient');
const createModel = require("./basemodel.js");

const base = createModel('payment_alerts');

module.exports = {
  ...base,

  async findByUserId(userId) {
    const { data, error } = await supabase
      .from('payment_alerts')
      .select('*')
      .eq('user_id', userId);
    if (error) throw error;
    return data;
  },
};