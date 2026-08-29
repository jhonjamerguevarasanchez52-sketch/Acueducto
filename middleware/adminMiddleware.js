const { verificarRol } = require('./roleMiddleware');

// El rol ya viene cargado en req.usuario por verificarToken,
// así que no hace falta una consulta extra a la base de datos.
const verificarAdmin = verificarRol('administrador');

module.exports = { verificarAdmin };
