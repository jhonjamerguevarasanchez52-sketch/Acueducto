// Campos asumidos: id (uuid, igual al id de auth.users), full_name, email,
// phone, address, role ('administrador' | 'fontanero' | 'usuario'), created_at
const supabase = require('../config/supabaseClient');
const createModel = require("./basemodel.js");

const base = createModel('profiles');

module.exports = {
  ...base,

  async findByEmail(email) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('email', email)
      .single();
    if (error) throw error;
    return data;
  },

  async findByRole(role) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', role);
    if (error) throw error;
    return data;
  },
};