import { ShieldCheck, Waves } from 'lucide-react'
import hidroAppLogo from '../../assets/hidroapp-logo.png'

export default function AuthScreen({
  authMode,
  setAuthMode,
  email,
  setEmail,
  password,
  setPassword,
  recoveryCode,
  setRecoveryCode,
  newPassword,
  setNewPassword,
  confirmNewPassword,
  setConfirmNewPassword,
  authNotice,
  setAuthNotice,
  authError,
  setAuthError,
  isLoggingIn,
  onLogin,
  onRecoverySubmit,
  onCheckAdminEmail,
}) {
  return (
      <main className="auth-shell">
        <section className="auth-showcase" aria-label="Acueducto Campoamor">
          <div className="auth-showcase-top">
            <img src={hidroAppLogo} alt="" className="auth-brand-logo" />
            <span>ACUEDUCTO CAMPOAMOR</span>
          </div>
          <div className="auth-showcase-copy">
            <span className="auth-kicker"><span /> SERVICIO Y COMUNIDAD</span>
            <h2>El agua de nuestra comunidad, bajo control.</h2>
            <p>Gestiona usuarios, facturación y novedades del servicio desde un solo lugar.</p>
          </div>
          <div className="auth-showcase-footer">
            <div className="auth-watermark"><Waves size={118} strokeWidth={1} /></div>
            <span>PLATAFORMA DE ADMINISTRACIÓN</span>
            <span className="auth-status"><i /> Sistema de gestión</span>
          </div>
        </section>
        <form className="auth-panel" onSubmit={authMode === 'login' ? onLogin : onRecoverySubmit}>
          <div className="auth-form-heading">
            <div className="auth-mark"><Waves size={22} /></div>
            <p className="eyebrow">BIENVENIDO</p>
            <h1>{authMode === 'login' ? 'Inicia sesión' : authMode === 'request-reset' ? 'Recupera tu acceso' : 'Crea una contraseña'}</h1>
          <p className="auth-description">
            {authMode === 'login'
              ? 'Ingresa con tu cuenta de administrador.'
              : authMode === 'request-reset'
                ? 'Te enviaremos un código al correo de tu cuenta.'
                : 'Ingresa el código recibido y define una contraseña de al menos 8 caracteres.'}
          </p>
          </div>
          <label htmlFor="admin-email">Correo electrónico</label>
          <input
            id="admin-email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(event) => { setEmail(event.target.value); setAuthError('') }}
            onBlur={authMode === 'login' ? onCheckAdminEmail : undefined}
            readOnly={authMode === 'reset'}
            required
          />
          {authMode === 'reset' && (
            <>
              <p className="auth-notice" role="status">
                El código corresponde a {email}. Si necesitas usar otro correo, solicita un código nuevo.
              </p>
              <button
                type="button"
                className="link-button auth-link"
                onClick={() => {
                  setAuthMode('request-reset')
                  setRecoveryCode('')
                  setNewPassword('')
                  setConfirmNewPassword('')
                  setAuthError('')
                  setAuthNotice('')
                }}
              >
                Cambiar correo y solicitar otro código
              </button>
            </>
          )}
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
                pattern="[0-9]{6}"
                maxLength={6}
                value={recoveryCode}
                onChange={(event) => setRecoveryCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
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
          <p className="auth-security"><ShieldCheck size={15} /> Acceso seguro para administradores</p>
        </form>
      </main>
  )
}
