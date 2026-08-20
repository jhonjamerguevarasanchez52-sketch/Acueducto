// Columnas reales (tabla profiles en Supabase):
// id (uuid, igual al id de auth.users), nombre (text), apellido (text),
// correo (text), telefono (text), rol (enum public.rol_usuario),
// numero_lote (text), direccion (text), ocupacion (text),
// nivel_permiso (text), zona (text), activo (boolean),
// created_at (timestamptz), updated_at (timestamptz)
const supabase = require('../config/supabaseClient');
const createModel = require('./baseModel');

const base = createModel('profiles');

module.exports = {
  ...base,

  async findByCorreo(correo) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('correo', correo)
      .single();
    if (error) throw error;
    return data;
  },

  async findByRol(rol) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('rol', rol);
    if (error) throw error;
    return data;
  },

  async findByZona(zona) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('zona', zona);
    if (error) throw error;
    return data;
  },

  async desactivar(id) {
    const { data, error } = await supabase
      .from('profiles')
      .update({ activo: false })
      .eq('id', id)
      .select();
    if (error) throw error;
    return data[0];
  },
};