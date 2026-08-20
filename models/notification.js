// Campos asumidos: id, user_id, title, message, type
// ('averia' | 'pago' | 'corte' | 'general'), read (boolean), created_at
const supabase = require('../config/supabaseClient');
const createModel = require("./basemodel.js");

const base = createModel('notifications');

module.exports = {
  ...base,

  async findByUserId(userId) {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId);
    if (error) throw error;
    return data;
  },

  async markAsRead(id) {
    const { data, error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', id)
      .select();
    if (error) throw error;
    return data[0];
  },
};