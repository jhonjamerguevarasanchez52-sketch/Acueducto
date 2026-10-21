import { useEffect, useState } from 'react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  AlertTriangle,
  ArrowUpRight,
  BellRing,
  CheckCircle2,
  ChevronRight,
  Clock3,
  CreditCard,
  Download,
  Eye,
  FileText,
  Gauge,
  Menu,
  Plus,
  Printer,
  Search,
  ShieldCheck,
  Trash2,
  TrendingUp,
  Upload,
  UserRound,
  UserRoundPlus,
  Waves,
  KeyRound,
} from 'lucide-react'
import Sidebar from './components/Sidebar.jsx'
import StatCard from './components/StatCard.jsx'
import { apiRequest, clearToken, endpoints, getToken, login } from './services/api.js'
import { parseUsersCsv, parseUsersExcel } from './utils/usersCsv.js'
import hidroAppLogo from './assets/hidroapp-logo.png'

const quickActions = [
  { label: 'Usuarios', section: 'usuarios', icon: UserRoundPlus },
  { label: 'Facturación', section: 'facturas', icon: FileText },
  { label: 'Cortes', section: 'cortes', icon: Gauge },
]

const resourceEndpointBySection = {
  usuarios: 'adminUsers',
  facturas: 'facturasTodas',
  pagos: 'pagos',
  cortes: 'cortes',
  notificaciones: 'notificaciones',
  tarifas: 'tarifas',
}

const MAX_BULK_USERS = 100
const MAX_USER_FILE_SIZE_BYTES = 5 * 1024 * 1024

const operationDefinitions = {
  factura: {
    title: 'Emitir factura', section: 'facturas', endpoint: endpoints.facturas, method: 'POST',
    fields: [
      { name: 'perfil_id', label: 'Suscriptor', type: 'user', required: true },
      { name: 'periodo', label: 'Periodo', required: true },
      { name: 'valor_total', label: 'Valor total', type: 'number', required: true },
      { name: 'fecha_vencimiento', label: 'Fecha de vencimiento', type: 'date' },
      { name: 'tipo', label: 'Tipo', type: 'select', options: ['servicio', 'extraordinaria'], defaultValue: 'servicio' },
      { name: 'observacion', label: 'Observación' },
    ],
  },
  facturaExtraordinaria: {
    title: 'Factura extraordinaria', section: 'facturas', endpoint: endpoints.facturaExtraordinaria, method: 'POST',
    fields: [
      { name: 'periodo', label: 'Periodo', required: true },
      { name: 'valor_total', label: 'Valor total', type: 'number', required: true },
      { name: 'concepto', label: 'Concepto', required: true },
      { name: 'fecha_vencimiento', label: 'Fecha de vencimiento', type: 'date' },
    ],
  },
  facturacionMensual: {
    title: 'Generar facturas mensuales', section: 'facturas', endpoint: endpoints.generarFacturasMensuales, method: 'POST',
    fields: [
      { name: 'periodo', label: 'Periodo · usuarios activos · $12.000 por factura', type: 'month', required: true },
    ],
  },
  editarFactura: {
    title: 'Editar factura', section: 'facturas', endpoint: endpoints.facturas, method: 'PUT',
    fields: [
      { name: 'estado', label: 'Estado', type: 'select', options: ['pendiente', 'pagada', 'anulada', 'vencida'] },
      { name: 'valor_total', label: 'Valor total', type: 'number' },
      { name: 'fecha_vencimiento', label: 'Fecha de vencimiento', type: 'date' },
      { name: 'observacion', label: 'Observación' },
    ],
  },
  corte: {
    title: 'Programar corte', section: 'cortes', endpoint: endpoints.cortes, method: 'POST',
    fields: [
      { name: 'perfil_id', label: 'Suscriptor', type: 'user', required: true },
      { name: 'motivo', label: 'Motivo', required: true },
      { name: 'factura_id', label: 'ID de factura asociada' },
    ],
  },
  tarifa: {
    title: 'Crear tarifa', section: 'tarifas', endpoint: endpoints.tarifas, method: 'POST',
    fields: [
      { name: 'tipo', label: 'Tipo', type: 'select', options: ['residencial', 'comercial', 'industrial'], defaultValue: 'residencial' },
      { name: 'cuota_fija', label: 'Cuota fija', type: 'number', required: true },
      { name: 'vigente_desde', label: 'Vigente desde', type: 'date', required: true },
      { name: 'vigente_hasta', label: 'Vigente hasta', type: 'date' },
    ],
  },
  editarTarifa: {
    title: 'Editar tarifa', section: 'tarifas', endpoint: endpoints.tarifas, method: 'PUT',
    fields: [
      { name: 'tipo', label: 'Tipo', type: 'select', options: ['residencial', 'comercial', 'industrial'] },
      { name: 'cuota_fija', label: 'Cuota fija', type: 'number', required: true },
      { name: 'vigente_desde', label: 'Vigente desde', type: 'date', required: true },
      { name: 'vigente_hasta', label: 'Vigente hasta', type: 'date' },
    ],
  },
  notificacion: {
    title: 'Publicar aviso', section: 'notificaciones', endpoint: endpoints.notificaciones, method: 'POST',
    fields: [
      { name: 'perfil_id', label: 'Destinatario', type: 'recipient', defaultValue: 'todos' },
      { name: 'tipo', label: 'Tipo', type: 'select', options: ['general', 'servicio', 'factura', 'corte'], defaultValue: 'general' },
      { name: 'mensaje', label: 'Mensaje', type: 'textarea', required: true },
    ],
  },
  editarUsuario: {
    title: 'Editar usuario', section: 'usuarios', endpoint: endpoints.adminUsers, method: 'PUT',
    fields: [
      { name: 'nombre', label: 'Nombre' },
      { name: 'apellido', label: 'Apellido' },
      { name: 'telefono', label: 'Teléfono' },
      { name: 'numero_lote', label: 'Número de lote' },
      { name: 'direccion', label: 'Dirección' },
      { name: 'ocupacion', label: 'Ocupación' },
      { name: 'zona', label: 'Zona' },
    ],
  },
}

const formatMoney = (value) => Number(value || 0).toLocaleString('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
})

const formatDate = (value) => value ? new Date(value).toLocaleDateString('es-CO') : '—'
const formatInvoiceNumber = (invoice) => invoice.numero_factura
  ? `FAC-${String(invoice.numero_factura).padStart(6, '0')}`
  : `FAC-${String(invoice.id || '').slice(0, 8).toUpperCase()}`

