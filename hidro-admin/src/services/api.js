const API_BASE_FALLBACK = 'https://hidro-app.onrender.com'
const configuredApiUrl = (import.meta.env.VITE_API_URL || '').trim().replace(/\/+$/, '')
const configuredApiOrigin = (() => {
  try {
    return new URL(configuredApiUrl).origin
  } catch {
    return ''
  }
})()
// Evita enviar las peticiones al sitio estático cuando Render tiene su URL
// configurada por error como VITE_API_URL.
const apuntaAlPanel = typeof window !== 'undefined'
  && configuredApiOrigin === window.location.origin
const API_BASE_URL = (configuredApiUrl && !apuntaAlPanel ? configuredApiUrl : API_BASE_FALLBACK)
  .replace(/\/+$/, '')
const API_URL = import.meta.env.DEV
  ? '/api'
  : API_BASE_URL.endsWith('/api') ? API_BASE_URL : `${API_BASE_URL}/api`

export function getToken() {
  return localStorage.getItem('hidro_token')
}

export function saveToken(token) {
  if (token) {
    localStorage.setItem('hidro_token', token)
  }
}

function saveSession(session) {
  saveToken(session?.access_token)
  if (session?.refresh_token) localStorage.setItem('hidro_refresh_token', session.refresh_token)
}

export function clearToken() {
  localStorage.removeItem('hidro_token')
  localStorage.removeItem('hidro_refresh_token')
}

let refreshInFlight = null

async function refreshSession() {
  const refreshToken = localStorage.getItem('hidro_refresh_token')
  if (!refreshToken) return false
  if (!refreshInFlight) {
    refreshInFlight = fetch(`${API_URL}/auth/renovar-sesion`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    }).then(async (response) => {
      const data = await response.json().catch(() => ({}))
      if (!response.ok || !data.session?.access_token) {
        clearToken()
        return false
      }
      saveSession(data.session)
      return true
    }).catch(() => false).finally(() => {
      refreshInFlight = null
    })
  }
  return refreshInFlight
}

async function sendRequest(path, options, token) {
  const headers = { ...(options.headers || {}) }
  if (!(options.body instanceof FormData) && typeof options.body !== 'string' && options.body !== undefined) {
    headers['Content-Type'] = headers['Content-Type'] || 'application/json'
  }
  if (token) headers.Authorization = `Bearer ${token}`
  return fetch(`${API_URL}${path}`, {
    ...options,
    headers,
    body: options.body !== undefined && !(options.body instanceof FormData) && typeof options.body !== 'string'
      ? JSON.stringify(options.body)
      : options.body,
  })
}

export async function apiRequest(path, options = {}) {
  let response = await sendRequest(path, options, getToken())
  if (response.status === 401 && getToken() && await refreshSession()) {
    response = await sendRequest(path, options, getToken())
  }

  const contentType = response.headers.get('content-type') || ''
  if (response.ok && !contentType.includes('application/json')) {
    throw new Error('El servidor API no devolvió una respuesta válida. Revisa VITE_API_URL en Render.')
  }
  const data = contentType.includes('application/json')
    ? await response.json().catch(() => ({}))
    : await response.text().catch(() => '')

  if (!response.ok) {
    const message = typeof data === 'object'
      ? (data.message || data.error || `Error HTTP ${response.status}`)
      : data || `Error HTTP ${response.status}`
    if (response.status === 401) {
      clearToken()
      if (typeof window !== 'undefined') window.dispatchEvent(new Event('hidro-session-expired'))
    }
    throw new Error(message)
  }

  return data
}

export const endpoints = {
  login: '/auth/login',
  verifyAdminEmail: '/auth/verificar-administrador',
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
  cortes: '/cortes',
  notificaciones: '/notificaciones',
  marcarNotificacionesLeidas: '/notificaciones/marcar-todas',
  tarifas: '/tarifas',
}

export async function login(correo, password) {
  const data = await apiRequest(endpoints.login, {
    method: 'POST',
    body: { correo, password },
  })

  if (!data.session?.access_token) {
    throw new Error('El servidor no devolvió una sesión válida')
  }

  saveSession(data.session)
  return data
}
