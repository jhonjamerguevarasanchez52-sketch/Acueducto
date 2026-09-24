const supabaseAdmin = require('../config/supabaseAdminClient'); // Cliente admin (ignora RLS)

// Operaciones que se repetían idénticas en varios modelos. Cada modelo las
// incorpora con `...crudBase(TABLE)`. Devuelven { data, error } como Supabase.
function crudBase(tabla) {
  return {
    // Actualiza por id y devuelve la fila actualizada.
    update: (id, cambios) => supabaseAdmin.from(tabla).update(cambios).eq('id', id).select().single(),

    // Elimina por id y devuelve la fila eliminada.
    remove: (id) => supabaseAdmin.from(tabla).delete().eq('id', id).select().single(),
  };
}

module.exports = { crudBase };
