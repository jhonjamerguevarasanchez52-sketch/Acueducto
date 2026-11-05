const API_BASE_URL = (import.meta.env.VITE_API_URL || 'https://hidro-app.onrender.com')
  .trim()
  .replace(/\/+$/, '')
const API_URL = import.meta.env.DEV
  ? '/api'
  : API_BASE_URL.endsWith('/api') ? API_BASE_URL : `${API_BASE_URL}/api`

const TOKEN_KEY = 'hidro_token'
const REFRESH_KEY = 'hidro_refresh_token'

function leer(clave) {
  try {
    return localStorage.getItem(clave)
  } catch {
    return null
  }
}

function escribir(clave, valor) {
  try {
    if (valor) localStorage.setItem(clave, valor)
    else localStorage.removeItem(clave)
  } catch {
    // Navegación privada o almacenamiento bloqueado: la sesión dura lo que la pestaña.
  }
}

export function getToken() {
  return leer(TOKEN_KEY)
}

export function saveToken(token, refreshToken) {
  if (token) escribir(TOKEN_KEY, token)
  if (refreshToken) escribir(REFRESH_KEY, refreshToken)
}

export function clearToken() {
  escribir(TOKEN_KEY, null)
  escribir(REFRESH_KEY, null)
}

/** Error de la API con el estado HTTP y el cuerpo de la respuesta. */
export class ApiError extends Error {
  constructor(message, { status, data } = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.data = data
  }
}

// El token de Supabase dura una hora. Al recibir un 401 se renueva una sola
// vez con el refresh token y se repite la petición, para que el administrador
// no tenga que volver a iniciar sesión cada hora. Varias peticiones que vencen
// a la vez comparten la misma renovación.
let renovacionEnCurso = null

async function renovarSesion() {
  const refreshToken = leer(REFRESH_KEY)
  if (!refreshToken) return false
  if (!renovacionEnCurso) {
    renovacionEnCurso = fetch(`${API_URL}/auth/renovar-sesion`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    })
      .then(async (response) => {
        if (!response.ok) return false
        const data = await response.json().catch(() => ({}))
        if (!data.session?.access_token) return false
        saveToken(data.session.access_token, data.session.refresh_token)
        return true
      })
      .catch(() => false)
      .finally(() => { renovacionEnCurso = null })
  }
  return renovacionEnCurso
}

async function enviar(path, options) {
  const token = getToken()
  const headers = { ...(options.headers || {}) }

  if (!(options.body instanceof FormData) && typeof options.body !== 'string' && options.body !== undefined) {
    headers['Content-Type'] = headers['Content-Type'] || 'application/json'
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  return fetch(`${API_URL}${path}`, {
    ...options,
    headers,
    body:
      options.body !== undefined && !(options.body instanceof FormData) && typeof options.body !== 'string'
        ? JSON.stringify(options.body)
        : options.body,
  })
}

export async function apiRequest(path, options = {}) {
  let response = await enviar(path, options)

  const esRutaDeAcceso = path.startsWith('/auth/')
  if (response.status === 401 && !esRutaDeAcceso && await renovarSesion()) {
    response = await enviar(path, options)
  }

  const contentType = response.headers.get('content-type') || ''
  const data = contentType.includes('application/json')
    ? await response.json().catch(() => ({}))
    : await response.text().catch(() => '')

  if (!response.ok) {
    const message = typeof data === 'object'
      ? (data.message || data.error || `Error HTTP ${response.status}`)
      : data || `Error HTTP ${response.status}`
    throw new ApiError(message, { status: response.status, data })
  }

  return data
}

// Supabase entrega como máximo 1000 filas por consulta. Los listados que
// crecen sin tope (usuarios, facturas, pagos, cortes) se piden por páginas y
// se unen aquí, para que el panel y los reportes nunca trabajen con datos
// recortados en silencio.
export const TAMANO_PAGINA = 500
const MAX_PAGINAS = 200

export async function apiRequestAll(path, options = {}) {
  const filas = []
  const separador = path.includes('?') ? '&' : '?'
  for (let pagina = 0; pagina < MAX_PAGINAS; pagina += 1) {
    const offset = pagina * TAMANO_PAGINA
    const datos = await apiRequest(`${path}${separador}limit=${TAMANO_PAGINA}&offset=${offset}`, options)
    if (!Array.isArray(datos)) return datos
    filas.push(...datos)
    if (datos.length < TAMANO_PAGINA) return filas
  }
  return filas
}

export const endpoints = {
  login: '/auth/login',
  changePassword: '/auth/cambiar-password',
  requestPasswordReset: '/auth/solicitar-recuperacion',
  resetPassword: '/auth/resetear-password',
  profile: '/profile/mi-perfil',
  adminUsers: '/admin/usuarios',
  facturas: '/facturas',
  facturasTodas: '/facturas/todas',
  generarFacturasMensuales: '/facturas/generar-mensuales',
  facturaExtraordinaria: '/facturas/factura-extraordinaria',
  pagos: '/pagos/todos',
  // Acciones sobre un pago concreto: /pagos/:id/confirmar y DELETE /pagos/:id.
  // No cuelgan de /pagos/todos (esa ruta solo lista).
  pago: '/pagos',
  registrarPagoAdmin: '/pagos/admin',
  cortes: '/cortes',
  cortesProgramados: '/cortes/programados',
  cortesProgramadosTodos: '/cortes/programados/todos',
  zonas: '/cortes/zonas',
  notificaciones: '/notificaciones',
  marcarNotificacionesLeidas: '/notificaciones/marcar-todas',
  tarifas: '/tarifas',
  tareasDiarias: '/tareas/diarias',
}

export async function login(correo, password) {
  const data = await apiRequest(endpoints.login, {
    method: 'POST',
    body: { correo, password },
  })

  if (!data.session?.access_token) {
    throw new Error('El servidor no devolvió una sesión válida')
  }

  saveToken(data.session.access_token, data.session.refresh_token)
  return data
}
