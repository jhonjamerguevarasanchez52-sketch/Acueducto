// Campos editables de "profiles" por su propio dueño o por un administrador.
const CAMPOS_EDITABLES_PERFIL = [
  'nombre', 'apellido', 'telefono', 'numero_lote',
  'direccion', 'ocupacion', 'zona',
];

// Columnas seguras de "profiles": excluye los códigos de un solo uso de
// verificación/recuperación de contraseña, que nunca deben salir de authController.
const COLUMNAS_PERFIL_PUBLICO =
  'id, nombre, apellido, correo, rol, activo, is_verified, ' +
  'telefono, numero_lote, direccion, ocupacion, zona, created_at';

module.exports = { CAMPOS_EDITABLES_PERFIL, COLUMNAS_PERFIL_PUBLICO };
