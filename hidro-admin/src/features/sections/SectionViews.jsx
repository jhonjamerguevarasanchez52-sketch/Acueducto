import { lazy, Suspense } from 'react'
import {
  BellRing,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Download,
  Eye,
  Plus,
  ShieldCheck,
  Trash2,
  TrendingUp,
  Upload,
} from 'lucide-react'
import StatCard from '../../components/StatCard.jsx'

// Las gráficas (recharts) se cargan bajo demanda para que el panel abra más rápido.
const AnalyticsCharts = lazy(() => import('../../components/AnalyticsCharts.jsx'))

export default function SectionViews({ activeSection, context }) {
  const {
    sectionData,
    sectionErrors,
    loadingSections,
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
    payments,
    handleNavigate,
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
    applyReportPreset,
    dashboardKpis,
    revenueTrend,
    serviceMix,
    recentUsers,
    reportSummary,
    metricValue,
  } = context

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
          <div><span>Pagos por confirmar</span><strong>{sectionErrors.pagos ? '—' : formatMoney(reportPendingRevenue)}</strong><small>{reportPayments.filter((payment) => !payment.confirmado).length} transacciones</small></div>
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
  return sectionMap[activeSection] ?? null
}
