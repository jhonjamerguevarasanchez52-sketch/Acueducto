const { OAuth2Client } = require("google-auth-library");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

// client ID cargado limpiamente desde variables de entorno
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const loginWithGoogle = async (req, res) => {
  try {
    const { idToken } = req.body;

    if (!idToken) {
      return res.status(400).json({ message: "El token de Google es requerido" });
    }

    let googleId, email, given_name, family_name, picture;

    // Regla de detección: Un JWT tiene 3 partes separadas por punto y no inicia por ya29.
    const esJwt = idToken.split(".").length === 3 && !idToken.startsWith("ya29.");

    if (esJwt) {
      // 1. Caso Android / iOS: Verificación formal mediante biblioteca oficial
      const ticket = await client.verifyIdToken({
        idToken,
        audience: process.env.GOOGLE_CLIENT_ID,
      });

      const payload = ticket.getPayload();
      googleId = payload.sub;
      email = payload.email;
      given_name = payload.given_name;
      family_name = payload.family_name;
      picture = payload.picture;
    } else {
      // 2. Caso Flutter Web: Consulta a la API UserInfo oficial de Google
      const userInfoResponse = await fetch(
        "https://www.googleapis.com/oauth2/v3/userinfo",
        {
          headers: { Authorization: `Bearer ${idToken}` },
        }
      );

      if (!userInfoResponse.ok) {
        throw new Error("El token de acceso de Google no es válido o expiró");
      }

      const userData = await userInfoResponse.json();
      googleId = userData.sub;
      email = userData.email;
      given_name = userData.given_name || userData.name || "USUARIO";
      family_name = userData.family_name || "";
      picture = userData.picture;
    }

    if (!email) {
      return res.status(400).json({ message: "Google no proporcionó un email válido" });
    }

    const correoLimpio = email.toLowerCase().trim();

    // Buscar si el usuario ya existe
    let usuario = await User.findOne({ Correo_Electronico: correoLimpio });

    if (usuario) {
      if (!usuario.googleId) usuario.googleId = googleId;
      if (!usuario.isVerified) {
        usuario.isVerified = true;
        usuario.codigoVerificacion = undefined;
        usuario.codigoVerificacionExpiracion = undefined;
      }
      if (!usuario.avatar && picture) usuario.avatar = picture;
      await usuario.save();
    } else {
      // Crear nuevo usuario verificado por defecto
      usuario = new User({
        Nombre: given_name || "USUARIO",
        Apellido: family_name || "",
        Correo_Electronico: correoLimpio,
        googleId,
        avatar: picture || "",
        isVerified: true,
        rol: "usuario",
      });
      await usuario.save();
    }

    // Firmar el JWT propio de la aplicación
    const token = jwt.sign(
      { id: usuario._id, Correo_Electronico: usuario.Correo_Electronico },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    return res.status(200).json({
      message: "Inicio de sesión con Google exitoso",
      token,
      usuario: {
        _id: usuario._id,
        Correo_Electronico: usuario.Correo_Electronico,
        Apellido: usuario.Apellido,
        Nombre: usuario.Nombre,
        rol: usuario.rol,
        avatar: usuario.avatar,
      },
    });
  } catch (error) {
    console.error("Error al autenticar con Google:", error);
    return res.status(401).json({
      message: "Token de Google inválido o expirado",
      error: error.message,
    });
  }
};

module.exports = { loginWithGoogle };