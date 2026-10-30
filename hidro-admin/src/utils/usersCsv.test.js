import assert from 'node:assert/strict'
import test from 'node:test'

import { parseUsersCsv, parseUsersRows } from './usersCsv.js'

test('parsea CSV separado por punto y coma y normaliza encabezados con acentos', () => {
  const users = parseUsersCsv('\uFEFFNombre;Apellido;Correo electrónico;Rol\r\nAna;Pérez;ANA@EXAMPLE.COM;Fontanero')

  assert.deepEqual(users, [{
    line: 2,
    nombre: 'Ana',
    apellido: 'Pérez',
    correo: 'ana@example.com',
    rol: 'fontanero',
    error: '',
  }])
})

test('respeta delimitadores, comillas escapadas y saltos de línea dentro de campos CSV', () => {
  const users = parseUsersCsv('nombre,apellido,correo\n"Ana, María","Pérez ""Luz""",ana@example.com')

  assert.equal(users[0].nombre, 'Ana, María')
  assert.equal(users[0].apellido, 'Pérez "Luz"')
  assert.equal(users[0].error, '')

  const multiline = parseUsersCsv('nombre,apellido,correo\nAna,"Pérez\nLuz",ana@example.com')
  assert.equal(multiline[0].apellido, 'Pérez\nLuz')
})

test('rechaza CSV con comillas sin cerrar', () => {
  assert.throws(() => parseUsersCsv('nombre,apellido,correo\n"Ana,Pérez,ana@example.com'), /comillas sin cerrar/)
})

test('exige encabezados y al menos una fila de usuario', () => {
  assert.throws(() => parseUsersCsv('nombre,apellido,correo'), /encabezados y al menos un usuario/)
  assert.throws(() => parseUsersCsv('nombre,correo\nAna,ana@example.com'), /Faltan columnas obligatorias/)
})

test('normaliza correo, aplica rol por defecto y valida campos requeridos', () => {
  const rows = parseUsersRows([
    { values: ['Nombre', 'Apellido', 'Email'] , line: 1 },
    { values: ['Ana', 'Pérez', ' ANA@EXAMPLE.COM '] , line: 4 },
    { values: ['', 'López', 'correo-invalido'] , line: 5 },
  ])

  assert.equal(rows[0].correo, 'ana@example.com')
  assert.equal(rows[0].rol, 'usuario')
  assert.equal(rows[0].error, '')
  assert.match(rows[1].error, /Falta el nombre/)
  assert.match(rows[1].error, /formato válido/)
})

test('marca correos repetidos y roles no permitidos en la fila correspondiente', () => {
  const rows = parseUsersRows([
    { values: ['nombre', 'apellido', 'correo', 'rol'], line: 1 },
    { values: ['Ana', 'Pérez', 'ana@example.com', 'usuario'], line: 2 },
    { values: ['Luis', 'Díaz', 'ANA@example.com', 'root'], line: 3 },
  ])

  assert.equal(rows[0].error, '')
  assert.match(rows[1].error, /repetido/)
  assert.match(rows[1].error, /rol debe ser usuario, fontanero o administrador/)
})