function App() {
  const [activeSection, setActiveSection] = useState('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [sessionStatus, setSessionStatus] = useState(getToken() ? 'checking' : 'signed-out')
  const [profile, setProfile] = useState(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [recoveryCode, setRecoveryCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')
  const [authMode, setAuthMode] = useState('login')
  const [searchQuery, setSearchQuery] = useState('')
  const [authError, setAuthError] = useState('')
  const [authNotice, setAuthNotice] = useState('')
  const [isLoggingIn, setIsLoggingIn] = useState(false)
  const [sectionData, setSectionData] = useState({})
  const [sectionErrors, setSectionErrors] = useState({})
  const [loadingSections, setLoadingSections] = useState({})
  const [createUserOpen, setCreateUserOpen] = useState(false)
  const [newUser, setNewUser] = useState({ nombre: '', apellido: '', correo: '', rol: 'usuario' })
  const [createUserError, setCreateUserError] = useState('')
  const [createdTemporaryPassword, setCreatedTemporaryPassword] = useState('')
  const [isCreatingUser, setIsCreatingUser] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [profileForm, setProfileForm] = useState({})
  const [profileError, setProfileError] = useState('')
  const [profileMessage, setProfileMessage] = useState('')
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const [currentProfilePassword, setCurrentProfilePassword] = useState('')
  const [newProfilePassword, setNewProfilePassword] = useState('')
  const [confirmProfilePassword, setConfirmProfilePassword] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [passwordMessage, setPasswordMessage] = useState('')
  const [isChangingProfilePassword, setIsChangingProfilePassword] = useState(false)
  const [bulkUserOpen, setBulkUserOpen] = useState(false)
  const [bulkUsers, setBulkUsers] = useState([])
  const [bulkUserResults, setBulkUserResults] = useState([])
  const [bulkUserError, setBulkUserError] = useState('')
  const [bulkProgress, setBulkProgress] = useState({ completed: 0, total: 0 })
  const [isImportingUsers, setIsImportingUsers] = useState(false)
  const [operationType, setOperationType] = useState('')
  const [operationItem, setOperationItem] = useState(null)
  const [operationForm, setOperationForm] = useState({})
  const [operationError, setOperationError] = useState('')
  const [operationPending, setOperationPending] = useState(false)
  const [invoicePreview, setInvoicePreview] = useState(null)
  const [actionMessage, setActionMessage] = useState('')
  const [actionError, setActionError] = useState('')

  const filterRows = (rows) => {
    const query = searchQuery.trim().toLocaleLowerCase('es')
    if (!query) return rows
    return rows.filter((row) => Object.values(row).some((value) => (
      String(value ?? '').toLocaleLowerCase('es').includes(query)
    )))
  }

  useEffect(() => {
    if (!getToken()) return

    apiRequest(endpoints.profile)
      .then((currentProfile) => {
        if (currentProfile.rol !== 'administrador') {
          throw new Error('Esta cuenta no tiene permisos de administrador')
        }
        setProfile(currentProfile)
        setSessionStatus('authenticated')
      })
      .catch((error) => {
        clearToken()
        setAuthError(error.message || 'La sesión expiró. Inicia sesión de nuevo.')
        setSessionStatus('signed-out')
      })
  }, [])

  useEffect(() => {
    if (sessionStatus !== 'authenticated' || activeSection !== 'dashboard') return

    let cancelled = false
    Promise.all(Object.entries(resourceEndpointBySection).map(async ([section, endpointName]) => {
      try {
        const data = await apiRequest(endpoints[endpointName])
        return { section, data: Array.isArray(data) ? data : [], error: '' }
      } catch (error) {
        return { section, data: [], error: error.message || 'No fue posible cargar los datos' }
      }
    })).then((results) => {
      if (cancelled) return
      setSectionData((current) => ({
        ...current,
        ...Object.fromEntries(results.map(({ section, data }) => [section, data])),
      }))
      setSectionErrors((current) => ({
        ...current,
        ...Object.fromEntries(results.map(({ section, error }) => [section, error])),
      }))
    })

    return () => { cancelled = true }
  }, [activeSection, sessionStatus])

  const loadSection = async (section) => {
    const endpointName = resourceEndpointBySection[section]
    if (!endpointName) return

    setLoadingSections((current) => ({ ...current, [section]: true }))
    setSectionErrors((current) => ({ ...current, [section]: '' }))
    try {
      const data = await apiRequest(endpoints[endpointName])
      setSectionData((current) => ({ ...current, [section]: Array.isArray(data) ? data : [] }))
    } catch (error) {
      setSectionErrors((current) => ({ ...current, [section]: error.message || 'No fue posible cargar los datos' }))
    } finally {
      setLoadingSections((current) => ({ ...current, [section]: false }))
    }
  }

  const ensureUsersLoaded = async () => {
    if (sessionStatus !== 'authenticated') return
    const usersLoaded = (sectionData.usuarios || []).length > 0
    if (usersLoaded || sectionErrors.usuarios) return
    await loadSection('usuarios')
  }

  const handleNavigate = (section) => {
    setActiveSection(section)
    setSearchQuery('')
    loadSection(section)
    if (section === 'facturas' || section === 'pagos') void ensureUsersLoaded()
  }

  const handleCreateUser = async (event) => {
    event.preventDefault()
    setIsCreatingUser(true)
    setCreateUserError('')
    try {
      const result = await apiRequest(endpoints.adminUsers, {
        method: 'POST',
        body: newUser,
      })
      setCreatedTemporaryPassword(result.passwordTemporal || '')
      await loadSection('usuarios')
    } catch (error) {
      setCreateUserError(error.message || 'No fue posible crear el usuario')
    } finally {
      setIsCreatingUser(false)
    }
  }

  const openBulkUserImport = () => {
    setBulkUsers([])
    setBulkUserResults([])
    setBulkUserError('')
    setBulkProgress({ completed: 0, total: 0 })
    setBulkUserOpen(true)
  }

  const handleBulkFileChange = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    setBulkUsers([])
    setBulkUserResults([])
    setBulkUserError('')

    if (!file) return
    const extension = file.name.split('.').pop()?.toLowerCase()
    if (!['csv', 'xlsx'].includes(extension)) {
      setBulkUserError('Selecciona un archivo CSV o Excel (.xlsx).')
      return
    }
    if (file.size > MAX_USER_FILE_SIZE_BYTES) {
      setBulkUserError('El archivo supera el tamaño máximo de 5 MB.')
      return
    }

    try {
      const rows = extension === 'csv'
        ? parseUsersCsv(await file.text())
        : await parseUsersExcel(file)
      if (rows.length > MAX_BULK_USERS) {
        setBulkUserError(`El archivo supera el máximo de ${MAX_BULK_USERS} usuarios. Divídelo en varios archivos.`)
        return
      }
      setBulkUsers(rows)
    } catch (error) {
      setBulkUserError(error.message || 'No fue posible leer el archivo.')
    }
  }

  const handleDownloadBulkErrors = () => {
    const errors = bulkUserResults.filter((user) => user.status === 'error')
    if (errors.length === 0) return

    const quote = (value) => {
      const text = String(value ?? '')
      const safeText = /^[\s]*[=+\-@]/.test(text) ? `'${text}` : text
      return `"${safeText.replaceAll('"', '""')}"`
    }
    const lines = [
      ['nombre', 'apellido', 'correo', 'rol', 'error'],
      ...errors.map((user) => [user.nombre, user.apellido, user.correo, user.rol, user.error || user.message]),
    ]
    const csv = lines.map((line) => line.map(quote).join(',')).join('\r\n')
    const file = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(file)
    const link = document.createElement('a')
    link.href = url
    link.download = `usuarios-con-errores-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  const handleBulkUserImport = async (event) => {
    event.preventDefault()
    const validUsers = bulkUsers.filter((user) => !user.error)
    if (validUsers.length === 0) return

    setIsImportingUsers(true)
    setBulkUserError('')
    setBulkProgress({ completed: 0, total: validUsers.length })
    setBulkUserResults(bulkUsers.map((user) => ({
      ...user,
      status: user.error ? 'error' : 'pending',
      message: user.error || 'Pendiente',
    })))

    let completed = 0
    for (const user of validUsers) {
      let result
      try {
        const response = await apiRequest(endpoints.adminUsers, {
          method: 'POST',
          body: {
            nombre: user.nombre,
            apellido: user.apellido,
            correo: user.correo,
            rol: user.rol,
          },
        })
        result = { ...user, status: 'success', message: response.message || 'Cuenta creada.' }
      } catch (error) {
        result = { ...user, status: 'error', message: error.message || 'No fue posible crear la cuenta.' }
      }

      completed += 1
      setBulkProgress({ completed, total: validUsers.length })
      setBulkUserResults((current) => current.map((row) => (
        row.line === user.line ? result : row
      )))
    }

    await loadSection('usuarios')
    setIsImportingUsers(false)
  }

  const handleDownloadUsersTemplate = () => {
    const content = '\uFEFFnombre,apellido,correo,rol\r\nAna,Lopez,ana@ejemplo.com,usuario\r\n'
    const file = new Blob([content], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(file)
    const link = document.createElement('a')
    link.href = url
    link.download = 'plantilla-usuarios.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  const openCreateUser = () => {
    setCreateUserError('')
    setCreatedTemporaryPassword('')
    setNewUser({ nombre: '', apellido: '', correo: '', rol: 'usuario' })
    setCreateUserOpen(true)
  }

  const openOperation = async (type, item = null) => {
    const definition = operationDefinitions[type]
    if (!definition) return

    if (definition.fields.some((field) => field.type === 'user' || field.type === 'recipient')) {
      await ensureUsersLoaded()
    }

    setOperationType(type)
    setOperationItem(item)
    setOperationError('')
    setOperationForm(Object.fromEntries(definition.fields.map((field) => [
      field.name,
      field.type === 'date' && item?.[field.name]
        ? String(item[field.name]).slice(0, 10)
        : item?.[field.name] ?? field.defaultValue ?? '',
    ])))
  }

  const handleOperationSubmit = async (event) => {
    event.preventDefault()
    const definition = operationDefinitions[operationType]
    if (operationType === 'facturacionMensual') {
      const confirmar = window.confirm(
        `Se generarán facturas de servicio por $12.000 para los usuarios activos sin factura del periodo ${operationForm.periodo}. ¿Continuar?`,
      )
      if (!confirmar) return
    }
    const body = Object.fromEntries(definition.fields
      .filter((field) => operationForm[field.name] !== '')
      .map((field) => [
        field.name,
        field.type === 'number' ? Number(operationForm[field.name]) : operationForm[field.name],
      ]))
    const suffix = operationType === 'editarUsuario' || operationType === 'editarTarifa' || operationType === 'editarFactura'
      ? `/${operationItem.id}`
      : ''

    setOperationPending(true)
    setOperationError('')
    setActionMessage('')
    setActionError('')
    try {
      const result = await apiRequest(`${definition.endpoint}${suffix}`, {
        method: definition.method,
        body,
      })
      setActionMessage(result.message || 'Cambios guardados.')
      setOperationType('')
      await loadSection(definition.section)
    } catch (error) {
      setOperationError(error.message || 'No fue posible completar la operación.')
    } finally {
      setOperationPending(false)
    }
  }

  const performAction = async (section, path, method, body, confirmation) => {
    if (confirmation && !window.confirm(confirmation)) return
    setActionMessage('')
    setActionError('')
    try {
      const result = await apiRequest(path, { method, body })
      setActionMessage(result.message || 'Operación completada.')
      await loadSection(section)
    } catch (error) {
      setActionError(error.message || 'No fue posible completar la operación.')
    }
  }

  const openInvoicePreview = async (invoice) => {
    await ensureUsersLoaded()
    setInvoicePreview(invoice)
  }

  const handleDownloadInvoice = () => {
    const printWindow = window.open('', '_blank')
    const invoiceDocument = document.getElementById('invoice-document')
    if (!printWindow || !invoiceDocument) {
      setActionError('Permite las ventanas emergentes para descargar la factura.')
      return
    }

    printWindow.addEventListener('afterprint', () => printWindow.close(), { once: true })
    printWindow.document.write(`<!doctype html>
      <html lang="es">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>${formatInvoiceNumber(invoicePreview)}</title>
          <style>
            @page { size: A4; margin: 18mm; }
            * { box-sizing: border-box; }
            body { margin: 0; color: #172d35; font: 14px Arial, sans-serif; }
            .invoice-sheet { position: relative; overflow: hidden; padding: 0; border: 1px solid #d5e5ec; background: #fff; color: #173448; }
            .invoice-watermark { position: absolute; z-index: 0; top: 32%; right: 7%; width: 320px; max-width: 52%; opacity: .04; pointer-events: none; }
            .invoice-watermark img { display: block; width: 100%; height: auto; }
            .invoice-sheet > :not(.invoice-watermark) { position: relative; z-index: 1; }
            .invoice-heading { display: flex; align-items: center; justify-content: space-between; gap: 24px; padding: 22px 24px; background: linear-gradient(120deg, #1e5fa0, #0a3665); color: #fff; }
            .invoice-heading-brand { display: flex; align-items: center; gap: 14px; }
            .invoice-logo-frame { display: grid; flex: none; place-items: center; width: 54px; height: 54px; overflow: hidden; border-radius: 12px; background: #fff; }
            .invoice-logo { display: block; width: 100%; height: 100%; object-fit: cover; }
            .invoice-brand { color: #dceff5; font-size: 11px; font-weight: 700; text-transform: uppercase; }
            .invoice-heading h2 { margin: 7px 0 0; color: #fff; font-size: 24px; }
            .invoice-number { flex: none; text-align: right; }
            .invoice-number span { color: #dceff5; font-size: 11px; text-transform: uppercase; }
            .invoice-number strong { display: block; margin-top: 6px; font-size: 16px; }
            .invoice-meta { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; margin: 22px 24px; }
            .invoice-meta div { padding: 12px; border: 1px solid #e1edf2; background: #f3f8fa; }
            .invoice-meta div:nth-child(1) { border-top: 3px solid #35a7d8; }
            .invoice-meta div:nth-child(2) { border-top: 3px solid #dca934; }
            .invoice-meta div:nth-child(3) { border-top: 3px solid #34a879; }
            .invoice-meta div:nth-child(4) { border-top: 3px solid #e77757; }
            .invoice-meta span, .invoice-party > span { display: block; margin-bottom: 6px; color: #607987; font-size: 10px; font-weight: 700; text-transform: uppercase; }
            .invoice-party { margin: 0 24px 22px; padding: 15px; border-left: 3px solid #4fc3f7; background: #f7fafc; }
            .invoice-party p { margin: 4px 0 0; color: #607987; }
            .invoice-lines { width: calc(100% - 48px); margin: 22px 24px 0; border-collapse: collapse; }
            .invoice-lines th, .invoice-lines td { padding: 12px 10px; border-bottom: 1px solid #dce6ec; text-align: left; }
            .invoice-lines th:last-child, .invoice-lines td:last-child { text-align: right; }
            .invoice-lines th { color: #607987; font-size: 10px; text-transform: uppercase; }
            .invoice-total { display: flex; justify-content: flex-end; gap: 28px; margin: 4px 24px 0; padding: 16px; border-left: 4px solid #00a878; background: linear-gradient(120deg, #eaf5fb, #e7f8ef); color: #173448; font-size: 17px; font-weight: 700; }
            .invoice-note { margin: 20px 24px 0; padding: 14px 0 20px; border-top: 1px solid #dce6ec; color: #607987; }
            @media (max-width: 600px) { .invoice-heading { gap: 12px; padding: 16px; } .invoice-heading h2 { font-size: 18px; } .invoice-logo-frame { width: 44px; height: 44px; } .invoice-meta { grid-template-columns: repeat(2, minmax(0, 1fr)); margin: 16px; } .invoice-party { margin: 0 16px 18px; } .invoice-lines { width: calc(100% - 32px); margin: 18px 16px 0; } .invoice-total { margin: 4px 16px 0; } .invoice-note { margin: 18px 16px 0; } }
            @media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
          </style>
        </head>
        <body>${invoiceDocument.innerHTML}</body>
      </html>`)
    printWindow.document.close()
    printWindow.setTimeout(() => {
      printWindow.focus()
      printWindow.print()
    }, 250)
    setActionError('')
  }

  const handleLogin = async (event) => {
    event.preventDefault()
    setIsLoggingIn(true)
    setAuthError('')
    setAuthNotice('')

    try {
      await login(email, password)
      const currentProfile = await apiRequest(endpoints.profile)
      if (currentProfile.rol !== 'administrador') {
        throw new Error('Esta cuenta no tiene permisos de administrador')
      }
      setProfile(currentProfile)
      setSessionStatus('authenticated')
      setPassword('')
    } catch (error) {
      clearToken()
      setAuthError(error.message || 'No fue posible iniciar sesión')
    } finally {
      setIsLoggingIn(false)
    }
  }

  const openProfile = () => {
    setProfileForm({
      nombre: profile?.nombre || '',
      apellido: profile?.apellido || '',
      telefono: profile?.telefono || '',
      numero_lote: profile?.numero_lote || '',
      direccion: profile?.direccion || '',
      ocupacion: profile?.ocupacion || '',
      zona: profile?.zona || '',
    })
    setProfileError('')
    setProfileMessage('')
    setPasswordError('')
    setPasswordMessage('')
    setCurrentProfilePassword('')
    setNewProfilePassword('')
    setConfirmProfilePassword('')
    setProfileOpen(true)
  }

  const handleSaveProfile = async (event) => {
    event.preventDefault()
    setIsSavingProfile(true)
    setProfileError('')
    setProfileMessage('')
    try {
      const result = await apiRequest(endpoints.profile, {
        method: 'PUT',
        body: profileForm,
      })
      setProfile(result.perfil || { ...profile, ...profileForm })
      setProfileMessage(result.message || 'Perfil actualizado.')
    } catch (error) {
      setProfileError(error.message || 'No fue posible actualizar el perfil.')
    } finally {
      setIsSavingProfile(false)
    }
  }

  const handleChangeProfilePassword = async (event) => {
    event.preventDefault()
    setPasswordError('')
    setPasswordMessage('')
    if (newProfilePassword !== confirmProfilePassword) {
      setPasswordError('La nueva contraseña y su confirmación no coinciden.')
      return
    }
    if (newProfilePassword.length < 8) {
      setPasswordError('La nueva contraseña debe tener al menos 8 caracteres.')
      return
    }

    setIsChangingProfilePassword(true)
    try {
      const result = await apiRequest(endpoints.changePassword, {
        method: 'POST',
        body: {
          passwordActual: currentProfilePassword,
          passwordNueva: newProfilePassword,
        },
      })
      setPasswordMessage(result.message || 'Contraseña actualizada.')
      setCurrentProfilePassword('')
      setNewProfilePassword('')
      setConfirmProfilePassword('')
    } catch (error) {
      setPasswordError(error.message || 'No fue posible cambiar la contraseña.')
    } finally {
      setIsChangingProfilePassword(false)
    }
  }

  const handleRecoverySubmit = async (event) => {
    event.preventDefault()
    setAuthError('')
    setAuthNotice('')

    if (authMode === 'reset' && newPassword !== confirmNewPassword) {
      setAuthError('Las contraseñas no coinciden.')
      return
    }

    setIsLoggingIn(true)
    try {
      if (authMode === 'request-reset') {
        const result = await apiRequest(endpoints.requestPasswordReset, {
          method: 'POST',
          body: { correo: email },
        })
        setAuthMode('reset')
        setAuthNotice(result.message || 'Si el correo existe, recibirás un código de recuperación.')
      } else {
        const result = await apiRequest(endpoints.resetPassword, {
          method: 'POST',
          body: { correo: email, codigo: recoveryCode, nuevaPassword: newPassword },
        })
        setAuthMode('login')
        setPassword('')
        setRecoveryCode('')
        setNewPassword('')
        setConfirmNewPassword('')
        setAuthNotice(result.message || 'Contraseña actualizada. Ya puedes iniciar sesión.')
      }
    } catch (error) {
      setAuthError(error.message || 'No fue posible completar la recuperación.')
    } finally {
      setIsLoggingIn(false)
    }
  }

  const handleLogout = () => {
    clearToken()
    setProfile(null)
    setSectionData({})
    setSectionErrors({})
    setSessionStatus('signed-out')
    setAuthError('')
  }

  const handleRefresh = async () => {
    setIsRefreshing(true)
    try {
      const sections = activeSection === 'dashboard'
        ? Object.keys(resourceEndpointBySection)
        : [activeSection]
      await Promise.all(sections.map(loadSection))
    } finally {
      setIsRefreshing(false)
    }
  }

  const handleExportPayments = () => {
    const rows = sectionData.pagos || []
    if (rows.length === 0) {
      setActionError('No hay pagos cargados para exportar.')
      return
    }

    const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))]
    const quote = (value) => {
      const text = String(value ?? '')
      const safeText = /^[\s]*[=+\-@]/.test(text) ? `'${text}` : text
      return `"${safeText.replaceAll('"', '""')}"`
    }
    const csv = [columns, ...rows.map((row) => columns.map((column) => row[column]))]
      .map((line) => line.map(quote).join(','))
      .join('\r\n')
    const file = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(file)
    const link = document.createElement('a')
    link.href = url
    link.download = `pagos-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
    setActionError('')
    setActionMessage('Se exportó el listado de pagos.')
  }

  const users = sectionData.usuarios || []
  const invoices = sectionData.facturas || []
  const payments = sectionData.pagos || []
  const cuts = sectionData.cortes || []
  const confirmedPayments = payments.filter((payment) => payment.confirmado)
  const activeUsers = users.filter((user) => user.activo)
  const pendingInvoices = invoices.filter((invoice) => invoice.estado === 'pendiente')
  const activeCuts = cuts.filter((cut) => cut.estado === 'activo')
  const metricValue = (section, value) => (
    sectionErrors[section] || sectionData[section] === undefined ? '—' : value
  )
  const dashboardKpis = [
    { id: 'usuarios', title: 'Usuarios activos', value: metricValue('usuarios', activeUsers.length), detail: 'Cuentas habilitadas', icon: UserRoundPlus, tone: 'blue' },
    { id: 'ingresos', title: 'Ingresos recibidos', value: metricValue('pagos', formatMoney(confirmedPayments.reduce((sum, payment) => sum + Number(payment.monto || 0), 0))), detail: 'Pagos confirmados', icon: CreditCard, tone: 'green' },
    { id: 'facturas', title: 'Facturas pendientes', value: metricValue('facturas', pendingInvoices.length), detail: 'Pendientes de pago', icon: FileText, tone: 'amber' },
    { id: 'cortes', title: 'Servicios suspendidos', value: metricValue('cortes', activeCuts.length), detail: 'Cortes activos', icon: AlertTriangle, tone: 'red' },
  ]
  const monthlyRevenue = new Map()
  confirmedPayments.forEach((payment) => {
    const date = new Date(payment.fecha_pago)
    if (Number.isNaN(date.getTime())) return
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    const current = monthlyRevenue.get(key) || {
      name: date.toLocaleDateString('es-CO', { month: 'short' }),
      valor: 0,
    }
    current.valor += Number(payment.monto || 0)
    monthlyRevenue.set(key, current)
  })
  const revenueTrend = [...monthlyRevenue.entries()]
    .sort(([first], [second]) => first.localeCompare(second))
    .slice(-8)
    .map(([, item]) => item)
  const roleColors = { administrador: '#1f8fff', usuario: '#53c18b', fontanero: '#ff9d42' }
  const roleCounts = users.reduce((counts, user) => {
    const role = user.rol || 'sin rol'
    counts[role] = (counts[role] || 0) + 1
    return counts
  }, {})
  const serviceMix = Object.entries(roleCounts).map(([name, count]) => ({
    name,
    value: users.length ? Math.round((count / users.length) * 100) : 0,
    color: roleColors[name] || '#7a8cc3',
  }))
  const recentUsers = users.slice(0, 4).map((user) => ({
    name: [user.nombre, user.apellido].filter(Boolean).join(' ') || user.correo || 'Sin nombre',
    zone: user.zona || user.correo || 'Sin ubicación',
    status: user.activo ? 'Activo' : 'Inactivo',
    date: formatDate(user.created_at),
  }))
  const reportSummary = [
    { label: 'Usuarios registrados', value: metricValue('usuarios', users.length) },
    { label: 'Pagos por confirmar', value: metricValue('pagos', payments.filter((payment) => !payment.confirmado).length) },
    { label: 'Cortes activos', value: metricValue('cortes', activeCuts.length) },
  ]

  if (sessionStatus === 'checking') {
    return <main className="auth-shell"><p className="auth-loading">Verificando sesión...</p></main>
  }

  if (sessionStatus !== 'authenticated') {
    return (
      <main className="auth-shell">
        <form className="auth-panel" onSubmit={authMode === 'login' ? handleLogin : handleRecoverySubmit}>
          <div className="auth-mark"><Waves size={25} /></div>
          <p className="eyebrow">Acueducto Campoamor</p>
          <h1>{authMode === 'login' ? 'Panel administrativo' : authMode === 'request-reset' ? 'Recuperar contraseña' : 'Crear contraseña nueva'}</h1>
          <p className="auth-description">
            {authMode === 'login'
              ? 'Ingresa con tu cuenta de administrador.'
              : authMode === 'request-reset'
                ? 'Te enviaremos un código al correo de tu cuenta.'
                : 'Ingresa el código recibido y define una contraseña de al menos 8 caracteres.'}
          </p>
          <label htmlFor="admin-email">Correo electrónico</label>
          <input
            id="admin-email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
          {authMode === 'login' && (
            <>
              <label htmlFor="admin-password">Contraseña</label>
              <input
                id="admin-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </>
          )}
          {authMode === 'reset' && (
            <>
              <label htmlFor="recovery-code">Código de recuperación</label>
              <input
                id="recovery-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={recoveryCode}
                onChange={(event) => setRecoveryCode(event.target.value)}
                required
              />
              <label htmlFor="new-password">Nueva contraseña</label>
              <input
                id="new-password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                required
              />
              <label htmlFor="confirm-password">Confirmar contraseña</label>
              <input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                value={confirmNewPassword}
                onChange={(event) => setConfirmNewPassword(event.target.value)}
                required
              />
            </>
          )}
          {authNotice && <p className="auth-notice" role="status">{authNotice}</p>}
          {authError && <p className="auth-error" role="alert">{authError}</p>}
          <button className="primary-button auth-submit" type="submit" disabled={isLoggingIn}>
            {isLoggingIn
              ? authMode === 'login' ? 'Ingresando...' : authMode === 'request-reset' ? 'Enviando código...' : 'Actualizando...'
              : authMode === 'login' ? 'Iniciar sesión' : authMode === 'request-reset' ? 'Enviar código' : 'Actualizar contraseña'}
          </button>
          {authMode === 'login' ? (
            <button type="button" className="link-button auth-link" onClick={() => { setAuthMode('request-reset'); setAuthError(''); setAuthNotice('') }}>
              Olvidé mi contraseña
            </button>
          ) : (
            <button type="button" className="link-button auth-link" onClick={() => { setAuthMode('login'); setAuthError(''); setAuthNotice('') }}>
              Volver a iniciar sesión
            </button>
          )}
        </form>
      </main>
    )
  }

  const renderDashboard = () => (
    <>
      <section className="kpi-grid">
        {dashboardKpis.map((item) => (
          <StatCard
            key={item.id}
            title={item.title}
            value={item.value}
            detail={item.detail}
            icon={item.icon}
            tone={item.tone}
          />
        ))}
      </section>

      <section className="analytics-grid">
        <div className="panel chart-panel large-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Estadísticas</p>
              <h3>Ingresos del servicio</h3>
            </div>
            <button type="button" className="soft-button" onClick={handleExportPayments}>
              <Download size={16} />
              Exportar
            </button>
          </div>

          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueTrend}>
                <defs>
                  <linearGradient id="revenueFill" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="5%" stopColor="#1f8fff" stopOpacity={0.42} />
                    <stop offset="95%" stopColor="#1f8fff" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#dfeaf9" strokeDasharray="4 4" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} />
                <Tooltip />
                <Area type="monotone" dataKey="valor" stroke="#1f8fff" fill="url(#revenueFill)" strokeWidth={3} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="panel chart-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Distribución</p>
              <h3>Tipo de usuarios</h3>
            </div>
          </div>

          <div className="donut-wrap">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={serviceMix} dataKey="value" innerRadius={50} outerRadius={80} paddingAngle={3}>
                  {serviceMix.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="legend-list">
            {serviceMix.map((item) => (
              <div key={item.name} className="legend-item">
                <span className="legend-dot" style={{ background: item.color }} />
                <span>{item.name}</span>
                <strong>{item.value}%</strong>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="content-grid">
        <div className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Clientes</p>
              <h3>Usuarios recientes</h3>
            </div>
            <button type="button" className="link-button" onClick={() => handleNavigate('usuarios')}>
              Ver todos <ChevronRight size={16} />
            </button>
          </div>
          <div className="stack-list">
            {recentUsers.map((user) => (
              <div key={`${user.name}-${user.date}`} className="user-row">
                <div className="user-avatar">{user.name.charAt(0)}</div>
                <div className="user-summary">
                  <strong>{user.name}</strong>
                  <span>{user.zone}</span>
                </div>
                <span className={`status-badge ${user.status.toLowerCase().replace(/\s+/g, '-')}`}>
                  {user.status}
                </span>
                <small>{user.date}</small>
              </div>
            ))}
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Resumen</p>
              <h3>Reportes rápidos</h3>
            </div>
          </div>
          <div className="report-grid">
            {reportSummary.map((item) => (
              <div key={item.label} className="mini-report">
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>
          <div className="notice-card">
            <div className="notice-icon">
              <ShieldCheck size={18} />
            </div>
            <div>
              <strong>Estado del servicio</strong>
              <p>{metricValue('cortes', `${activeCuts.length} cortes activos registrados.`)}</p>
            </div>
          </div>
        </div>
      </section>
    </>
  )

  const renderUsers = () => (
    <div className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Gestión de usuarios</p>
          <h3>Suscriptores y clientes</h3>
        </div>
        <div className="hero-actions">
          <button type="button" className="secondary-button" onClick={openBulkUserImport}>
            <Upload size={16} />
            Carga masiva
          </button>
          <button type="button" className="primary-button" onClick={openCreateUser}>
            <Plus size={16} />
            Nuevo usuario
          </button>
        </div>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Usuario</th>
              <th>Correo</th>
              <th>Rol</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {sectionErrors.usuarios ? (
              <tr><td colSpan="5" className="table-message error-text">{sectionErrors.usuarios}</td></tr>
            ) : loadingSections.usuarios ? (
              <tr><td colSpan="5" className="table-message">Cargando usuarios...</td></tr>
            ) : filterRows(sectionData.usuarios || []).length === 0 ? (
              <tr><td colSpan="5" className="table-message">No hay resultados.</td></tr>
            ) : filterRows(sectionData.usuarios).map((user) => (
              <tr key={user.id}>
                <td>{[user.nombre, user.apellido].filter(Boolean).join(' ') || 'Sin nombre'}</td>
                <td>{user.correo || '—'}</td>
                <td>{user.rol || '—'}</td>
                <td><span className={`status-badge ${user.activo ? 'activo' : 'inactivo'}`}>{user.activo ? 'Activo' : 'Inactivo'}</span></td>
                <td className="row-actions">
                  <button type="button" className="link-button" onClick={() => openOperation('editarUsuario', user)}>Editar</button>
                  {user.id !== profile?.id && <>
                    <button type="button" className="link-button" onClick={() => performAction('usuarios', `${endpoints.adminUsers}/${user.id}/estado`, 'PUT', { activo: !user.activo })}>
                      {user.activo ? 'Desactivar' : 'Activar'}
                    </button>
                    <select aria-label={`Rol de ${user.correo}`} value={user.rol} onChange={(event) => performAction('usuarios', `${endpoints.adminUsers}/${user.id}/rol`, 'PUT', { rol: event.target.value })}>
                      <option value="usuario">Usuario</option>
                      <option value="fontanero">Fontanero</option>
                      <option value="administrador">Administrador</option>
                    </select>
                    <button type="button" className="link-button danger-link" onClick={() => performAction('usuarios', `${endpoints.adminUsers}/${user.id}`, 'DELETE', undefined, 'La eliminación es permanente y borra el historial asociado a esta cuenta. No se puede deshacer. ¿Continuar?')}><Trash2 size={14} />Eliminar</button>
                  </>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )

  const renderFacturas = () => (
    <div className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Facturación</p>
          <h3>Facturas y vencimientos</h3>
        </div>
        <div className="hero-actions">
          <button type="button" className="secondary-button" onClick={() => openOperation('facturacionMensual')}>Generar para todos</button>
          <button type="button" className="secondary-button" onClick={() => openOperation('facturaExtraordinaria')}>Factura extraordinaria</button>
          <button type="button" className="primary-button" onClick={() => openOperation('factura')}><Plus size={16} />Nueva factura</button>
        </div>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Factura</th>
              <th>Suscriptor</th>
              <th>Periodo</th>
              <th>Valor</th>
              <th>Vencimiento</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {sectionErrors.facturas ? <tr><td colSpan="7" className="table-message error-text">{sectionErrors.facturas}</td></tr>
              : loadingSections.facturas ? <tr><td colSpan="7" className="table-message">Cargando facturas...</td></tr>
                  : filterRows(sectionData.facturas || []).length === 0 ? <tr><td colSpan="7" className="table-message">No hay resultados.</td></tr>
                    : filterRows(sectionData.facturas).map((invoice) => (
                    <tr key={invoice.id}>
                      <td>{formatInvoiceNumber(invoice)}</td>
                      <td>
                        {(() => {
                          const user = users.find((profileItem) => profileItem.id === invoice.perfil_id)
                          const name = [user?.nombre, user?.apellido].filter(Boolean).join(' ')
                          return (
                            <div className="identity-cell">
                              <strong>{name || 'Perfil sin nombre'}</strong>
                              <span>{user?.correo || 'Correo no disponible'}</span>
                              <small>{user?.direccion || user?.zona || 'Ubicación no registrada'}</small>
                            </div>
                          )
                        })()}
                      </td>
                      <td>{invoice.periodo}</td>
                      <td>{formatMoney(invoice.valor_total)}</td>
                      <td>{formatDate(invoice.fecha_vencimiento)}</td>
                      <td><span className={`status-badge ${invoice.estado}`}>{invoice.estado}</span></td>
                      <td className="row-actions">
                        <button type="button" className="link-button" onClick={() => openInvoicePreview(invoice)}><Eye size={14} />Ver</button>
                        <button type="button" className="link-button" onClick={() => openOperation('editarFactura', invoice)}>Editar</button>
                        <button type="button" className="link-button danger-link" onClick={() => performAction('facturas', `${endpoints.facturas}/${invoice.id}`, 'DELETE', undefined, '¿Eliminar esta factura? Si ya tiene pagos, el backend rechazará la operación; anúlala en ese caso.')}>Eliminar</button>
                      </td>
                    </tr>
                  ))}
          </tbody>
        </table>
      </div>
    </div>
  )

  const renderPagos = () => (
    <div className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Pagos</p>
          <h3>Últimas transacciones</h3>
        </div>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Perfil</th>
              <th>Factura</th>
              <th>Monto</th>
              <th>Método</th>
              <th>Fecha</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {sectionErrors.pagos ? <tr><td colSpan="8" className="table-message error-text">{sectionErrors.pagos}</td></tr>
              : loadingSections.pagos ? <tr><td colSpan="8" className="table-message">Cargando pagos...</td></tr>
                  : filterRows(sectionData.pagos || []).length === 0 ? <tr><td colSpan="8" className="table-message">No hay resultados.</td></tr>
                    : filterRows(sectionData.pagos).map((payment) => (
                    <tr key={payment.id}>
                      <td>{payment.id}</td>
                      <td>
                        {(() => {
                          const user = users.find((profileItem) => profileItem.id === payment.perfil_id)
                          const name = [user?.nombre, user?.apellido].filter(Boolean).join(' ')
                          return (
                            <div className="identity-cell">
                              <strong>{name || 'Perfil sin nombre'}</strong>
                              <span>{user?.correo || 'Correo no disponible'}</span>
                              <small>{user?.direccion || user?.zona || 'Ubicación no registrada'}</small>
                            </div>
                          )
                        })()}
                      </td>
                      <td>{formatInvoiceNumber(invoices.find((invoice) => invoice.id === payment.factura_id) || { id: payment.factura_id })}</td>
                      <td>{formatMoney(payment.monto)}</td>
                      <td>{payment.metodo === 'fisico' ? 'Pago físico' : payment.metodo === 'wompi' ? 'Wompi' : payment.metodo || '—'}</td>
                      <td>{formatDate(payment.fecha_pago)}</td>
                      <td>{payment.confirmado ? 'Confirmado' : 'Pendiente'}</td>
                      <td className="row-actions">
                        {payment.recibo_url && <a className="link-button" href={payment.recibo_url} target="_blank" rel="noreferrer">Ver recibo</a>}
                        {!payment.confirmado && <>
                          <button type="button" className="link-button" onClick={() => performAction('pagos', `${endpoints.pagos}/${payment.id}/confirmar`, 'PUT')}>Confirmar</button>
                          <button type="button" className="link-button danger-link" onClick={() => performAction('pagos', `${endpoints.pagos}/${payment.id}`, 'DELETE', undefined, '¿Eliminar este pago pendiente?')}>Eliminar</button>
                        </>}
                      </td>
                    </tr>
                  ))}
          </tbody>
        </table>
      </div>
    </div>
  )

  const renderCortes = () => (
    <div className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Servicio</p>
          <h3>Cortes y reconexiones</h3>
        </div>
        <button type="button" className="primary-button" onClick={() => openOperation('corte')}><Plus size={16} />Programar corte</button>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Perfil</th>
              <th>Motivo</th>
              <th>Fecha de corte</th>
              <th>Fecha de reconexión</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {sectionErrors.cortes ? <tr><td colSpan="7" className="table-message error-text">{sectionErrors.cortes}</td></tr>
              : loadingSections.cortes ? <tr><td colSpan="7" className="table-message">Cargando cortes...</td></tr>
                  : filterRows(sectionData.cortes || []).length === 0 ? <tr><td colSpan="7" className="table-message">No hay resultados.</td></tr>
                    : filterRows(sectionData.cortes).map((cut) => (
                    <tr key={cut.id}>
                      <td>{cut.id}</td>
                      <td>{cut.perfil_id}</td>
                      <td>{cut.motivo}</td>
                      <td>{formatDate(cut.fecha_corte)}</td>
                      <td>{formatDate(cut.fecha_reconexion)}</td>
                      <td><span className={`status-badge ${cut.estado}`}>{cut.estado}</span></td>
                      <td className="row-actions">
                        {cut.estado === 'activo' && <button type="button" className="link-button" onClick={() => performAction('cortes', `${endpoints.cortes}/${cut.id}/reconectar`, 'PUT')}>Reconectar</button>}
                        <button type="button" className="link-button danger-link" onClick={() => performAction('cortes', `${endpoints.cortes}/${cut.id}`, 'DELETE', undefined, '¿Eliminar este registro de corte?')}>Eliminar</button>
                      </td>
                    </tr>
                  ))}
          </tbody>
        </table>
      </div>
    </div>
  )

  const renderNotificaciones = () => (
    <div className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Comunicaciones</p>
          <h3>Notificaciones de la cuenta</h3>
        </div>
        <button type="button" className="primary-button" onClick={() => openOperation('notificacion')}><Plus size={16} />Publicar aviso</button>
        <button type="button" className="link-button" onClick={() => performAction('notificaciones', endpoints.marcarNotificacionesLeidas, 'PUT')}>Marcar todas leídas</button>
      </div>

      {sectionErrors.notificaciones ? <p className="table-message error-text">{sectionErrors.notificaciones}</p>
        : loadingSections.notificaciones ? <p className="table-message">Cargando notificaciones...</p>
          : filterRows(sectionData.notificaciones || []).length === 0 ? <p className="table-message">No hay resultados para esta cuenta.</p>
            : <div className="stack-list compact-list">
              {filterRows(sectionData.notificaciones).map((alert) => (
                <div key={alert.id} className="notification-row">
                  <div className="notification-icon"><BellRing size={16} /></div>
                  <div className="notification-copy">
                    <strong>{alert.mensaje}</strong>
                    <span>{alert.tipo}</span>
                  </div>
                  <span className={`tag ${alert.estado === 'no_leido' ? 'alta' : 'media'}`}>{alert.estado}</span>
                  <small>{formatDate(alert.fecha)}</small>
                  {alert.estado === 'no_leido' && <button type="button" className="link-button" onClick={() => performAction('notificaciones', `${endpoints.notificaciones}/${alert.id}/leida`, 'PUT')}>Marcar leída</button>}
                  <button type="button" className="link-button danger-link" onClick={() => performAction('notificaciones', `${endpoints.notificaciones}/${alert.id}`, 'DELETE', undefined, '¿Eliminar esta notificación?')}>Eliminar</button>
                </div>
              ))}
            </div>}
    </div>
  )

  const renderTarifas = () => (
    <div className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Tarifas</p>
          <h3>Plan de cobro por categoría</h3>
        </div>
        <button type="button" className="primary-button" onClick={() => openOperation('tarifa')}><Plus size={16} />Nueva tarifa</button>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Tipo</th>
              <th>Cuota fija</th>
              <th>Vigente desde</th>
              <th>Vigente hasta</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {sectionErrors.tarifas ? <tr><td colSpan="5" className="table-message error-text">{sectionErrors.tarifas}</td></tr>
              : loadingSections.tarifas ? <tr><td colSpan="5" className="table-message">Cargando tarifas...</td></tr>
                  : filterRows(sectionData.tarifas || []).length === 0 ? <tr><td colSpan="5" className="table-message">No hay resultados.</td></tr>
                    : filterRows(sectionData.tarifas).map((tariff) => (
                    <tr key={tariff.id}>
                      <td>{tariff.tipo}</td>
                      <td>{formatMoney(tariff.cuota_fija)}</td>
                      <td>{formatDate(tariff.vigente_desde)}</td>
                      <td>{formatDate(tariff.vigente_hasta)}</td>
                      <td className="row-actions">
                        <button type="button" className="link-button" onClick={() => openOperation('editarTarifa', tariff)}>Editar</button>
                        <button type="button" className="link-button danger-link" onClick={() => performAction('tarifas', `${endpoints.tarifas}/${tariff.id}`, 'DELETE', undefined, '¿Eliminar esta tarifa?')}>Eliminar</button>
                      </td>
                    </tr>
                  ))}
          </tbody>
        </table>
      </div>
    </div>
  )

  const renderReportes = () => (
    <>
      <section className="analytics-grid">
        <div className="panel chart-panel large-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Reporte</p>
              <h3>Ingresos y metas</h3>
            </div>
          </div>
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenueTrend}>
                <CartesianGrid stroke="#dfeaf9" strokeDasharray="4 4" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} />
                <Tooltip />
                <Bar dataKey="valor" radius={[10, 10, 0, 0]} fill="#53c18b" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Indicadores</p>
              <h3>Desempeño</h3>
            </div>
          </div>
          <div className="mini-overview">
            <div className="overview-item">
              <div className="overview-icon green"><TrendingUp size={16} /></div>
              <div>
                <strong>{metricValue('pagos', confirmedPayments.length)}</strong>
                <span>Pagos confirmados</span>
              </div>
            </div>
            <div className="overview-item">
              <div className="overview-icon blue"><Clock3 size={16} /></div>
              <div>
                <strong>{metricValue('pagos', payments.filter((payment) => !payment.confirmado).length)}</strong>
                <span>Pagos por confirmar</span>
              </div>
            </div>
            <div className="overview-item">
              <div className="overview-icon amber"><CheckCircle2 size={16} /></div>
              <div>
                <strong>{metricValue('usuarios', users.length ? `${Math.round((activeUsers.length / users.length) * 100)}%` : '0%')}</strong>
                <span>Usuarios activos</span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  )

  const sectionMap = {
    dashboard: renderDashboard(),
    usuarios: renderUsers(),
    facturas: renderFacturas(),
    pagos: renderPagos(),
    cortes: renderCortes(),
    notificaciones: renderNotificaciones(),
    tarifas: renderTarifas(),
    reportes: renderReportes(),
  }

  return (
    <div className="app-shell">
      <Sidebar
        active={activeSection}
        onNavigate={handleNavigate}
        onLogout={handleLogout}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="page-shell">
        <header className="topbar">
          <div className="topbar-left">
            <button type="button" className="icon-button desktop-hidden" onClick={() => setSidebarOpen(true)}>
              <Menu size={18} />
            </button>
            <div>
              <p className="eyebrow">Panel administrativo</p>
              <h1>HIDRO-APP</h1>
            </div>
          </div>

          <div className="topbar-actions">
            <label className="search-box" aria-label="Buscar">
              <Search size={16} />
              <input type="search" placeholder="Buscar en la sección actual..." value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} />
            </label>
            <button type="button" className="icon-button" onClick={handleRefresh}>
              <ArrowUpRight size={18} className={isRefreshing ? 'spin' : ''} />
            </button>
            <button type="button" className="icon-button notice-button" onClick={() => handleNavigate('notificaciones')} aria-label="Ver notificaciones">
              <BellRing size={18} />
              <span className="notification-count">{(sectionData.notificaciones || []).filter((item) => item.estado === 'no_leido').length}</span>
            </button>
            <button type="button" className="profile-box profile-box-button" onClick={openProfile} aria-label="Editar perfil y contraseña">
              <div className="profile-avatar">{profile?.nombre?.charAt(0) || 'A'}</div>
              <div>
                <strong>{[profile?.nombre, profile?.apellido].filter(Boolean).join(' ') || 'Administrador'}</strong>
                <span>{profile?.correo}</span>
              </div>
            </button>
          </div>
        </header>

        <main className="content" aria-live="polite">
          <section className="hero-panel">
            <div>
              <p className="eyebrow">Resumen operativo</p>
              <h2>Control central del acueducto</h2>
            </div>
            <div className="hero-actions">
              {quickActions.map(({ label, section, icon: Icon }) => (
                <button key={label} type="button" className="secondary-button" onClick={() => handleNavigate(section)}>
                  <Icon size={16} />
                  {label}
                </button>
              ))}
            </div>
          </section>

          {actionMessage && <p className="action-feedback" role="status">{actionMessage}</p>}
          {actionError && <p className="auth-error" role="alert">{actionError}</p>}
          {sectionMap[activeSection]}
        </main>
      </div>
      {profileOpen && (
        <div className="modal-backdrop">
          <section className="modal-panel profile-modal-panel" role="dialog" aria-modal="true" aria-labelledby="profile-title">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Cuenta de administrador</p>
                <h2 id="profile-title">Mi perfil</h2>
              </div>
              <button type="button" className="soft-button" onClick={() => setProfileOpen(false)}>Cerrar</button>
            </div>

            <form className="profile-form" onSubmit={handleSaveProfile}>
              <h3 className="form-section-title"><UserRound size={17} /> Datos personales</h3>
              <label>Nombre<input value={profileForm.nombre || ''} onChange={(event) => setProfileForm({ ...profileForm, nombre: event.target.value })} required /></label>
              <label>Apellido<input value={profileForm.apellido || ''} onChange={(event) => setProfileForm({ ...profileForm, apellido: event.target.value })} required /></label>
              <label className="form-wide">Correo electrónico<input value={profile?.correo || ''} readOnly /></label>
              <label>Teléfono<input type="tel" value={profileForm.telefono || ''} onChange={(event) => setProfileForm({ ...profileForm, telefono: event.target.value })} /></label>
              <label>Número de lote<input value={profileForm.numero_lote || ''} onChange={(event) => setProfileForm({ ...profileForm, numero_lote: event.target.value })} /></label>
              <label className="form-wide">Dirección<input value={profileForm.direccion || ''} onChange={(event) => setProfileForm({ ...profileForm, direccion: event.target.value })} /></label>
              <label>Ocupación<input value={profileForm.ocupacion || ''} onChange={(event) => setProfileForm({ ...profileForm, ocupacion: event.target.value })} /></label>
              <label>Zona<input value={profileForm.zona || ''} onChange={(event) => setProfileForm({ ...profileForm, zona: event.target.value })} /></label>
              {profileError && <p className="auth-error form-wide" role="alert">{profileError}</p>}
              {profileMessage && <p className="auth-notice form-wide" role="status">{profileMessage}</p>}
              <button type="submit" className="primary-button form-wide" disabled={isSavingProfile}>
                {isSavingProfile ? 'Guardando...' : 'Guardar perfil'}
              </button>
            </form>

            <form className="profile-form profile-password-form" onSubmit={handleChangeProfilePassword}>
              <h3 className="form-section-title"><KeyRound size={17} /> Cambiar contraseña</h3>
              <label className="form-wide">Contraseña actual
                <input type="password" autoComplete="current-password" value={currentProfilePassword} onChange={(event) => setCurrentProfilePassword(event.target.value)} required />
              </label>
              <label>Nueva contraseña
                <input type="password" autoComplete="new-password" minLength={8} value={newProfilePassword} onChange={(event) => setNewProfilePassword(event.target.value)} required />
              </label>
              <label>Confirmar contraseña
                <input type="password" autoComplete="new-password" minLength={8} value={confirmProfilePassword} onChange={(event) => setConfirmProfilePassword(event.target.value)} required />
              </label>
              <p className="form-hint form-wide">La contraseña debe tener al menos 8 caracteres.</p>
              {passwordError && <p className="auth-error form-wide" role="alert">{passwordError}</p>}
              {passwordMessage && <p className="auth-notice form-wide" role="status">{passwordMessage}</p>}
              <button type="submit" className="primary-button form-wide" disabled={isChangingProfilePassword}>
                {isChangingProfilePassword ? 'Actualizando...' : 'Cambiar contraseña'}
              </button>
            </form>
          </section>
        </div>
      )}
      {createUserOpen && (
        <div className="modal-backdrop">
          <section className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="create-user-title">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Gestión de usuarios</p>
                <h2 id="create-user-title">Nuevo usuario</h2>
              </div>
              <button type="button" className="soft-button" onClick={() => setCreateUserOpen(false)}>Cerrar</button>
            </div>
            {createdTemporaryPassword ? (
              <div className="created-user-result" role="status">
                <CheckCircle2 size={22} />
                <div>
                  <strong>Usuario creado</strong>
                  <p>La contraseña temporal también fue enviada al correo registrado.</p>
                  <code>{createdTemporaryPassword}</code>
                </div>
              </div>
            ) : (
              <form className="create-user-form" onSubmit={handleCreateUser}>
                <label>Nombre<input value={newUser.nombre} onChange={(event) => setNewUser({ ...newUser, nombre: event.target.value })} required /></label>
                <label>Apellido<input value={newUser.apellido} onChange={(event) => setNewUser({ ...newUser, apellido: event.target.value })} required /></label>
                <label className="form-wide">Correo electrónico<input type="email" autoComplete="email" value={newUser.correo} onChange={(event) => setNewUser({ ...newUser, correo: event.target.value })} required /></label>
                <label className="form-wide">Rol
                  <select value={newUser.rol} onChange={(event) => setNewUser({ ...newUser, rol: event.target.value })}>
                    <option value="usuario">Usuario</option>
                    <option value="fontanero">Fontanero</option>
                    <option value="administrador">Administrador</option>
                  </select>
                </label>
                {createUserError && <p className="auth-error form-wide" role="alert">{createUserError}</p>}
                <button type="submit" className="primary-button form-wide" disabled={isCreatingUser}>
                  {isCreatingUser ? 'Creando...' : 'Crear usuario'}
                </button>
              </form>
            )}
          </section>
        </div>
      )}
      {bulkUserOpen && (
        <div className="modal-backdrop">
          <section className="modal-panel bulk-modal-panel" role="dialog" aria-modal="true" aria-labelledby="bulk-users-title">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Gestión de usuarios</p>
                <h2 id="bulk-users-title">Carga masiva de usuarios</h2>
              </div>
              <button type="button" className="soft-button" onClick={() => setBulkUserOpen(false)} disabled={isImportingUsers}>Cerrar</button>
            </div>
            <p className="bulk-help">
              Sube un archivo CSV UTF-8 o Excel (.xlsx) con las columnas <strong>nombre, apellido, correo</strong> y, opcionalmente, <strong>rol</strong>.
              Si omites el rol, se asignará “usuario”. Máximo {MAX_BULK_USERS} usuarios y 5 MB por archivo.
            </p>
            <button type="button" className="link-button bulk-template-button" onClick={handleDownloadUsersTemplate}>
              <Download size={16} />
              Descargar plantilla CSV
            </button>
            <form className="bulk-user-form" onSubmit={handleBulkUserImport}>
              <label className="bulk-file-input">
                Archivo CSV o Excel
                <input type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={handleBulkFileChange} disabled={isImportingUsers} />
              </label>
              {bulkUserError && <p className="auth-error form-wide" role="alert">{bulkUserError}</p>}
              {bulkUsers.length > 0 && (
                <>
                  <p className="bulk-summary form-wide" role="status">
                    {bulkUsers.filter((user) => !user.error).length} válidos · {bulkUsers.filter((user) => user.error).length} con errores
                  </p>
                  {isImportingUsers && (
                    <p className="bulk-progress form-wide" role="status">
                      Procesando {bulkProgress.completed} de {bulkProgress.total} usuarios...
                    </p>
                  )}
                  {bulkUserResults.length > 0 && (
                    <>
                      {!isImportingUsers && (
                        <>
                          <p className="bulk-summary form-wide" role="status">
                            {bulkUserResults.filter((user) => user.status === 'success').length} cuentas creadas · {bulkUserResults.filter((user) => user.status === 'error').length} con errores
                          </p>
                          {bulkUserResults.some((user) => user.status === 'error') && (
                            <button type="button" className="secondary-button form-wide" onClick={handleDownloadBulkErrors}>
                              <Download size={16} />
                              Descargar filas con errores (CSV)
                            </button>
                          )}
                        </>
                      )}
                      <div className="table-wrap bulk-results form-wide">
                        <table>
                          <thead>
                            <tr><th>Fila</th><th>Usuario</th><th>Correo</th><th>Resultado</th></tr>
                          </thead>
                          <tbody>
                            {bulkUserResults.map((user) => (
                              <tr key={user.line}>
                                <td>{user.line}</td>
                                <td>{[user.nombre, user.apellido].filter(Boolean).join(' ') || '—'}</td>
                                <td>{user.correo || '—'}</td>
                                <td className={user.status === 'success' ? 'bulk-success' : user.status === 'error' ? 'error-text' : ''}>
                                  {user.message}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </>
              )}
              <button
                type="submit"
                className="primary-button form-wide"
                disabled={isImportingUsers || bulkUserResults.length > 0 || !bulkUsers.some((user) => !user.error)}
              >
                {isImportingUsers ? 'Importando...' : bulkUserResults.length > 0 ? 'Importación finalizada' : `Crear ${bulkUsers.filter((user) => !user.error).length} usuarios`}
              </button>
            </form>
          </section>
        </div>
      )}
      {operationType && (
        <div className="modal-backdrop">
          <section className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="operation-title">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Administración</p>
                <h2 id="operation-title">{operationDefinitions[operationType].title}</h2>
              </div>
              <button type="button" className="soft-button" onClick={() => setOperationType('')}>Cerrar</button>
            </div>
            <form className="create-user-form" onSubmit={handleOperationSubmit}>
              {operationDefinitions[operationType].fields.map((field) => (
                <label key={field.name} className={field.type === 'textarea' ? 'form-wide' : ''}>
                  {field.label}
                  {field.type === 'textarea' ? (
                    <textarea value={operationForm[field.name] ?? ''} onChange={(event) => setOperationForm({ ...operationForm, [field.name]: event.target.value })} required={field.required} rows={4} />
                  ) : field.type === 'user' || field.type === 'recipient' ? (
                    <select value={operationForm[field.name] ?? ''} onChange={(event) => setOperationForm({ ...operationForm, [field.name]: event.target.value })} required={field.required}>
                      {field.type === 'recipient' && <option value="todos">Todos los usuarios activos</option>}
                      {field.type === 'user' && <option value="">Selecciona un usuario</option>}
                      {users.map((user) => <option key={user.id} value={user.id}>{[user.nombre, user.apellido].filter(Boolean).join(' ')} · {user.correo}</option>)}
                    </select>
                  ) : field.type === 'select' ? (
                    <select value={operationForm[field.name] ?? ''} onChange={(event) => setOperationForm({ ...operationForm, [field.name]: event.target.value })} required={field.required}>
                      {field.options.map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                  ) : (
                    <input type={field.type || 'text'} min={field.type === 'number' ? '0' : undefined} step={field.type === 'number' ? 'any' : undefined} value={operationForm[field.name] ?? ''} onChange={(event) => setOperationForm({ ...operationForm, [field.name]: event.target.value })} required={field.required} />
                  )}
                </label>
              ))}
              {operationError && <p className="auth-error form-wide" role="alert">{operationError}</p>}
              <button type="submit" className="primary-button form-wide" disabled={operationPending}>
                {operationPending
                  ? operationType === 'facturacionMensual' ? 'Generando...' : 'Guardando...'
                  : operationType === 'facturacionMensual' ? 'Generar facturas' : 'Guardar'}
              </button>
            </form>
          </section>
        </div>
      )}
      {invoicePreview && (() => {
        const invoiceUser = users.find((user) => user.id === invoicePreview.perfil_id)
        const invoiceUserName = [invoiceUser?.nombre, invoiceUser?.apellido].filter(Boolean).join(' ') || 'Suscriptor'
        return (
          <div className="modal-backdrop">
            <section className="modal-panel invoice-modal-panel" role="dialog" aria-modal="true" aria-labelledby="invoice-preview-title">
              <div className="panel-header invoice-preview-actions">
                <div>
                  <p className="eyebrow">Documento de cobro</p>
                  <h2 id="invoice-preview-title">Vista previa de factura</h2>
                </div>
                <div className="hero-actions">
                  <button type="button" className="primary-button invoice-download-button" onClick={handleDownloadInvoice}><Printer size={16} />Descargar PDF</button>
                  <button type="button" className="soft-button invoice-close-button" onClick={() => setInvoicePreview(null)}>Cerrar</button>
                </div>
              </div>
              <article className="invoice-sheet" id="invoice-document">
                <div className="invoice-watermark" aria-hidden="true">
                  <img src={hidroAppLogo} alt="" />
                </div>
                <header className="invoice-heading">
                  <div className="invoice-heading-brand">
                    <span className="invoice-logo-frame"><img className="invoice-logo" src={hidroAppLogo} alt="" /></span>
                    <div>
                      <span className="invoice-brand">HidroApp · Acueducto Campo Amor</span>
                      <h2>{invoicePreview.tipo === 'extraordinaria' ? 'Factura extraordinaria' : 'Factura de servicio'}</h2>
                    </div>
                  </div>
                  <div className="invoice-number">
                    <span>Factura</span>
                    <strong>{formatInvoiceNumber(invoicePreview)}</strong>
                  </div>
                </header>
                <div className="invoice-meta">
                  <div><span>Periodo facturado</span><strong>{invoicePreview.periodo || '—'}</strong></div>
                  <div><span>Estado</span><strong>{invoicePreview.estado || '—'}</strong></div>
                  <div><span>Fecha de emisión</span><strong>{formatDate(invoicePreview.fecha_emision)}</strong></div>
                  <div><span>Fecha límite de pago</span><strong>{formatDate(invoicePreview.fecha_vencimiento)}</strong></div>
                </div>
                <div className="invoice-party">
                  <span>Suscriptor</span>
                  <strong>{invoiceUserName}</strong>
                  <p>{invoiceUser?.correo || 'Correo no registrado'}</p>
                  {invoiceUser?.direccion && <p>{invoiceUser.direccion}</p>}
                  {invoiceUser?.zona && <p>Zona {invoiceUser.zona}</p>}
                  {invoiceUser?.numero_lote && <p>Lote {invoiceUser.numero_lote}</p>}
                </div>
                <table className="invoice-lines">
                  <thead><tr><th>Concepto</th><th>Periodo</th><th>Valor</th></tr></thead>
                  <tbody><tr>
                    <td>{invoicePreview.observacion || (invoicePreview.tipo === 'extraordinaria' ? 'Cuota extraordinaria' : 'Servicio de acueducto')}</td>
                    <td>{invoicePreview.periodo || '—'}</td>
                    <td>{formatMoney(invoicePreview.valor_total)}</td>
                  </tr></tbody>
                </table>
                <div className="invoice-total"><span>Total a pagar</span><strong>{formatMoney(invoicePreview.valor_total)}</strong></div>
                <p className="invoice-note">Conserve este documento como soporte de su facturación.</p>
              </article>
            </section>
          </div>
        )
      })()}
    </div>
  )
}

export default App
