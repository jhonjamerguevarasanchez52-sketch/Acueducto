import { lazy, Suspense, useState } from 'react'
import { apiRequest } from '../../services/api.js'
import {
  Banknote,
  BellRing,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Download,
  Eye,
  Megaphone,
  Plus,
  ShieldCheck,
  Trash2,
  TrendingUp,
  Upload,
} from 'lucide-react'
import StatCard from '../../components/StatCard.jsx'
import { formatDateTime } from '../../utils/formatters.js'
import { accionesPago, estadoPago } from '../../utils/pagos.js'

// Las gráficas (recharts) se cargan bajo demanda para que el panel abra más rápido.
const AnalyticsCharts = lazy(() => import('../../components/AnalyticsCharts.jsx'))

export default function SectionViews({ activeSection, context }) {
  const [pazSeleccionados, setPazSeleccionados] = useState([])
  const [pazEnviarCorreo, setPazEnviarCorreo] = useState(false)
  const [pazOcupado, setPazOcupado] = useState(false)
  const [pazMensaje, setPazMensaje] = useState('')
  const [pazError, setPazError] = useState('')
  const {
    sectionData,
    sectionErrors,
    loadingSections,
    loadSection,
    filterRows,
    profile,
    endpoints,
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
    handleNavigate,
    confirmedPayments,
    activeUsers,
    activeCuts,
    reportInvoices,
    reportConfirmedPayments,
    reportPendingPayments,
    pendingPayments,
    reportRevenue,
    reportPendingRevenue,
    reportFrom,
    setReportFrom,
    reportTo,
    setReportTo,
    applyReportPreset,
    dashboardKpis,
    revenueTrend,
    serviceMix,
    recentUsers,
    reportSummary,
    metricValue,
  } = context

  const descargarPdfBase64 = (pdfBase64, filename) => {
    if (!pdfBase64) return
    const bytes = Uint8Array.from(atob(pdfBase64), (character) => character.charCodeAt(0))
    const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }))
    const link = document.createElement('a')
    link.href = url
    link.download = filename || 'paz-y-salvo.pdf'
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const emitirPazYSalvo = async (profileIds, enviarCorreo = pazEnviarCorreo) => {
    if (!profileIds.length) return
    setPazOcupado(true)
    setPazError('')
    setPazMensaje('')
    try {
      const result = await apiRequest(endpoints.pazYSalvo, {
        method: 'POST',
        body: { perfil_ids: profileIds, enviar_correo: enviarCorreo },
      })
      const omitidos = (result.resultados || []).filter((item) => item.estado === 'no_emitido')
      setPazMensaje(`${result.emitidos} certificado(s) generado(s); ${omitidos.length} perfil(es) omitido(s) por saldo pendiente.${enviarCorreo ? ' Se intentó el envío por correo.' : ''}`)
      setPazSeleccionados([])
      descargarPdfBase64(result.pdfBase64, result.filename)
      await Promise.all([loadSection('paz-y-salvo'), loadSection('usuarios')])
      if (omitidos.length) {
        setPazError(omitidos.map((item) => `${item.nombre}: saldo ${formatMoney(item.saldo_pendiente)}`).join(' · '))
      }
    } catch (error) {
      setPazError(error.message || 'No fue posible generar los paz y salvo.')
    } finally {
      setPazOcupado(false)
    }
  }

  const descargarPazYSalvoGuardado = async (id) => {
    try {
      const result = await apiRequest(`${endpoints.pazYSalvo}/${id}/descargar`)
      descargarPdfBase64(result.pdfBase64, result.filename)
    } catch (error) {
      setPazError(error.message || 'No fue posible descargar el certificado.')
    }
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
            <button type="button" className="soft-button" onClick={() => exportTreasuryWorkbook('pagos')}>
              <Download size={16} />
              Excel
            </button>
          </div>

          <div className="chart-wrap">
            <Suspense fallback={<div className="chart-loading" role="status">Cargando gráfica...</div>}>
              <AnalyticsCharts kind="area" data={revenueTrend} />
            </Suspense>
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
            <Suspense fallback={<div className="chart-loading" role="status">Cargando gráfica...</div>}>
              <AnalyticsCharts kind="pie" data={serviceMix} />
            </Suspense>
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
              <th>Cédula</th>
              <th>Rol</th>
              <th>Estado</th>
              <th>Estado de cuenta</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {sectionErrors.usuarios ? (
              <tr><td colSpan="6" className="table-message error-text">{sectionErrors.usuarios}</td></tr>
            ) : loadingSections.usuarios ? (
              <tr><td colSpan="6" className="table-message">Cargando usuarios...</td></tr>
            ) : filterRows(sectionData.usuarios || []).length === 0 ? (
              <tr><td colSpan="6" className="table-message">No hay resultados.</td></tr>
            ) : filterRows(sectionData.usuarios).map((user) => (
              <tr key={user.id}>
                <td>{[user.nombre, user.apellido].filter(Boolean).join(' ') || 'Sin nombre'}</td>
                <td>{user.correo || '—'}</td>
                <td>{user.cedula || '—'}</td>
                <td>{user.rol || '—'}</td>
                <td><span className={`status-badge ${user.activo ? 'activo' : 'inactivo'}`}>{user.activo ? 'Activo' : 'Inactivo'}</span></td>
                <td><span className={`status-badge ${user.estado_cuenta === 'al_dia' ? 'activo' : 'inactivo'}`}>{user.estado_cuenta === 'al_dia' ? 'Al día' : `Pendiente · ${formatMoney(user.saldo_pendiente || 0)}`}</span></td>
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

                    <button type="button" className="link-button danger-link" onClick={() => {
                      const nota = user.rol === 'fontanero' ? window.prompt('Escribe la nota requerida para archivar la salida del fontanero:') : undefined
                      if (user.rol === 'fontanero' && !nota?.trim()) return
                      void performAction('usuarios', `${endpoints.adminUsers}/${user.id}`, 'DELETE', { nota }, 'Se archivará el historial, se notificará el correo del perfil y luego se eliminará la cuenta. ¿Continuar?')
                    }}><Trash2 size={14} />Eliminar</button>

                    <button type="button" className="link-button danger-link" onClick={() => performAction('usuarios', `${endpoints.adminUsers}/${user.id}`, 'DELETE', undefined, 'Solo se pueden eliminar cuentas sin facturas ni pagos (por ejemplo, creadas por error). Si tiene historial, te ofreceremos desactivarla. ¿Continuar?')}><Trash2 size={14} />Eliminar</button>

                  </>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )

  const downloadDeletedUsers = () => {
    const rows = sectionData.eliminados || []
    const headers = ['Nombre', 'Correo', 'Rol', 'Eliminado el', 'Tipo de eliminacion', 'Actor', 'Nota de salida', 'Total pendiente', 'Facturas pendientes', 'Estado del correo', 'Historial completo']
    const cell = (value) => {
      const text = typeof value === 'string' ? value : JSON.stringify(value ?? '')
      const safe = /^[=+\-@]/.test(text) ? `'${text}` : text
      return `"${safe.replaceAll('"', '""')}"`
    }
    const lines = [headers, ...rows.map((row) => [
      row.full_name, row.email, row.role, row.deleted_at || row.requested_at,
      row.deletion_type, row.deleted_by_snapshot, row.exit_note,
      row.pending_total, row.pending_invoices, row.email_status, row.history_snapshot,
    ])].map((row) => row.map(cell).join(',')).join('\r\n')
    const link = document.createElement('a')
    link.href = URL.createObjectURL(new Blob(['\uFEFF', lines], { type: 'text/csv;charset=utf-8' }))
    link.download = `perfiles-eliminados-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(link.href)
  }

  const downloadDeletedUsersJson = () => {
    const link = document.createElement('a')
    link.href = URL.createObjectURL(new Blob([JSON.stringify(sectionData.eliminados || [], null, 2)], { type: 'application/json;charset=utf-8' }))
    link.download = `historial-perfiles-eliminados-${new Date().toISOString().slice(0, 10)}.json`
    link.click()
    URL.revokeObjectURL(link.href)
  }

  const renderDeletedUsers = () => {
    const rows = sectionData.eliminados || []
    return <div className="panel">
      <div className="panel-header">
        <div><p className="eyebrow">Archivo e historial</p><h3>Perfiles eliminados</h3></div>
        <div className="hero-actions">
          <button type="button" className="secondary-button" onClick={downloadDeletedUsers} disabled={!rows.length}><Download size={16} />Resumen CSV</button>
          <button type="button" className="secondary-button" onClick={downloadDeletedUsersJson} disabled={!rows.length}><Download size={16} />Historial completo JSON</button>
        </div>
      </div>
      <div className="table-wrap"><table><thead><tr><th>Perfil</th><th>Rol</th><th>Eliminado por</th><th>Fecha</th><th>Saldo pendiente</th><th>Correo</th></tr></thead>
        <tbody>
          {sectionErrors.eliminados ? <tr><td colSpan="6" className="table-message error-text">{sectionErrors.eliminados}</td></tr>
            : loadingSections.eliminados ? <tr><td colSpan="6" className="table-message">Cargando historial...</td></tr>
              : rows.length === 0 ? <tr><td colSpan="6" className="table-message">Aún no hay perfiles eliminados.</td></tr>
                : rows.map((row) => <tr key={row.id}>
                  <td>{row.full_name}<small>{row.email}</small></td><td>{row.role}</td>
                  <td>{row.deletion_type === 'administrador' ? `Administrador: ${row.deleted_by_snapshot?.nombre || row.deleted_by_snapshot?.correo || 'registrado'}` : 'El propio perfil'}</td>
                  <td>{formatDate(row.deleted_at || row.requested_at)}</td>
                  <td>{formatMoney(row.pending_total || 0)}<small>{row.pending_invoices?.length || 0} facturas</small></td>
                  <td>{row.email_status === 'sent' ? 'Enviado' : row.email_status === 'failed' ? <><span>Falló</span><button type="button" className="link-button" onClick={() => performAction('eliminados', `${endpoints.deletedUsers}/${row.id}/reintentar-correo`, 'POST', {})}>Reintentar</button></> : 'Pendiente'}</td>
                </tr>)}
        </tbody>
      </table></div>
      <p className="table-message">El CSV incluye facturas pendientes, averías, pagos y acciones administrativas archivadas.</p>
    </div>
  }

  const renderPazYSalvo = () => {
    const alDia = users.filter((user) => user.estado_cuenta === 'al_dia')
    const certificados = sectionData['paz-y-salvo'] || []
    const alternarSeleccion = (id) => setPazSeleccionados((actual) => (
      actual.includes(id) ? actual.filter((value) => value !== id) : [...actual, id]
    ))
    return <div className="content-grid">
      <section className="panel">
        <div className="panel-header">
          <div><p className="eyebrow">Constancias financieras</p><h3>Generar paz y salvo</h3></div>
          <div className="hero-actions">
            <label className="checkbox-label"><input type="checkbox" checked={pazEnviarCorreo} onChange={(event) => setPazEnviarCorreo(event.target.checked)} />Enviar por correo</label>
            <button type="button" className="primary-button" disabled={!pazSeleccionados.length || pazOcupado} onClick={() => emitirPazYSalvo(pazSeleccionados)}>
              <Download size={16} />{pazOcupado ? 'Generando...' : `Generar ${pazSeleccionados.length} seleccionado(s)`}
            </button>
          </div>
        </div>
        <p className="report-caption">Solo se expiden certificados a perfiles sin facturas pendientes ni vencidas. Puedes seleccionar uno o varios perfiles; el PDF se descargará y, si activas el envío, cada persona recibirá su certificado adjunto.</p>
        {pazMensaje && <p className="action-feedback" role="status">{pazMensaje}</p>}
        {pazError && <p className="auth-error" role="alert">{pazError}</p>}
        <div className="table-wrap"><table><thead><tr><th><input type="checkbox" aria-label="Seleccionar todos los perfiles al día" checked={alDia.length > 0 && alDia.every((user) => pazSeleccionados.includes(user.id))} disabled={!alDia.length || pazOcupado} onChange={(event) => setPazSeleccionados(event.target.checked ? alDia.map((user) => user.id) : [])} /></th><th>Perfil</th><th>Rol</th><th>Estado de cuenta</th><th>Saldo</th><th>Acción</th></tr></thead>
          <tbody>
            {sectionErrors.usuarios ? <tr><td colSpan="6" className="table-message error-text">{sectionErrors.usuarios}</td></tr>
              : loadingSections.usuarios ? <tr><td colSpan="6" className="table-message">Cargando perfiles...</td></tr>
                : users.length === 0 ? <tr><td colSpan="6" className="table-message">No hay perfiles.</td></tr>
                  : users.map((user) => {
                    const estaAlDia = user.estado_cuenta === 'al_dia'
                    return <tr key={user.id}>
                      <td><input type="checkbox" aria-label={`Seleccionar ${user.correo}`} disabled={!estaAlDia || pazOcupado} checked={pazSeleccionados.includes(user.id)} onChange={() => alternarSeleccion(user.id)} /></td>
                      <td>{[user.nombre, user.apellido].filter(Boolean).join(' ')}<small>{user.correo}</small></td>
                      <td>{user.rol}</td>
                      <td><span className={`status-badge ${estaAlDia ? 'activo' : 'inactivo'}`}>{estaAlDia ? 'Al día' : 'Saldo pendiente'}</span></td>
                      <td>{formatMoney(user.saldo_pendiente || 0)}</td>
                      <td>{estaAlDia
                        ? <button type="button" className="link-button" disabled={pazOcupado} onClick={() => emitirPazYSalvo([user.id])}>Generar individual</button>
                        : <span>{user.facturas_pendientes?.length || 0} factura(s) pendiente(s)</span>}</td>
                    </tr>
                  })}
          </tbody>
        </table></div>
      </section>

      <section className="panel">
        <div className="panel-header"><div><p className="eyebrow">Registro de expedición</p><h3>Certificados generados</h3></div></div>
        <div className="table-wrap"><table><thead><tr><th>Número</th><th>Perfil</th><th>Expedido</th><th>Correo</th><th>PDF</th></tr></thead>
          <tbody>
            {sectionErrors['paz-y-salvo'] ? <tr><td colSpan="5" className="table-message error-text">{sectionErrors['paz-y-salvo']}</td></tr>
              : loadingSections['paz-y-salvo'] ? <tr><td colSpan="5" className="table-message">Cargando certificados...</td></tr>
                : certificados.length === 0 ? <tr><td colSpan="5" className="table-message">Aún no hay certificados emitidos.</td></tr>
                  : certificados.map((cert) => <tr key={cert.id}>
                    <td>{cert.certificate_number}</td>
                    <td>{[cert.profile_snapshot?.nombre, cert.profile_snapshot?.apellido].filter(Boolean).join(' ')}<small>{cert.profile_snapshot?.correo}</small></td>
                    <td>{formatDate(cert.generated_at)}</td>
                    <td>{cert.email_status === 'sent' ? 'Enviado' : cert.email_status === 'failed' ? <><span>Falló</span><button type="button" className="link-button" onClick={() => performAction('paz-y-salvo', `${endpoints.pazYSalvo}/${cert.id}/reintentar-correo`, 'POST', {})}>Reintentar</button></> : 'No solicitado'}</td>
                    <td><button type="button" className="link-button" onClick={() => descargarPazYSalvoGuardado(cert.id)}><Download size={14} />Descargar</button></td>
                  </tr>)}
          </tbody>
        </table></div>
      </section>
    </div>
  }

  const renderFacturas = () => (
    <div className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Facturación</p>
          <h3>Facturas y vencimientos</h3>
        </div>
        <div className="hero-actions">
          <button
            type="button"
            className="secondary-button"
            title="Factura el mes anterior (días 1 a 5), marca vencidas y envía recordatorios. Se ejecuta solo cada día a las 6 a. m."
            onClick={() => performAction('facturas', endpoints.tareasDiarias, 'POST', undefined, '¿Ejecutar ahora las tareas del día (facturación de los días 1 a 5, vencimientos y recordatorios)? Normalmente se ejecutan solas a las 6 a. m.')}
          >
            Ejecutar tareas del día
          </button>
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
                        {['pendiente', 'vencida'].includes(invoice.estado) && (
                          <button type="button" className="link-button" onClick={() => openOperation('registrarPago', invoice)}><Banknote size={14} />Registrar pago</button>
                        )}
                        {invoice.estado !== 'pagada' && (
                          <button type="button" className="link-button" onClick={() => openOperation('editarFactura', invoice)}>Editar</button>
                        )}
                        {invoice.estado !== 'pagada' && (
                          <button type="button" className="link-button danger-link" onClick={() => performAction('facturas', `${endpoints.facturas}/${invoice.id}`, 'DELETE', undefined, '¿Eliminar esta factura? Si ya tiene pagos, el sistema lo impedirá; anúlala en ese caso.')}>Eliminar</button>
                        )}
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
                      <td>
                        <span className={`payment-status payment-status-${estadoPago(payment).tono}`}>{estadoPago(payment).etiqueta}</span>
                        {payment.transaccion_id && <small className="payment-trx">Wompi {payment.transaccion_id}</small>}
                      </td>
                      <td className="row-actions">
                        {payment.recibo_url && <a className="link-button" href={payment.recibo_url} target="_blank" rel="noreferrer">Ver recibo</a>}
                        {accionesPago(payment).includes('confirmar') && (
                          <button type="button" className="link-button" onClick={() => performAction('pagos', `${endpoints.pago}/${payment.id}/confirmar`, 'PUT', undefined, `¿Confirmar el pago de ${formatMoney(payment.monto)}? Revisa antes que el recibo sea válido: la factura quedará pagada.`)}>Confirmar</button>
                        )}
                        {accionesPago(payment).includes('eliminar') && (
                          <button type="button" className="link-button danger-link" onClick={() => performAction('pagos', `${endpoints.pago}/${payment.id}`, 'DELETE', undefined, payment.metodo === 'wompi' ? '¿Quitar este intento rechazado de la lista?' : '¿Eliminar este recibo pendiente? El usuario podrá enviar otro.')}>Eliminar</button>
                        )}
                        {accionesPago(payment).includes('liberar') && (
                          <button type="button" className="link-button" onClick={() => performAction('pagos', `${endpoints.pago}/${payment.id}`, 'DELETE', undefined, '¿Liberar este checkout abandonado? Se conserva en el historial y, si el usuario llega a pagarlo, el pago se registra igual.')}>Liberar</button>
                        )}
                        {accionesPago(payment).includes('devolver') && (
                          <button type="button" className="link-button danger-link" onClick={() => performAction('pagos', `${endpoints.pago}/${payment.id}`, 'DELETE', { reembolsado: true }, `Wompi cobró ${formatMoney(payment.monto_total ?? payment.monto)} pero el pago no se aplicó a la factura. ¿Ya le devolviste el dinero al usuario desde el panel de Wompi?`)}>Marcar devuelto</button>
                        )}
                      </td>
                    </tr>
                  ))}
          </tbody>
        </table>
      </div>
    </div>
  )

  const renderCortesProgramados = () => (
    <div className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Servicio</p>
          <h3>Cortes programados por zona</h3>
        </div>
        <button type="button" className="primary-button" onClick={() => openOperation('corteProgramado')}><Megaphone size={16} />Anunciar corte</button>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Zona</th>
              <th>Motivo</th>
              <th>Inicia</th>
              <th>Termina</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {sectionErrors.cortesProgramados ? <tr><td colSpan="6" className="table-message error-text">{sectionErrors.cortesProgramados}</td></tr>
              : loadingSections.cortesProgramados ? <tr><td colSpan="6" className="table-message">Cargando cortes programados...</td></tr>
                : (sectionData.cortesProgramados || []).length === 0 ? <tr><td colSpan="6" className="table-message">No hay cortes programados próximos.</td></tr>
                  : sectionData.cortesProgramados.map((corte) => (
                    <tr key={corte.id}>
                      <td>{corte.zona || 'Todo el acueducto'}</td>
                      <td>{corte.motivo}</td>
                      <td>{formatDateTime(corte.inicio)}</td>
                      <td>{formatDateTime(corte.fin)}</td>
                      <td><span className={`status-badge ${corte.cancelado ? 'anulada' : 'pendiente'}`}>{corte.cancelado ? 'cancelado' : 'programado'}</span></td>
                      <td className="row-actions">
                        {!corte.cancelado && (
                          <button type="button" className="link-button danger-link" onClick={() => performAction('cortesProgramados', `${endpoints.cortesProgramados}/${corte.id}/cancelar`, 'PUT', undefined, '¿Cancelar este corte? Se avisará a los usuarios de la zona que el servicio sigue normal.')}>Cancelar</button>
                        )}
                      </td>
                    </tr>
                  ))}
          </tbody>
        </table>
      </div>
    </div>
  )

  const renderCortes = () => (
    <>
    {renderCortesProgramados()}
    <div className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Servicio</p>
          <h3>Suspensiones por usuario</h3>
        </div>
        <button type="button" className="primary-button" onClick={() => openOperation('corte')}><Plus size={16} />Suspender a un usuario</button>
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
    </>
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
      <section className="panel treasury-report-panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Tesorería</p>
            <h3>Informes financieros del acueducto</h3>
            <p className="report-caption">Consulta recaudos confirmados, pagos pendientes y facturación por periodo.</p>
          </div>
          <button type="button" className="primary-button" onClick={() => exportTreasuryWorkbook('todos')}>
            <Download size={16} /> Descargar informes Excel
          </button>
        </div>
        <div className="report-filters">
          <div className="report-presets" aria-label="Periodos rápidos">
            <button type="button" className="secondary-button" onClick={() => applyReportPreset('month')}>Mes actual</button>
            <button type="button" className="secondary-button" onClick={() => applyReportPreset('year')}>Año actual</button>
            <button type="button" className="secondary-button" onClick={() => applyReportPreset('semester')}>Semestre actual</button>
          </div>
          <label>Desde<input type="date" value={reportFrom} max={reportTo || undefined} onChange={(event) => setReportFrom(event.target.value)} /></label>
          <label>Hasta<input type="date" value={reportTo} min={reportFrom || undefined} onChange={(event) => setReportTo(event.target.value)} /></label>
          <span>Periodo aplicado a pagos y facturas emitidas</span>
        </div>
        <div className="treasury-kpis">
          <div><span>Ingresos recaudados</span><strong>{sectionErrors.pagos ? '—' : formatMoney(reportRevenue)}</strong><small>{reportConfirmedPayments.length} pagos confirmados</small></div>
          <div><span>Pagos pendientes</span><strong>{sectionErrors.pagos ? '—' : formatMoney(reportPendingRevenue)}</strong><small>{reportPendingPayments.length} recibos por revisar o pagos en curso</small></div>
          <div><span>Facturas emitidas</span><strong>{sectionErrors.facturas ? '—' : formatMoney(reportInvoices.reduce((sum, invoice) => sum + Number(invoice.valor_total || 0), 0))}</strong><small>{reportInvoices.length} facturas del periodo</small></div>
          <div><span>Facturas pendientes</span><strong>{sectionErrors.facturas ? '—' : reportInvoices.filter((invoice) => ['pendiente', 'vencida'].includes(invoice.estado)).length}</strong><small>Incluye vencidas</small></div>
        </div>
        <div className="report-downloads">
          <button type="button" className="secondary-button" onClick={() => exportTreasuryWorkbook('balance')}><Download size={15} /> Balance de ingresos</button>
          <button type="button" className="secondary-button" onClick={() => exportTreasuryWorkbook('pagos')}><Download size={15} /> Pagos de usuarios</button>
          <button type="button" className="secondary-button" onClick={() => exportTreasuryWorkbook('facturas')}><Download size={15} /> Facturas emitidas</button>
          <button type="button" className="secondary-button" onClick={() => exportTreasuryWorkbook('usuarios')}><Download size={15} /> Estado por usuario</button>
        </div>
      </section>
      <section className="analytics-grid">
        <div className="panel chart-panel large-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Reporte</p>
              <h3>Ingresos y metas</h3>
            </div>
          </div>
          <div className="chart-wrap">
            <Suspense fallback={<div className="chart-loading" role="status">Cargando gráfica...</div>}>
              <AnalyticsCharts kind="bar" data={revenueTrend} />
            </Suspense>
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
                <strong>{metricValue('pagos', pendingPayments.length)}</strong>
                <span>Pagos pendientes</span>
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
    eliminados: renderDeletedUsers(),
    'paz-y-salvo': renderPazYSalvo(),
    facturas: renderFacturas(),
    pagos: renderPagos(),
    cortes: renderCortes(),
    notificaciones: renderNotificaciones(),
    tarifas: renderTarifas(),
    reportes: renderReportes(),
  }
  return sectionMap[activeSection] ?? null
}
