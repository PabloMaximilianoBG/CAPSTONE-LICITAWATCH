import { useEffect, useRef, useState, type FormEvent } from 'react'
import { api, USE_MOCK, mockApi } from '../../api'
import { ApiError } from '../../api/errors'
import { ERROR_SIN_VERIFICAR, esRequiere2fa, type Requiere2fa } from '../../api/types'
import { Link, navigate, tomarDestino, useLocation } from '../../lib/router'
import { Logo } from '../../components/layout/Logo'
import { LoginEnVivo } from '../../components/layout/EscenasAuth'
import { MediaVideo } from '../../components/layout/MediaVideo'
import { Button, Field, Input, useAsync, useToast, Cargando, EmptyState } from '../../components/ui/ui'
import { Icon } from '../../lib/icons'
import { useAuth } from '../../context/AuthContext'
import { validarEmail, validarPassword, fechaHora } from '../../lib/format'
import { PublicPage } from '../../components/layout/PublicLayout'

const DEMOS = [
  { rol: 'Licitador', email: 'licitador@demo.cl', pass: 'Demo1234!', icon: 'building' as const },
  { rol: 'Pyme Estándar', email: 'pyme@demo.cl', pass: 'Demo1234!', icon: 'briefcase' as const },
  { rol: 'Pyme Premium', email: 'premium@demo.cl', pass: 'Demo1234!', icon: 'crown' as const },
  { rol: 'Administrador', email: 'admin@licitawatch.cl', pass: 'Admin123!', icon: 'shield' as const },
]

