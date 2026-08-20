
function verificarRol(...rolesPermitidos) {
  return (req, res, next) => {
    if (!req.usuario) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    const rolUsuario = req.usuario.rol;

    if (!rolUsuario || !rolesPermitidos.includes(rolUsuario)) {
      return res.status(403).json({
        error: 'No autorizado. Rol requerido: ' + rolesPermitidos.join(' o ')
      });
    }

    next();
  };
}

module.exports = { verificarRol };