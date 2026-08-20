// Columnas reales (tabla notifications en Supabase):
// id (uuid), perfil_id (uuid), tipo (text), mensaje (text),
// estado (enum public.estado_notificacion), fecha (timestamptz)
const supabase = require('../config/supabaseClient');
const createModel = require('./baseModel');

const base = createModel('notifications');

module.exports = {
  ...base,

  async findByPerfilid(perfilid) {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('perfil_id', perfilid);
    if (error) throw error;
    return data;
  },

  async findByEstado(estado) {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('estado', estado);
    if (error) throw error;
    return data;
  },

  async findByTipo(tipo) {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('tipo', tipo);
    if (error) throw error;
    return data;
  },

  async marcarLeida(id) {
    const { data, error } = await supabase
      .from('notifications')
      .update({ estado: 'leida' })
      .eq('id', id)
      .select();
    if (error) throw error;
    return data[0];
  },
};