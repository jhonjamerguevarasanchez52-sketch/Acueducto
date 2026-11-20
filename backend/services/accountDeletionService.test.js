const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const servicePath = path.join(__dirname, 'accountDeletionService.js');
const supabasePath = path.join(__dirname, '../config/supabaseAdminClient.js');
const authPath = path.join(__dirname, '../models/authModel.js');

function mockModule(filename, exports) {
  require.cache[filename] = { id: filename, filename, loaded: true, exports };
}

function crearServicio({ archiveInsertError = null, deleteError = null } = {}) {
  const updates = [];
  const perfil = {
    id: 'user-1',
    rol: 'usuario',
    correo: 'ana@example.com',
    nombre: 'Ana',
    apellido: 'Torres',
  };

  class Query {
    constructor(tabla) {
      this.tabla = tabla;
      this.operacion = 'select';
      this.cambios = null;
    }

    select() { return this; }
    eq() { return this; }
    in() { return this; }
    insert() { this.operacion = 'insert'; return this; }
    update(cambios) { this.operacion = 'update'; this.cambios = cambios; return this; }

    resultado() {
      if (this.operacion === 'update') {
        updates.push(this.cambios);
        return { data: null, error: null };
      }
      if (this.operacion === 'insert') {
        return archiveInsertError
          ? { data: null, error: archiveInsertError }
          : { data: { id: 'archive-1' }, error: null };
      }
      if (this.tabla === 'profiles') return { data: perfil, error: null };
      if (this.tabla === 'deleted_users') return { data: null, error: null };
      return { data: [], error: null };
    }

    maybeSingle() { return Promise.resolve(this.resultado()); }
    single() { return Promise.resolve(this.resultado()); }
    then(resolve, reject) { return Promise.resolve(this.resultado()).then(resolve, reject); }
  }

  mockModule(supabasePath, {
    from: (tabla) => new Query(tabla),
    auth: { admin: { getUserById: async () => ({ data: { user: { email: perfil.correo } } }) } },
  });
  mockModule(authPath, { deleteUser: async () => ({ error: deleteError }) });
  mockModule(path.join(__dirname, '../config/mailer.js'), { enviarCorreo: async () => true });
  delete require.cache[servicePath];

  return {
    service: require(servicePath),
    updates,
    actor: { id: 'user-1', email: perfil.correo, nombre: 'Ana', apellido: 'Torres', rol: 'usuario' },
  };
}

test('da una respuesta accionable si falta la migración del archivo', async () => {
  const { service, actor } = crearServicio({
    archiveInsertError: { code: 'PGRST205', message: 'table missing from schema cache' },
  });

  await assert.rejects(
    service.eliminarCuenta({ userId: 'user-1', actor, deletionType: 'usuario' }),
    (error) => {
      assert.equal(error.statusCode, 503);
      assert.match(error.message, /20261118_archivar_movimientos_al_eliminar_cuenta\.sql/);
      return true;
    },
  );
});

test('identifica el bloqueo de la FK contable reportado por Supabase y permite reintentar', async () => {
  const { service, actor, updates } = crearServicio({
    deleteError: { code: 'unexpected_failure', message: 'Database error deleting user' },
  });

  await assert.rejects(
    service.eliminarCuenta({ userId: 'user-1', actor, deletionType: 'usuario' }),
    (error) => {
      assert.equal(error.statusCode, 409);
      assert.match(error.message, /migración 20261118_archivar_movimientos_al_eliminar_cuenta\.sql/);
      return true;
    },
  );
  assert.ok(updates.some((cambios) => cambios.status === 'error'));
});
