/**
 * Permite el paso solo a administradores.
 * Debe usarse después de verificarToken (usa req.usuario.rol, que ya viene
 * validado contra la base de datos por el middleware de autenticación).
 */
function verificarAdmin(req, res, next) {
  if (!req.usuario) {
    return res.status(401).json({ error: 'No autenticado' });
  }

  if (req.usuario.rol !== 'administrador') {
    return res.status(403).json({ error: 'Solo un administrador puede realizar esta acción' });
  }

  next();
}

module.exports = verificarAdmin;
