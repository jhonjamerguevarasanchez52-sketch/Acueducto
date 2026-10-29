const crypto = require('crypto');

function generarCodigoSeguridad() {
  return crypto.randomInt(100000, 1000000).toString();
}

module.exports = { generarCodigoSeguridad };
