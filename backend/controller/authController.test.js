const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const controllerPath = path.join(__dirname, 'authController.js');
const authModelPath = path.join(__dirname, '../models/authModel.js');
const profileModelPath = path.join(__dirname, '../models/profileModel.js');
const attemptsPath = path.join(__dirname, '../utils/controlIntentos.js');

const attempts = { fallos: 0, exitos: 0 };
const authModel = { signIn: async () => ({}), refreshSession: async () => ({}) };
const profileModel = {
  findByEmail: async () => ({ data: { id: 'user-1', rol: 'administrador' }, error: null }),
  getById: async () => ({}),
};

function mockModule(filename, exports) {
  require.cache[filename] = {
    id: filename,
    filename,
    loaded: true,
    exports,
  };
}

mockModule(authModelPath, authModel);
mockModule(profileModelPath, profileModel);
mockModule(attemptsPath, {
  segundosDeBloqueo: () => null,
  registrarFallo: () => { attempts.fallos += 1; },
  registrarExito: () => { attempts.exitos += 1; },
});

const { iniciarSesion, renovarSesion } = require(controllerPath);

function respuestaCapturada() {
  return {
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

function ejecutarLogin() {
  const res = respuestaCapturada();
  return iniciarSesion({ body: { correo: 'USUARIO@ejemplo.com', password: 'clave-valida' } }, res)
    .then(() => res);
}

function ejecutarRenovacion(refreshToken) {
  const res = respuestaCapturada();
  return renovarSesion({ body: { refreshToken } }, res).then(() => res);
}

test('reintenta un 503 de Auth y permite login cuando Supabase se recupera', async () => {
  let llamadasAuth = 0;
  let llamadasPerfil = 0;
  authModel.signIn = async (correo) => {
    llamadasAuth += 1;
    assert.equal(correo, 'usuario@ejemplo.com');
    if (llamadasAuth === 1) return { error: { status: 503, message: 'Service unavailable' } };
    return { data: { user: { id: 'user-1' }, session: { access_token: 'token' } }, error: null };
  };
  profileModel.getById = async () => {
    llamadasPerfil += 1;
    return { data: { is_verified: true, activo: true }, error: null };
  };

  const res = await ejecutarLogin();

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.session.access_token, 'token');
  assert.equal(llamadasAuth, 2);
  assert.equal(llamadasPerfil, 1);
});

test('reintenta la lectura del perfil y devuelve sesión si la base se recupera', async () => {
  let llamadasPerfil = 0;
  authModel.signIn = async () => ({
    data: { user: { id: 'user-1' }, session: { access_token: 'token' } }, error: null,
  });
  profileModel.getById = async () => {
    llamadasPerfil += 1;
    if (llamadasPerfil === 1) return { data: null, error: { status: 502, message: 'Bad gateway' } };
    return { data: { is_verified: true, activo: true }, error: null };
  };

  const res = await ejecutarLogin();

  assert.equal(res.statusCode, 200);
  assert.equal(llamadasPerfil, 2);
});

test('tras tres fallos temporales responde 503 sin contar fallo de contraseña', async () => {
  let llamadasAuth = 0;
  authModel.signIn = async () => {
    llamadasAuth += 1;
    return { error: { status: 503, message: 'Service unavailable' } };
  };

  const res = await ejecutarLogin();

  assert.equal(res.statusCode, 503);
  assert.equal(llamadasAuth, 3);
  assert.match(res.body.error, /servicio de acceso/i);
  assert.equal(attempts.fallos, 0);
});

test('credenciales incorrectas responden 401 sin reintentos', async () => {
  let llamadasAuth = 0;
  authModel.signIn = async () => {
    llamadasAuth += 1;
    return { error: { status: 400, message: 'Invalid login credentials' } };
  };

  const res = await ejecutarLogin();

  assert.equal(res.statusCode, 401);
  assert.equal(llamadasAuth, 1);
  assert.equal(attempts.fallos, 1);
});

test('renueva la sesión biométrica y exige un perfil administrador activo', async () => {
  authModel.refreshSession = async (refreshToken) => {
    assert.equal(refreshToken, 'refresh-anterior');
    return {
      data: {
        user: { id: 'admin-1' },
        session: { access_token: 'access-nuevo', refresh_token: 'refresh-nuevo' },
      },
      error: null,
    };
  };
  profileModel.getById = async (id, opciones) => {
    assert.equal(id, 'admin-1');
    assert.equal(opciones.columns, 'rol, is_verified, activo, debe_cambiar_password');
    return {
      data: { rol: 'administrador', is_verified: true, activo: true },
      error: null,
    };
  };

  const res = await ejecutarRenovacion('refresh-anterior');

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.session.access_token, 'access-nuevo');
  assert.equal(res.body.session.refresh_token, 'refresh-nuevo');
});

test('rechaza una renovación biométrica sin refresh token válido', async () => {
  const res = await ejecutarRenovacion('');
  assert.equal(res.statusCode, 400);
});
