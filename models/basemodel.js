const supabase = require('../config/supabaseClient');

/**
 * Genera un set de funciones CRUD genéricas para una tabla de Supabase.
 * Cada modelo específico usa esto como base y le agrega sus propias
 * consultas particulares (por ejemplo, buscar por user_id).
 *
 * @param {string} tableName - nombre exacto de la tabla en Supabase
 */
function createModel(tableName) {
  return {
    async findAll() {
      const { data, error } = await supabase.from(tableName).select('*');
      if (error) throw error;
      return data;
    },

    async findById(id) {
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data;
    },

    async create(payload) {
      const { data, error } = await supabase
        .from(tableName)
        .insert([payload])
        .select();
      if (error) throw error;
      return data[0];
    },

    async update(id, payload) {
      const { data, error } = await supabase
        .from(tableName)
        .update(payload)
        .eq('id', id)
        .select();
      if (error) throw error;
      return data[0];
    },

    async remove(id) {
      const { error } = await supabase.from(tableName).delete().eq('id', id);
      if (error) throw error;
      return true;
    },
  };
}

module.exports = createModel;