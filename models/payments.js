// Campos asumidos: id, invoice_id, user_id, amount, payment_date, method
// ('efectivo' | 'transferencia' | 'tarjeta'), reference, status
// ('confirmado' | 'pendiente' | 'rechazado')
const supabase = require('../config/supabaseClient');
const createModel = require("./basemodel.js");

const base = createModel('payments');

module.exports = {
  ...base,

  async findByInvoiceId(invoiceId) {
    const { data, error } = await supabase
      .from('payments')
      .select('*')
      .eq('invoice_id', invoiceId);
    if (error) throw error;
    return data;
  },

  async findByUserId(userId) {
    const { data, error } = await supabase
      .from('payments')
      .select('*')
      .eq('user_id', userId);
    if (error) throw error;
    return data;
  },
};