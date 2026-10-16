const VALID_ROLES = new Set(['usuario', 'fontanero', 'administrador'])

function normalizeHeader(value) {
  return value
    .replace(/^\uFEFF/, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
}

function detectDelimiter(header) {
  let commas = 0
  let semicolons = 0
  let quoted = false

  for (let index = 0; index < header.length; index += 1) {
    if (header[index] === '"') {
      if (quoted && header[index + 1] === '"') {
        index += 1
      } else {
        quoted = !quoted
      }
    } else if (!quoted && header[index] === ',') {
      commas += 1
    } else if (!quoted && header[index] === ';') {
      semicolons += 1
    }
  }

  return semicolons > commas ? ';' : ','
}

function parseRows(text, delimiter) {
  const rows = []
  let row = []
  let field = ''
  let quoted = false
  let lineNumber = 1
  let recordLine = 1

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]

    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        field += '"'
        index += 1
      } else if (character === '"') {
        quoted = false
      } else {
        field += character
        if (character === '\n') lineNumber += 1
      }
      continue
    }

    if (character === '"' && field.length === 0) {
      quoted = true
    } else if (character === delimiter) {
      row.push(field)
      field = ''
    } else if (character === '\n' || character === '\r') {
      if (character === '\r' && text[index + 1] === '\n') index += 1
      row.push(field)
      if (row.some((value) => value.trim())) rows.push({ values: row, line: recordLine })
      row = []
      field = ''
      lineNumber += 1
      recordLine = lineNumber
    } else {
      field += character
    }
  }

  if (quoted) throw new Error('El archivo CSV tiene comillas sin cerrar.')

  row.push(field)
  if (row.some((value) => value.trim())) rows.push({ values: row, line: recordLine })
  return rows
}

export function parseUsersCsv(text) {
  const firstLine = text.replace(/^\uFEFF/, '').split(/\r?\n/).find((line) => line.trim()) || ''
  const rows = parseRows(text, detectDelimiter(firstLine))

  return parseUsersRows(rows)
}

export async function parseUsersExcel(file) {
  const { readSheet } = await import('read-excel-file/browser')
  const spreadsheetRows = await readSheet(file)
  return parseUsersRows(spreadsheetRows.map((values, index) => ({
    values: values || [],
    line: index + 1,
  })))
}

export function parseUsersRows(rows) {
  const nonEmptyRows = rows.filter(({ values }) => values.some((value) => String(value ?? '').trim()))

  if (nonEmptyRows.length < 2) {
    throw new Error('El archivo debe incluir encabezados y al menos un usuario.')
  }

  const headers = nonEmptyRows[0].values.map((value) => normalizeHeader(String(value ?? '')))
  const columnIndex = (names) => headers.findIndex((header) => names.includes(header))
  const nameIndex = columnIndex(['nombre'])
  const surnameIndex = columnIndex(['apellido'])
  const emailIndex = columnIndex(['correo', 'email', 'correo_electronico'])
  const roleIndex = columnIndex(['rol', 'role'])

  if (nameIndex === -1 || surnameIndex === -1 || emailIndex === -1) {
    throw new Error('Faltan columnas obligatorias. Usa los encabezados: nombre, apellido y correo.')
  }

  const seenEmails = new Set()
  return nonEmptyRows.slice(1).map(({ values, line }) => {
    const nombre = String(values[nameIndex] ?? '').trim()
    const apellido = String(values[surnameIndex] ?? '').trim()
    const correo = String(values[emailIndex] ?? '').trim().toLowerCase()
    const rol = roleIndex === -1 ? 'usuario' : String(values[roleIndex] ?? '').trim().toLowerCase() || 'usuario'
    const errors = []

    if (!nombre) errors.push('Falta el nombre.')
    if (!apellido) errors.push('Falta el apellido.')
    if (!correo) {
      errors.push('Falta el correo.')
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
      errors.push('El correo no tiene un formato válido.')
    } else if (seenEmails.has(correo)) {
      errors.push('El correo está repetido en el archivo.')
    }
    if (!VALID_ROLES.has(rol)) {
      errors.push('El rol debe ser usuario, fontanero o administrador.')
    }
    if (correo) seenEmails.add(correo)

    return {
      line,
      nombre,
      apellido,
      correo,
      rol,
      error: errors.join(' '),
    }
  })
}
