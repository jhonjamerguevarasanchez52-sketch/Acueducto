import {
  BarChart3,
  Bell,
  ChevronRight,
  Droplets,
  LayoutDashboard,
  LogOut,
  ReceiptText,
  SlidersHorizontal,
  Users,
  Wallet,
  Waves,
  X,
} from 'lucide-react'

const items = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'usuarios', label: 'Usuarios', icon: Users },
  { id: 'facturas', label: 'Facturación', icon: ReceiptText },
  { id: 'pagos', label: 'Pagos', icon: Wallet },
  { id: 'cortes', label: 'Cortes y reconexiones', icon: Droplets },
  { id: 'notificaciones', label: 'Notificaciones', icon: Bell },
  { id: 'tarifas', label: 'Tarifas', icon: SlidersHorizontal },
  { id: 'reportes', label: 'Reportes', icon: BarChart3 },
]

export default function Sidebar({ active, onNavigate, onLogout, open, onClose }) {
  return (
    <>
      {open && <button className="mobile-overlay" onClick={onClose} aria-label="Cerrar menú" />}

      <aside className={`sidebar ${open ? 'sidebar-open' : ''}`}>
        <div className="brand-block">
          <div className="brand-icon">
            <Waves size={24} />
          </div>
          <div>
            <strong>HIDRO-APP</strong>
            <span>Administración</span>
          </div>
          <button className="icon-button mobile-close" onClick={onClose} aria-label="Cerrar menú">
            <X size={18} />
          </button>
        </div>

        <div className="menu-label">Menú principal</div>

        <nav className="nav-menu" aria-label="Navegación principal">
          {items.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              className={`nav-item ${active === id ? 'active' : ''}`}
              onClick={() => {
                onNavigate(id)
                onClose()
              }}
            >
              <Icon size={18} />
              <span>{label}</span>
              <ChevronRight size={15} className="nav-chevron" />
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="status-pill">
            <span className="dot" />
            Sistema activo
          </div>
          <button type="button" className="logout-button" onClick={onLogout}>
            <LogOut size={16} />
            Cerrar sesión
          </button>
        </div>
      </aside>
    </>
  )
}