export function Login() {
  const { login, loginDosPasos } = useAuth()
  const toast = useToast()
  const { search } = useLocation()
  const recienVerificada = search.get('verificada') === '1'
  const passwordCambiada = search.get('password') === '1'   // viene de Configuración > Seguridad tras cambiar la contraseña
  const sesionTerminada = search.get('sesion')   // «cerrada» (desde otro dispositivo) o «expirada»
  const [email, setEmail] = useState(search.get('email') ?? '')
  const [pass, setPass] = useState('')
  const [ver, setVer] = useState(false)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')
  const [sinVerificar, setSinVerificar] = useState(false)
  const [reenviando, setReenviando] = useState(false)
  const [pendiente2fa, setPendiente2fa] = useState<Requiere2fa | null>(null)   // la cuenta tiene 2FA: falta el código

  const reenviar = async () => {
    setReenviando(true)
    try { await api.reenviarVerificacion(email); toast.ok('Te enviamos un nuevo enlace de verificación.') }
    catch (err) { toast.error((err as Error).message) }
    finally { setReenviando(false) }
  }

  const entrar = () => {
    toast.ok('¡Bienvenido de vuelta!')
    if (window.location.pathname === '/login') navigate(tomarDestino() ?? '/app', true)   // vuelve a la página que se quiso abrir (p. ej. el enlace de un correo)
  }

  const enviar = async (e?: FormEvent, creds?: { email: string; pass: string }) => {
    e?.preventDefault()
    const em = creds?.email ?? email
    const pw = creds?.pass ?? pass
    if (!validarEmail(em)) { setError('Ingresa un correo válido'); return }
    if (!pw) { setError('Ingresa tu contraseña'); return }
    setError(''); setSinVerificar(false); setCargando(true)
    try {
      const r = await login(em, pw)
      if (esRequiere2fa(r)) { setPendiente2fa(r); setPass(''); return }
      entrar()
    } catch (err) {
      setError((err as Error).message)
      setSinVerificar(err instanceof ApiError && err.status === ERROR_SIN_VERIFICAR)
    } finally {
      setCargando(false)
    }
  }

  return (
    <div className="auth auth-login">
      <aside className="auth-video">
        <MediaVideo src="/media/login.mp4" fallback={<LoginEnVivo />} className="auth-video-el">
          <div className="auth-video-caption">
            <Logo size={34} claro />
            <p>Todas tus licitaciones, en la palma de tu mano.</p>
          </div>
        </MediaVideo>
      </aside>
      <div className="auth-form-side">
        <div className="auth-form narrow">
          <Link to="/" className="back"><Icon name="arrowleft" size={16} /> Volver al inicio</Link>
          <div className="auth-logo"><Logo size={40} /></div>
          <h1>Inicia sesión</h1>
          <p className="auth-sub">Ingresa tus credenciales para acceder a tu panel.</p>
          {recienVerificada && <div className="alert alert-ok"><Icon name="checkcircle" size={18} />¡Tu cuenta fue verificada! Ya puedes iniciar sesión.</div>}
          {passwordCambiada && <div className="alert alert-ok"><Icon name="checkcircle" size={18} />Cambiaste tu contraseña. Inicia sesión con la nueva.</div>}
          {sesionTerminada && <div className="alert alert-warn"><Icon name="lock" size={18} />{sesionTerminada === 'cerrada' ? 'Tu sesión fue cerrada. Inicia sesión nuevamente.' : 'Tu sesión expiró. Inicia sesión nuevamente.'}</div>}
          {pendiente2fa ? (
            <PasoCodigo2fa pendiente={pendiente2fa} onCancelar={() => setPendiente2fa(null)}
              onCodigo={async (codigo) => { await loginDosPasos(pendiente2fa.tokenTemporal, codigo); entrar() }} />
          ) : <>
          <form onSubmit={(e) => enviar(e)} noValidate>
            <Field label="Correo electrónico" required><Input icon="mail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@correo.cl" autoComplete="email" autoFocus /></Field>
            <Field label="Contraseña" required>
              <Input icon="lock" type={ver ? 'text' : 'password'} value={pass} onChange={(e) => setPass(e.target.value)} placeholder="••••••••" autoComplete="current-password"
                right={<button type="button" className="icon-btn" onClick={() => setVer((v) => !v)} aria-label="Mostrar contraseña"><Icon name="eye" size={18} /></button>} />
            </Field>
            <div className="login-row"><Link to="/recuperar" className="link">¿Olvidaste tu contraseña?</Link></div>
            {error && (sinVerificar ? (
              <div className="alert alert-warn">
                <Icon name="mail" size={18} />
                <div className="alert-body">
                  <span>{error}</span>
                  <button type="button" className="link-btn" onClick={reenviar} disabled={reenviando}>{reenviando ? 'Enviando…' : 'Reenviar correo de verificación'}</button>
                </div>
              </div>
            ) : <div className="alert alert-err"><Icon name="alert" size={18} />{error}</div>)}
            <Button type="submit" size="lg" block loading={cargando} iconRight="arrowright">Iniciar sesión</Button>
          </form>
          <p className="auth-foot">¿Aún no tienes cuenta? <Link to="/registro">Regístrate gratis</Link></p>
          </>}

          {USE_MOCK && (
            <div className="demo-box">
              <div className="demo-head"><Icon name="zap" size={16} /> Cuentas de demostración <small>(modo simulado)</small></div>
              <div className="demo-grid">
                {DEMOS.map((d) => (
                  <button key={d.email} type="button" onClick={() => { setEmail(d.email); setPass(d.pass); enviar(undefined, { email: d.email, pass: d.pass }) }}>
                    <Icon name={d.icon} size={18} /><span>{d.rol}</span>
                  </button>
                ))}
              </div>
              <button type="button" className="link-btn" onClick={() => { mockApi.resetDemo(); toast.info('Datos de demostración restablecidos'); }}>Restablecer datos de demostración</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export function Recover() {
  const [email, setEmail] = useState('')
  const [enviado, setEnviado] = useState(false)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')
  const enviar = async (e: FormEvent) => {
    e.preventDefault()
    if (!validarEmail(email)) { setError('Ingresa un correo válido'); return }
    setError(''); setCargando(true)
    try { await api.solicitarRecuperacion(email); setEnviado(true) } catch (err) { setError((err as Error).message) } finally { setCargando(false) }
  }
  return (
    <div className="auth auth-center">
      <div className="auth-card">
        <Link to="/login" className="back"><Icon name="arrowleft" size={16} /> Volver al inicio de sesión</Link>
        <div className="auth-logo"><Logo size={40} /></div>
        {enviado ? (
          <div className="sent">
            <span className="sent-ic"><Icon name="mail" size={30} /></span>
            <h1>Revisa tu correo</h1>
            <p>Si <b>{email}</b> tiene una cuenta, te enviamos un enlace para restablecer tu contraseña. Vence en 1 hora.</p>
            {USE_MOCK && <Link to="/bandeja" className="btn btn-soft btn-md"><Icon name="inbox" size={18} /><span>Abrir bandeja simulada</span></Link>}
            <Link to="/login" className="btn btn-ghost btn-md"><span>Volver a iniciar sesión</span></Link>
          </div>
        ) : (
          <>
            <h1>Recupera tu contraseña</h1>
            <p className="auth-sub">Ingresa el correo con el que te registraste y te enviaremos un enlace para crear una nueva contraseña.</p>
            <form onSubmit={enviar} noValidate>
              <Field label="Correo de tu cuenta" required error={error}><Input icon="mail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@correo.cl" autoFocus /></Field>
              <Button type="submit" size="lg" block loading={cargando}>Enviar enlace de recuperación</Button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}

/** Después del registro: la cuenta queda pendiente hasta abrir el enlace del correo. */
export function RevisaCorreo() {
  const { search } = useLocation()
  const email = search.get('email') ?? ''
  const toast = useToast()
  const [enviando, setEnviando] = useState(false)
  const reenviar = async () => {
    setEnviando(true)
    try { await api.reenviarVerificacion(email); toast.ok('Te enviamos un nuevo enlace de verificación.') }
    catch (err) { toast.error((err as Error).message) }
    finally { setEnviando(false) }
  }
  return (
    <div className="auth auth-center">
      <div className="auth-card">
        <div className="auth-logo"><Logo size={40} /></div>
        <div className="sent">
          <span className="sent-ic"><Icon name="mail" size={30} /></span>
          <h1>Verifica tu correo</h1>
          <p>Tu cuenta fue creada. Enviamos un enlace de activación a {email ? <b>{email}</b> : 'tu correo'}. Ábrelo para activar tu cuenta; vence en 24 horas.</p>
          <p className="sent-nota">¿No te llegó? Revisa la carpeta de spam o pide uno nuevo.</p>
          {USE_MOCK && <Link to="/bandeja" className="btn btn-soft btn-md"><Icon name="inbox" size={18} /><span>Abrir bandeja simulada</span></Link>}
          {email && <Button variant="ghost" icon="refresh" loading={enviando} onClick={reenviar}>Reenviar correo</Button>}
          <Link to="/login" className="btn btn-primary btn-md"><span>Ir a iniciar sesión</span></Link>
        </div>
      </div>
    </div>
  )
}

/** Destino del enlace del correo: /verificar?token=… Al terminar se va al login para ingresar las credenciales. */
export function Verificar() {
  const { search } = useLocation()
  const token = search.get('token') ?? ''
  const [estado, setEstado] = useState<'cargando' | 'ok' | 'error'>(token ? 'cargando' : 'error')
  const [error, setError] = useState(token ? '' : 'El enlace no es válido. Solicita uno nuevo al iniciar sesión.')
  const hecho = useRef(false)   // en desarrollo React monta dos veces: verificamos una sola vez
  useEffect(() => {
    if (!token || hecho.current) return
    hecho.current = true
    api.verificarCuenta(token).then(() => setEstado('ok')).catch((err) => { setError((err as Error).message); setEstado('error') })
  }, [token])
  return (
    <div className="auth auth-center">
      <div className="auth-card">
        <div className="auth-logo"><Logo size={40} /></div>
        {estado === 'cargando' ? <Cargando /> : estado === 'ok' ? (
          <div className="sent">
            <span className="sent-ic ok"><Icon name="checkcircle" size={30} /></span>
            <h1>¡Cuenta verificada!</h1>
            <p>Tu correo quedó confirmado. Ahora ingresa con tu correo y contraseña.</p>
            <Link to="/login?verificada=1" className="btn btn-primary btn-lg"><span>Iniciar sesión</span></Link>
          </div>
        ) : (
          <div className="sent">
            <span className="sent-ic err"><Icon name="xcircle" size={30} /></span>
            <h1>No pudimos verificar tu cuenta</h1>
            <p>{error}</p>
            <p className="sent-nota">Intenta iniciar sesión: si tu cuenta sigue pendiente, podrás pedir un enlace nuevo.</p>
            <Link to="/login" className="btn btn-primary btn-md"><span>Ir a iniciar sesión</span></Link>
          </div>
        )}
      </div>
    </div>
  )
}

export function Reset() {
  const { search } = useLocation()
  const token = search.get('token') ?? ''
  const [p1, setP1] = useState('')
  const [p2, setP2] = useState('')
  const [error, setError] = useState('')
  const [ok, setOk] = useState(false)
  const [cargando, setCargando] = useState(false)
  const enviar = async (e: FormEvent) => {
    e.preventDefault()
    const v = validarPassword(p1)
    if (v) { setError(v); return }
    if (p1 !== p2) { setError('Las contraseñas no coinciden'); return }
    setError(''); setCargando(true)
    try { await api.restablecerPassword(token, p1); setOk(true) } catch (err) { setError((err as Error).message) } finally { setCargando(false) }
  }
  return (
    <div className="auth auth-center">
      <div className="auth-card">
        <div className="auth-logo"><Logo size={40} /></div>
        {ok ? (
          <div className="sent">
            <span className="sent-ic ok"><Icon name="checkcircle" size={30} /></span>
            <h1>¡Contraseña actualizada!</h1>
            <p>Ya puedes iniciar sesión con tu nueva contraseña.</p>
            <Link to="/login" className="btn btn-primary btn-lg"><span>Iniciar sesión</span></Link>
          </div>
        ) : (
          <>
            <h1>Crea una nueva contraseña</h1>
            <p className="auth-sub">Elige una contraseña segura que no hayas usado antes.</p>
            {!token && <div className="alert alert-err"><Icon name="alert" size={18} />El enlace no es válido. Solicita uno nuevo.</div>}
            <form onSubmit={enviar} noValidate>
              <Field label="Nueva contraseña" required hint="Mínimo 8 caracteres, con mayúscula, minúscula y número."><Input icon="lock" type="password" value={p1} onChange={(e) => setP1(e.target.value)} /></Field>
              <Field label="Repetir contraseña" required error={error}><Input icon="lock" type="password" value={p2} onChange={(e) => setP2(e.target.value)} /></Field>
              <Button type="submit" size="lg" block loading={cargando} disabled={!token}>Guardar contraseña</Button>
            </form>
            <p className="auth-foot"><Link to="/recuperar">Solicitar un enlace nuevo</Link></p>
          </>
        )}
      </div>
    </div>
  )
}

/** Bandeja de correos simulada: solo en modo mock. Muestra los emails que enviaría el microservicio de Notificaciones. */
export function Bandeja() {
  const { data, loading, recargar } = useAsync(() => mockApi.correos(), [])
  if (!USE_MOCK) return <PublicPage><div className="wrap" style={{ padding: 80 }}><EmptyState titulo="Disponible solo en modo simulado" /></div></PublicPage>
  return (
    <PublicPage>
      <section className="mailbox">
        <div className="wrap narrow-wrap">
          <div className="mailbox-head">
            <div>
              <h1 className="h1-sm"><Icon name="inbox" size={28} /> Bandeja de correos simulada</h1>
              <p>Aquí aparecen los correos que enviaría la API de Notificaciones (bienvenida, recuperación de contraseña, postulaciones…).</p>
            </div>
            <Button variant="soft" icon="refresh" onClick={recargar}>Actualizar</Button>
          </div>
          {loading ? <Cargando /> : data && data.length > 0 ? (
            <div className="mail-list">
              {data.map((m) => (
                <article key={m.id} className="mail">
                  <div className="mail-top"><b>{m.asunto}</b><small>{fechaHora(m.fecha)}</small></div>
                  <small className="mail-to">Para: {m.para}</small>
                  <p>{m.cuerpo}</p>
                  {m.enlace && <a className="btn btn-primary btn-sm" href={m.enlace}><span>{m.etiqueta ?? 'Restablecer contraseña'}</span><Icon name="arrowright" size={16} /></a>}
                </article>
              ))}
            </div>
          ) : <EmptyState titulo="Aún no hay correos" texto="Solicita una recuperación de contraseña o regístrate para ver correos aquí." />}
        </div>
      </section>
    </PublicPage>
  )
}

/** Segundo paso del login con 2FA: código de 6 dígitos de la app, o un código de recuperación (XXXX-XXXX). El token temporal dura 5 minutos. */
function PasoCodigo2fa({ pendiente, onCodigo, onCancelar }: { pendiente: Requiere2fa; onCodigo: (codigo: string) => Promise<void>; onCancelar: () => void }) {
  const [recuperacion, setRecuperacion] = useState(false)
  const [codigo, setCodigo] = useState('')
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)
  const valido = recuperacion ? codigo.replace(/[^A-Za-z0-9]/g, '').length === 8 : /^\d{6}$/.test(codigo)
  const enviar = async (e?: FormEvent) => {
    e?.preventDefault()
    if (!valido) { setError(recuperacion ? 'El código de recuperación tiene 8 caracteres (XXXX-XXXX).' : 'Ingresa los 6 dígitos que muestra tu aplicación.'); return }
    setError(''); setEnviando(true)
    try { await onCodigo(codigo) }
    catch (err) {
      const m = (err as Error).message
      setError(m); setCodigo('')
      if (err instanceof ApiError && err.status === 401) setTimeout(onCancelar, 2500)   // pasaron los 5 minutos: vuelve a pedir la contraseña
    } finally { setEnviando(false) }
  }
  return (
    <form onSubmit={enviar} noValidate className="dosf-login">
      <div className="alert alert-ok"><Icon name="shield" size={18} />Tu cuenta tiene verificación en dos pasos ({pendiente.email}).</div>
      {recuperacion ? (
        <Field label="Código de recuperación" required hint="Uno de los 8 códigos que guardaste al activar la verificación. Cada uno sirve una sola vez.">
          <Input icon="lock" value={codigo} onChange={(e) => setCodigo(e.target.value.toUpperCase().slice(0, 9))} placeholder="XXXX-XXXX" autoComplete="one-time-code" autoFocus />
        </Field>
      ) : (
        <Field label="Código de 6 dígitos" required hint="Ábrelo en tu aplicación de autenticación (Google Authenticator u otra). Cambia cada 30 segundos.">
          <Input className="dosf-codigo" icon="shield" inputMode="numeric" value={codigo} onChange={(e) => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="000000" autoComplete="one-time-code" autoFocus />
        </Field>
      )}
      {error && <div className="alert alert-err"><Icon name="alert" size={18} />{error}</div>}
      <Button type="submit" size="lg" block loading={enviando} disabled={!valido} iconRight="arrowright">Verificar e ingresar</Button>
      <div className="dosf-login-links">
        <button type="button" className="link-btn" onClick={() => { setRecuperacion(!recuperacion); setCodigo(''); setError('') }}>
          {recuperacion ? 'Usar el código de mi aplicación' : '¿No tienes tu teléfono? Usa un código de recuperación'}
        </button>
        <button type="button" className="link-btn" onClick={onCancelar}>Volver</button>
      </div>
    </form>
  )
}
