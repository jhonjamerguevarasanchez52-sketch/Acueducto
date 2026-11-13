import { KeyRound, ShieldCheck } from 'lucide-react'

// Se muestra cuando la cuenta entró con la contraseña temporal que generó otro
// administrador. El servidor no deja usar nada más hasta cambiarla.
export default function ForcedPasswordChange({
  correo,
  currentPassword,
  setCurrentPassword,
  newPassword,
  setNewPassword,
  confirmPassword,
  setConfirmPassword,
  error,
  isSaving,
  onSubmit,
  onLogout,
}) {
  return (
    <main className="auth-shell auth-shell-single">
      <form className="auth-panel" onSubmit={onSubmit}>
        <div className="auth-form-heading">
          <div className="auth-mark"><KeyRound size={22} /></div>
          <p className="eyebrow">PRIMER INGRESO</p>
          <h1>Crea tu contraseña</h1>
          <p className="auth-description">
            Entraste con una contraseña temporal{correo ? ` (${correo})` : ''}. Por seguridad, cámbiala antes de usar el panel.
          </p>
        </div>
        <label htmlFor="forced-current">Contraseña temporal</label>
        <input
          id="forced-current"
          type="password"
          autoComplete="current-password"
          value={currentPassword}
          onChange={(event) => setCurrentPassword(event.target.value)}
          required
        />
        <label htmlFor="forced-new">Nueva contraseña</label>
        <input
          id="forced-new"
          type="password"
          autoComplete="new-password"
          minLength={8}
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
          required
        />
        <label htmlFor="forced-confirm">Confirmar contraseña</label>
        <input
          id="forced-confirm"
          type="password"
          autoComplete="new-password"
          minLength={8}
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          required
        />
        {error && <p className="auth-error" role="alert">{error}</p>}
        <button className="primary-button auth-submit" type="submit" disabled={isSaving}>
          {isSaving ? 'Guardando...' : 'Guardar y entrar'}
        </button>
        <button type="button" className="link-button auth-link" onClick={onLogout}>
          Cerrar sesión
        </button>
        <p className="auth-security"><ShieldCheck size={15} /> Al cambiarla se cierran tus otras sesiones abiertas.</p>
      </form>
    </main>
  )
}
