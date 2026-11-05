const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');

const { limiteAuth, correoDelCuerpo } = require('./rateLimit');

async function conServidor(app, fn) {
  const servidor = app.listen(0);
  await new Promise((r) => servidor.once('listening', r));
  try {
    return await fn(`http://127.0.0.1:${servidor.address().port}`);
  } finally {
    await new Promise((r) => servidor.close(r));
  }
}

function login(base, correo) {
  return fetch(`${base}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ correo, password: 'x' }),
  });
}

test('el correo se normaliza para la clave del límite', () => {
  assert.equal(correoDelCuerpo({ body: { correo: '  Ana@Correo.COM ' } }), 'ana@correo.com');
  assert.equal(correoDelCuerpo({ body: {} }), '');
  assert.equal(correoDelCuerpo({ body: { correo: 42 } }), '');
});

test('agotar el cupo de una cuenta no bloquea a otra persona con la misma IP', async () => {
  const app = express();
  app.use(express.json());
  app.post('/login', limiteAuth, (req, res) => res.status(200).json({ ok: true }));

  await conServidor(app, async (base) => {
    let ultima;
    for (let i = 0; i < 11; i++) ultima = await login(base, 'atacada@correo.com');
    assert.equal(ultima.status, 429, 'la cuenta atacada queda limitada');

    const vecina = await login(base, 'vecina@correo.com');
    assert.equal(vecina.status, 200, 'otra cuenta desde la misma IP sigue entrando');
  });
});
