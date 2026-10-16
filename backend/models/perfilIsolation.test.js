const test = require('node:test');
const assert = require('node:assert/strict');

const breakdownModel = require('./breakdownModel');
const notificationModel = require('./notificationModel');

function clienteFalso() {
  const operaciones = [];
  const query = {
    select(...args) { operaciones.push(['select', ...args]); return query; },
    eq(...args) { operaciones.push(['eq', ...args]); return query; },
    order(...args) { operaciones.push(['order', ...args]); return query; },
  };
  return {
    operaciones,
    from(tabla) { operaciones.push(['from', tabla]); return query; },
  };
}

test('las averías del perfil siempre se filtran por el perfil autenticado', () => {
  const db = clienteFalso();

  breakdownModel.listByProfile('perfil-usuario-1', db);

  assert.ok(db.operaciones.some(([op, campo, valor]) =>
    op === 'eq' && campo === 'perfil_id' && valor === 'perfil-usuario-1'));
  assert.throws(() => breakdownModel.listByProfile('perfil-usuario-1'), TypeError);
});

test('las notificaciones propias siempre se filtran por el perfil autenticado', () => {
  const db = clienteFalso();

  notificationModel.listByProfile('perfil-usuario-2', db);

  assert.ok(db.operaciones.some(([op, campo, valor]) =>
    op === 'eq' && campo === 'perfil_id' && valor === 'perfil-usuario-2'));
  assert.throws(() => notificationModel.listByProfile('perfil-usuario-2'), TypeError);
});
