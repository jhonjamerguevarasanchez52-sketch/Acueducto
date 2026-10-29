import { useEffect, useState } from 'react'
import {
  AlertTriangle,
  ArrowUpRight,
  BellRing,
  CheckCircle2,
  CreditCard,
  Download,
  FileText,
  KeyRound,
  Menu,
  Printer,
  Search,
  UserRound,
  UserRoundPlus,
} from 'lucide-react'
import Sidebar from './components/Sidebar.jsx'
import AuthScreen from './features/auth/AuthScreen.jsx'
import exportTreasuryWorkbookFile from './features/reports/exportTreasuryWorkbook.js'
import SectionViews from './features/sections/SectionViews.jsx'
import { quickActions, resourceEndpointBySection, MAX_BULK_USERS, MAX_USER_FILE_SIZE_BYTES, operationDefinitions, roleColors } from './config/adminConfig.js'
import { apiRequest, clearToken, endpoints, getToken, login } from './services/api.js'
import { formatMoney, formatDate, formatInvoiceNumber } from './utils/formatters.js'
import { parseUsersCsv, parseUsersExcel } from './utils/usersCsv.js'
import hidroAppLogo from './assets/hidroapp-logo.png'

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
  const [createdUserEmailSent, setCreatedUserEmailSent] = useState(false)
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
  const now = new Date()
  const [reportFrom, setReportFrom] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`)
  const [reportTo, setReportTo] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`)

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
    if (section === 'reportes') {
      void Promise.all(['usuarios', 'facturas', 'pagos'].map((name) => loadSection(name)))
    }
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
      setCreatedUserEmailSent(result.correoEnviado === true)
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
        result = {
          ...user,
          status: response.correoEnviado === false ? 'warning' : 'success',
          message: response.correoEnviado === false
            ? `${response.message || 'Cuenta creada, pero el correo falló.'} Contraseña temporal: ${response.passwordTemporal || 'no disponible'}`
            : response.message || 'Cuenta creada.',
        }
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
    setCreatedUserEmailSent(false)
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
    if (operationType === 'facturaExtraordinaria' && operationForm.perfil_ids === 'todos') {
      const cantidad = users.filter((user) => user.activo && user.rol === 'usuario').length
      const total = cantidad * Number(operationForm.valor_total || 0)
      const confirmar = window.confirm(
        `Se generarÃ¡ una factura extraordinaria por ${formatMoney(operationForm.valor_total)} a cada uno de los ${cantidad} usuarios activos. Total: ${formatMoney(total)}. Concepto: ${operationForm.concepto}. Â¿Continuar?`,
      )
      if (!confirmar) return
    }
    const body = Object.fromEntries(definition.fields
      .filter((field) => field.type !== 'recipient' && operationForm[field.name] !== '')
      .map((field) => [
        field.name,
        field.type === 'number' ? Number(operationForm[field.name]) : operationForm[field.name],
      ]))
    if (operationType === 'facturaExtraordinaria' && operationForm.perfil_ids !== 'todos') {
      body.perfil_ids = [operationForm.perfil_ids]
    }
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
      const resumenCorreo = result.correos_enviados === undefined
        ? ''
        : ` Correos enviados: ${result.correos_enviados}; fallidos: ${result.correos_fallidos}.`
      setActionMessage(`${result.message || 'Cambios guardados.'}${resumenCorreo}`)
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
      const adminCheck = await apiRequest(endpoints.verifyAdminEmail, { method: 'POST', body: { correo: email } })
      if (!adminCheck.esAdministrador) throw new Error('Este correo no está registrado en la base de datos.')
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

  const checkAdminEmail = async () => {
    const normalizedEmail = email.trim().toLowerCase()
    if (!normalizedEmail) {
      setAuthError('Ingresa el correo de un administrador.')
      return false
    }
    try {
      await apiRequest(endpoints.verifyAdminEmail, { method: 'POST', body: { correo: normalizedEmail } })
      setAuthError('')
      return true
    } catch (error) {
      setAuthError(error.message || 'Este correo no está registrado en la base de datos.')
      return false
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
    if (authMode === 'reset' && !/^\d{6}$/.test(recoveryCode.trim())) {
      setAuthError('Ingresa el código de 6 dígitos que recibiste por correo.')
      return
    }
    if (authMode === 'reset' && newPassword.length < 8) {
      setAuthError('La contraseña debe tener al menos 8 caracteres.')
      return
    }

    setIsLoggingIn(true)
    try {
      const correo = email.trim().toLowerCase()
      if (authMode === 'request-reset') {
        const result = await apiRequest(endpoints.requestPasswordReset, {
          method: 'POST',
          body: { correo },
        })
        setAuthMode('reset')
        setAuthNotice(result.message || 'Si el correo existe, recibirás un código de recuperación.')
      } else {
        const result = await apiRequest(endpoints.resetPassword, {
          method: 'POST',
          body: { correo, codigo: recoveryCode.trim(), nuevaPassword: newPassword },
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

  const users = sectionData.usuarios || []
  const invoices = sectionData.facturas || []
  const payments = sectionData.pagos || []
  const cuts = sectionData.cortes || []
  const confirmedPayments = payments.filter((payment) => payment.confirmado)
  const inReportRange = (value) => {
    if (!value) return false
    const day = String(value).slice(0, 10)
    return (!reportFrom || day >= reportFrom) && (!reportTo || day <= reportTo)
  }
  const reportPayments = payments.filter((payment) => inReportRange(payment.fecha_pago))
  const reportInvoices = invoices.filter((invoice) => inReportRange(invoice.fecha_emision))
  const reportConfirmedPayments = reportPayments.filter((payment) => payment.confirmado)
  const reportRevenue = reportConfirmedPayments.reduce((sum, payment) => sum + Number(payment.monto || 0), 0)
  const reportPendingRevenue = reportPayments.filter((payment) => !payment.confirmado)
    .reduce((sum, payment) => sum + Number(payment.monto || 0), 0)
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
  const sectionTitles = {
    dashboard: 'HIDRO-APP',
    usuarios: 'Usuarios',
    facturas: 'Facturación',
    pagos: 'Pagos',
    cortes: 'Cortes y reconexiones',
    notificaciones: 'Notificaciones',
    tarifas: 'Tarifas',
    reportes: 'Reportes',
  }
  const currentSectionTitle = sectionTitles[activeSection] || 'HIDRO-APP'

  if (sessionStatus === 'checking') {
    return <main className="auth-shell"><p className="auth-loading">Verificando sesión...</p></main>
  }

  if (sessionStatus !== 'authenticated') {
    return (
      <AuthScreen
        authMode={authMode}
        setAuthMode={setAuthMode}
        email={email}
        setEmail={setEmail}
        password={password}
        setPassword={setPassword}
        recoveryCode={recoveryCode}
        setRecoveryCode={setRecoveryCode}
        newPassword={newPassword}
        setNewPassword={setNewPassword}
        confirmNewPassword={confirmNewPassword}
        setConfirmNewPassword={setConfirmNewPassword}
        authNotice={authNotice}
        setAuthNotice={setAuthNotice}
        authError={authError}
        setAuthError={setAuthError}
        isLoggingIn={isLoggingIn}
        onLogin={handleLogin}
        onRecoverySubmit={handleRecoverySubmit}
        onCheckAdminEmail={checkAdminEmail}
      />
    )
  }
  const exportTreasuryWorkbook = (report = 'todos') => exportTreasuryWorkbookFile({
    report,
    sectionData,
    users,
    invoices,
    reportPayments,
    reportInvoices,
    reportConfirmedPayments,
    reportRevenue,
    reportPendingRevenue,
    reportFrom,
    reportTo,
    setActionError,
    setActionMessage,
  })
  const sectionContext = {
    sectionData,
    sectionErrors,
    loadingSections,
    filterRows,
    profile,
    endpoints,
    handleNavigate,
    openBulkUserImport,
    openCreateUser,
    openOperation,
    performAction,
    openInvoicePreview,
    exportTreasuryWorkbook,
    formatInvoiceNumber,
    formatMoney,
    formatDate,
    users,
    invoices,
    payments,
    confirmedPayments,
    activeUsers,
    activeCuts,
    reportPayments,
    reportInvoices,
    reportConfirmedPayments,
    reportRevenue,
    reportPendingRevenue,
    reportFrom,
    setReportFrom,
    reportTo,
    setReportTo,
    dashboardKpis,
    revenueTrend,
    serviceMix,
    recentUsers,
    reportSummary,
    metricValue,
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
              <p className="eyebrow">Panel administrativo · Acueducto Campoamor</p>
              <h1>{currentSectionTitle}</h1>
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
              <p className="eyebrow">{activeSection === 'dashboard' ? 'Resumen operativo' : `Gestión de ${currentSectionTitle.toLocaleLowerCase('es')}`}</p>
              <h2>{activeSection === 'dashboard' ? 'Control central del acueducto' : currentSectionTitle}</h2>
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
          <SectionViews activeSection={activeSection} context={sectionContext} />
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
                  <p>{createdUserEmailSent
                    ? 'Enviamos al correo registrado la contraseña temporal y el código para verificar la cuenta.'
                    : 'No se pudo enviar el correo. Comparte la contraseña temporal; el usuario podrá solicitar un nuevo código desde la pantalla de acceso.'}</p>
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
              Si omites el rol, se asignará “usuario�?. Máximo {MAX_BULK_USERS} usuarios y 5 MB por archivo.
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
                            {bulkUserResults.filter((user) => ['success', 'warning'].includes(user.status)).length} cuentas creadas · {bulkUserResults.filter((user) => user.status === 'warning').length} con correo fallido · {bulkUserResults.filter((user) => user.status === 'error').length} con errores
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
                                <td className={user.status === 'success' ? 'bulk-success' : user.status === 'warning' ? 'bulk-warning' : user.status === 'error' ? 'error-text' : ''}>
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
                <label key={field.name} className={field.type === 'textarea' || field.type === 'checkbox' ? 'form-wide' : ''}>
                  {field.label}
                  {field.type === 'checkbox' ? (
                    <input type="checkbox" checked={Boolean(operationForm[field.name])} onChange={(event) => setOperationForm({ ...operationForm, [field.name]: event.target.checked })} />
                  ) : field.type === 'textarea' ? (
                    <textarea value={operationForm[field.name] ?? ''} onChange={(event) => setOperationForm({ ...operationForm, [field.name]: event.target.value })} required={field.required} rows={4} />
                  ) : field.type === 'user' || field.type === 'recipient' ? (
                    <select value={operationForm[field.name] ?? ''} onChange={(event) => setOperationForm({ ...operationForm, [field.name]: event.target.value })} required={field.required}>
                      {field.type === 'recipient' && <option value="todos">{operationType === 'notificacion' ? 'Todos los usuarios registrados' : 'Todos los usuarios activos'}</option>}
                      {field.type === 'user' && <option value="">Selecciona un usuario</option>}
                      {users.filter((user) => field.type !== 'recipient' || operationType !== 'facturaExtraordinaria' || (user.rol === 'usuario' && user.activo)).map((user) => <option key={user.id} value={user.id}>{[user.nombre, user.apellido].filter(Boolean).join(' ')} - {user.correo} ({user.rol})</option>)}
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
