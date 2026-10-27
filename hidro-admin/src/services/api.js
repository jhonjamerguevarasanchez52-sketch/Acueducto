const API_BASE_URL = (import.meta.env.VITE_API_URL || 'https://hidro-app.onrender.com')
  .trim()
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

export function clearToken() {
  localStorage.removeItem('hidro_token')
}

export async function apiRequest(path, options = {}) {
  const token = getToken()
  const headers = { ...(options.headers || {}) }

  if (!(options.body instanceof FormData) && typeof options.body !== 'string' && options.body !== undefined) {
    headers['Content-Type'] = headers['Content-Type'] || 'application/json'
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
    body:
      options.body !== undefined && !(options.body instanceof FormData) && typeof options.body !== 'string'
        ? JSON.stringify(options.body)
        : options.body,
  })

  const contentType = response.headers.get('content-type') || ''
  const data = contentType.includes('application/json')
    ? await response.json().catch(() => ({}))
    : await response.text().catch(() => '')

  if (!response.ok) {
    const message = typeof data === 'object'
      ? (data.message || data.error || `Error HTTP ${response.status}`)
      : data || `Error HTTP ${response.status}`
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

  saveToken(data.session.access_token)
  return data
}
