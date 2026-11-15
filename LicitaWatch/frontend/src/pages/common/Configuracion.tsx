import { useEffect, useRef, useState, type ReactNode } from 'react'
import { api } from '../../api'
import type { Configuracion2fa, SeguridadCuenta, SesionActiva } from '../../api/types'
import { Badge, Button, Card, Cargando, EmptyState, Field, Input, Modal, Tabs, useAsync, useToast } from '../../components/ui/ui'
import { FortalezaPassword } from '../../components/app/FortalezaPassword'
import { useAuth } from '../../context/AuthContext'
import { Icon, type IconName } from '../../lib/icons'
import { navigate } from '../../lib/router'
import { fechaCorta, hace, validarPassword } from '../../lib/format'

/* Configuración de la cuenta (Licitador y Pyme). Pestaña Seguridad; Notificaciones queda lista para más adelante. */

type Pestana = 'seguridad' | 'notificaciones'

export function Configuracion() {
  const [tab, setTab] = useState<Pestana>('seguridad')
  return (
    <div className="stack">
      <Card className="cfg-head">
        <span className="cfg-head-ic"><Icon name="settings" size={20} /></span>
        <div><h1>Configuración</h1><p>Administra la seguridad y las preferencias de tu cuenta.</p></div>
      </Card>
      <Tabs valor={tab} onChange={setTab} items={[
        { id: 'seguridad', label: 'Seguridad', icon: 'shield' },
        { id: 'notificaciones', label: 'Notificaciones', icon: 'bell', disabled: true, nota: 'Próximamente' },
      ]} />
      {tab === 'seguridad' && <Seguridad />}
    </div>
  )
}

/** «hoy», «ayer» o «hace N días» por día calendario. */
function diasDesde(iso: string): string {
  const d = new Date(iso); d.setHours(0, 0, 0, 0)
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
  const n = Math.round((hoy.getTime() - d.getTime()) / 86_400_000)
  return n <= 0 ? 'hoy' : n === 1 ? 'ayer' : `hace ${n} días`
}

function Fila({ icon, titulo, children, accion }: { icon: IconName; titulo: string; children: ReactNode; accion?: ReactNode }) {
  return (
    <Card className="cfg-fila">
      <span className="cfg-fila-ic"><Icon name={icon} size={19} /></span>
      <div className="cfg-fila-txt"><b>{titulo}</b>{children}</div>
      {accion && <div className="cfg-fila-accion">{accion}</div>}
    </Card>
  )
}

function Seguridad() {
  const seg = useAsync(() => api.seguridadCuenta(), [])
  const [cambiar, setCambiar] = useState(false)
  if (seg.loading) return <Cargando />
  if (!seg.data) return <Card><EmptyState icon="alert" titulo="No pudimos cargar tu configuración" texto={seg.error ?? undefined} accion={<Button onClick={seg.recargar}>Reintentar</Button>} /></Card>
  const s = seg.data
  return (
    <div className="cfg-lista">
      <p className="cfg-intro">Protege tu acceso, revisa tus sesiones activas y el estado de verificación de tu cuenta.</p>
      <Fila icon="lock" titulo="Contraseña" accion={<Button size="sm" variant="outline" onClick={() => setCambiar(true)}>Cambiar</Button>}>
        <small>{s.passwordActualizadaAt ? `Actualizada: ${diasDesde(s.passwordActualizadaAt)}` : 'Sin cambios desde el registro'}</small>
      </Fila>
      <Sesiones />
      <DosFactores s={s} onCambio={seg.setData} />
      <VerificacionEmail s={s} onCambio={seg.setData} />
      <Fila icon="user" titulo="Estado de la cuenta" accion={<Badge tono={s.activo ? 'green' : 'red'} dot>{s.activo ? 'Activa' : 'Suspendida'}</Badge>}>
        <small>{s.plan ? `Plan ${s.plan} · ` : ''}Miembro desde {fechaCorta(s.miembroDesde)}</small>
      </Fila>
      <CambiarPassword abierto={cambiar} onClose={() => setCambiar(false)} />
    </div>
  )
}

function VerificacionEmail({ s, onCambio }: { s: SeguridadCuenta; onCambio: (s: SeguridadCuenta) => void }) {
  const toast = useToast()
  const [espera, setEspera] = useState(s.reenvioDisponibleEn)
  const [enviando, setEnviando] = useState(false)
  useEffect(() => setEspera(s.reenvioDisponibleEn), [s.reenvioDisponibleEn])
  useEffect(() => {
    if (espera <= 0) return
    const t = setTimeout(() => setEspera((x) => x - 1), 1000)
    return () => clearTimeout(t)
  }, [espera])
  const reenviar = async () => {
    setEnviando(true)
    try { onCambio(await api.reenviarVerificacionSesion()); toast.ok(`Te enviamos un nuevo correo de verificación a ${s.email}.`) }
    catch (e) { toast.error((e as Error).message) } finally { setEnviando(false) }
  }
  return (
    <Fila icon="checkcircle" titulo="Verificación de email" accion={s.emailVerificado ? <Badge tono="green" icon="check">Verificado</Badge> : (
      <div className="cfg-acciones">
        <Badge tono="amber" icon="alert">No verificado</Badge>
        <Button size="sm" variant="outline" icon="mail" loading={enviando} disabled={espera > 0} onClick={reenviar}>
          {espera > 0 ? `Reenviar en ${espera} s` : 'Reenviar correo de verificación'}
        </Button>
      </div>
    )}>
      <small>{s.email}{s.emailVerificado ? ' · correo confirmado' : ' · revisa tu bandeja de entrada'}</small>
    </Fila>
  )
}

/** Modal «Cambiar contraseña»: actual, nueva y repetir, con las mismas reglas del registro (el backend las vuelve a validar). */
function CambiarPassword({ abierto, onClose }: { abierto: boolean; onClose: () => void }) {
  const toast = useToast()
  const { sesion, logout } = useAuth()
  const [actual, setActual] = useState('')
  const [nueva, setNueva] = useState('')
  const [repetir, setRepetir] = useState('')
  const [ver, setVer] = useState(false)
  const [cerrarOtras, setCerrarOtras] = useState(true)
  const [errores, setErrores] = useState<Record<string, string>>({})
  const [guardando, setGuardando] = useState(false)
  useEffect(() => { if (!abierto) { setActual(''); setNueva(''); setRepetir(''); setErrores({}); setVer(false); setCerrarOtras(true) } }, [abierto])

  const guardar = async () => {
    const e: Record<string, string> = {}
    if (!actual) e.actual = 'Ingresa tu contraseña actual'
    const regla = validarPassword(nueva)
    if (!nueva) e.nueva = 'Ingresa la nueva contraseña'
    else if (regla) e.nueva = regla
    else if (nueva === actual) e.nueva = 'La nueva contraseña debe ser distinta de la actual'
    if (!e.nueva && repetir !== nueva) e.repetir = 'Las contraseñas no coinciden'
    setErrores(e)
    if (Object.keys(e).length) return
    setGuardando(true)
    try {
      await api.cambiarPassword(actual, nueva, cerrarOtras)
      // Se cierra la sesión y se vuelve al login para entrar con la nueva contraseña (el correo ya va prellenado).
      const email = sesion?.usuario.email ?? ''
      await logout()
      navigate(`/login?password=1&email=${encodeURIComponent(email)}`, true)
      toast.ok('Contraseña actualizada. Inicia sesión con tu nueva contraseña.')
    } catch (err) {
      const m = (err as Error).message
      setErrores(/actual/i.test(m) && !/distinta/i.test(m) ? { actual: m } : { nueva: m })
    } finally { setGuardando(false) }
  }
  const ojo = <button type="button" className="icon-btn" onClick={() => setVer(!ver)} aria-label={ver ? 'Ocultar contraseñas' : 'Mostrar contraseñas'}><Icon name="eye" size={16} /></button>
  const tipo = ver ? 'text' : 'password'
  return (
    <Modal abierto={abierto} onClose={onClose} titulo="Cambiar contraseña" ancho={480}
      pie={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button icon="lock" loading={guardando} onClick={guardar}>Guardar contraseña</Button></>}>
      <div className="stack cfg-modal">
        <Field label="Contraseña actual" required error={errores.actual}><Input type={tipo} autoComplete="current-password" value={actual} onChange={(e) => setActual(e.target.value)} right={ojo} /></Field>
        <Field label="Nueva contraseña" required error={errores.nueva}>
          <Input type={tipo} autoComplete="new-password" value={nueva} onChange={(e) => setNueva(e.target.value)} />
        </Field>
        <FortalezaPassword password={nueva} />
        <Field label="Repetir nueva contraseña" required error={errores.repetir} ok={!!repetir && repetir === nueva}>
          <Input type={tipo} autoComplete="new-password" value={repetir} onChange={(e) => setRepetir(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && guardar()} />
        </Field>
        <label className="cfg-check"><input type="checkbox" checked={cerrarOtras} onChange={(e) => setCerrarOtras(e.target.checked)} />Cerrar también mis otras sesiones (en otros dispositivos)</label>
        <p className="pub-nota"><Icon name="info" size={14} />Al guardar, cerraremos tu sesión para que entres con la nueva contraseña, y te avisaremos por correo.</p>
      </div>
    </Modal>
  )
}

/** Tarjeta «Sesiones»: cuántas hay abiertas y cuándo se usó la última; «Ver sesiones» abre la lista para cerrarlas. */
function Sesiones() {
  const toast = useToast()
  const lista = useAsync(() => api.misSesiones(), [])
  const [abierto, setAbierto] = useState(false)
  const [cerrando, setCerrando] = useState<number | 'otras' | null>(null)
  const sesiones = lista.data ?? []
  const otras = sesiones.filter((x) => !x.actual)
  const ultima = sesiones.reduce<string | undefined>((m, x) => (!m || x.ultimoUsoAt > m ? x.ultimoUsoAt : m), undefined)

  const cerrar = async (x: SesionActiva) => {
    setCerrando(x.id)
    try { await api.cerrarSesionRemota(x.id); lista.setData(sesiones.filter((y) => y.id !== x.id)); toast.ok(`Cerraste la sesión de ${x.dispositivo}.`) }
    catch (e) { toast.error((e as Error).message) } finally { setCerrando(null) }
  }
  const cerrarOtras = async () => {
    setCerrando('otras')
    try {
      const r = await api.cerrarOtrasSesiones()
      lista.setData(sesiones.filter((y) => y.actual))
      toast.ok(r.cerradas === 1 ? 'Cerraste 1 sesión.' : `Cerraste ${r.cerradas} sesiones.`)
    } catch (e) { toast.error((e as Error).message) } finally { setCerrando(null) }
  }

  return (
    <>
      <Fila icon="grid" titulo="Sesiones" accion={<Button size="sm" variant="outline" onClick={() => { lista.recargar(); setAbierto(true) }} disabled={lista.loading && !lista.data}>Ver sesiones</Button>}>
        <small>{lista.loading && !lista.data ? 'Cargando…' : !lista.data ? 'No pudimos cargar tus sesiones'
          : `${sesiones.length} activa${sesiones.length === 1 ? '' : 's'}${ultima ? ` · Última: ${diasDesde(ultima)}` : ''}`}</small>
      </Fila>
      <Modal abierto={abierto} onClose={() => setAbierto(false)} titulo="Sesiones activas" ancho={620}
        pie={<><Button variant="ghost" onClick={() => setAbierto(false)}>Cerrar</Button>
          <Button variant="danger" icon="logout" disabled={!otras.length} loading={cerrando === 'otras'} onClick={cerrarOtras}>Cerrar todas las demás</Button></>}>
        {lista.loading && !lista.data ? <Cargando /> : sesiones.length === 0 ? <EmptyState icon="grid" titulo="No hay sesiones registradas" texto="Las sesiones aparecen aquí desde tu próximo inicio de sesión." /> : (
          <ul className="cfg-sesiones">
            {sesiones.map((x) => (
              <li key={x.id} className={x.actual ? 'actual' : ''}>
                <span className="cfg-fila-ic"><Icon name={/Celular|Tablet/.test(x.dispositivo) ? 'phone' : 'globe'} size={18} /></span>
                <div className="cfg-fila-txt">
                  <b>{x.dispositivo} {x.actual && <Badge tono="blue">Este dispositivo</Badge>}</b>
                  <small>{x.navegador} · IP {x.ip}</small>
                  <small>Última actividad: {x.actual ? 'ahora' : hace(x.ultimoUsoAt)} · Inició {fechaCorta(x.creadaAt)}</small>
                </div>
                {!x.actual && <Button size="sm" variant="outline" loading={cerrando === x.id} disabled={cerrando != null} onClick={() => cerrar(x)}>Cerrar</Button>}
              </li>
            ))}
          </ul>
        )}
        <p className="pub-nota"><Icon name="info" size={14} />Una sesión cerrada deja de funcionar en ese dispositivo en menos de un minuto.</p>
      </Modal>
    </>
  )
}

/** Tarjeta «Autenticación de dos factores»: activar con el asistente de 3 pasos o desactivar (contraseña + código). */
function DosFactores({ s, onCambio }: { s: SeguridadCuenta; onCambio: (s: SeguridadCuenta) => void }) {
  const [activar, setActivar] = useState(false)
  const [desactivar, setDesactivar] = useState(false)
  return (
    <>
      <Fila icon="shield" titulo="Autenticación de dos factores" accion={s.dosFactoresActivo ? (
        <div className="cfg-acciones"><Badge tono="green" icon="check">Activa</Badge><Button size="sm" variant="outline" onClick={() => setDesactivar(true)}>Desactivar</Button></div>
      ) : <div className="cfg-acciones"><Badge tono="gray">Desactivada</Badge><Button size="sm" icon="shield" onClick={() => setActivar(true)}>Activar</Button></div>}>
        <small>{s.dosFactoresActivo
          ? `Activa${s.dosFactoresDesde ? ` desde el ${fechaCorta(s.dosFactoresDesde)}` : ''} · ${s.codigosRecuperacion} código${s.codigosRecuperacion === 1 ? '' : 's'} de recuperación disponible${s.codigosRecuperacion === 1 ? '' : 's'}`
          : 'Capa extra de seguridad: además de tu contraseña, te pediremos un código de tu teléfono al iniciar sesión.'}</small>
      </Fila>
      {activar && <Activar2fa onClose={() => setActivar(false)} onActivada={onCambio} />}
      <Desactivar2fa abierto={desactivar} onClose={() => setDesactivar(false)} onListo={(n) => { onCambio(n); setDesactivar(false) }} />
    </>
  )
}

/** Asistente: (1) escanear el QR o escribir la clave, (2) confirmar con un código, (3) guardar los 8 códigos de recuperación (se muestran una sola vez). */
function Activar2fa({ onClose, onActivada }: { onClose: () => void; onActivada: (s: SeguridadCuenta) => void }) {
  const toast = useToast()
  // Una sola petición aunque React monte el asistente dos veces (StrictMode en desarrollo): si no, se generarían dos claves distintas.
  const pedido = useRef<Promise<Configuracion2fa> | null>(null)
  const conf = useAsync<Configuracion2fa>(() => (pedido.current ??= api.iniciar2fa()), [])
  const [manual, setManual] = useState(false)
  const [codigo, setCodigo] = useState('')
  const [error, setError] = useState('')
  const [confirmando, setConfirmando] = useState(false)
  const [codigos, setCodigos] = useState<string[] | null>(null)
  const [guardados, setGuardados] = useState(false)

  const confirmar = async () => {
    if (!/^\d{6}$/.test(codigo)) { setError('Ingresa los 6 dígitos que muestra tu aplicación.'); return }
    setError(''); setConfirmando(true)
    try { const r = await api.confirmar2fa(codigo); setCodigos(r.codigosRecuperacion); onActivada(r.seguridad); toast.ok('¡Verificación en dos pasos activada!') }
    catch (e) { setError((e as Error).message); setCodigo('') } finally { setConfirmando(false) }
  }
  const copiar = async (texto: string, msg: string) => {
    try { await navigator.clipboard.writeText(texto); toast.ok(msg) } catch { toast.error('No se pudo copiar. Selecciona el texto y cópialo a mano.') }
  }
  const descargar = () => {
    const texto = ['LicitaWatch · Códigos de recuperación de la verificación en dos pasos', `Generados el ${new Date().toLocaleString('es-CL')}`, '',
      'Cada código sirve una sola vez si no tienes tu teléfono.', '', ...(codigos ?? [])].join('\n')
    const url = URL.createObjectURL(new Blob([texto], { type: 'text/plain;charset=utf-8' }))
    const a = document.createElement('a'); a.href = url; a.download = 'licitawatch-codigos-recuperacion.txt'
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 5000)
  }

  if (codigos) return (
    <Modal abierto onClose={() => { if (guardados) onClose() }} titulo="Guarda tus códigos de recuperación" ancho={560}
      pie={<Button icon="check" disabled={!guardados} onClick={onClose}>Listo</Button>}>
      <div className="stack dosf">
        <div className="alert alert-warn"><Icon name="alert" size={18} />Esta es la única vez que verás estos códigos. Si pierdes tu teléfono, cada uno te permite entrar una vez.</div>
        <ol className="dosf-codigos">{codigos.map((c) => <li key={c}><code>{c}</code></li>)}</ol>
        <div className="cfg-acciones dosf-izq">
          <Button size="sm" variant="outline" icon="copy" onClick={() => copiar(codigos.join('\n'), 'Códigos copiados.')}>Copiar</Button>
          <Button size="sm" variant="outline" icon="download" onClick={descargar}>Descargar (.txt)</Button>
        </div>
        <label className="cfg-check"><input type="checkbox" checked={guardados} onChange={(e) => setGuardados(e.target.checked)} />Guardé mis códigos en un lugar seguro</label>
      </div>
    </Modal>
  )

  return (
    <Modal abierto onClose={onClose} titulo="Activa la verificación en dos pasos" ancho={640}
      pie={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button icon="shield" loading={confirmando} disabled={!conf.data || codigo.length !== 6} onClick={confirmar}>Activar 2FA</Button></>}>
      {conf.loading ? <Cargando /> : !conf.data ? <EmptyState icon="alert" titulo="No pudimos iniciar la activación" texto={conf.error ?? undefined} /> : (
        <div className="stack dosf">
          <div><b>Protege tu cuenta en 3 pasos</b><p className="muted-p">Solo necesitas una aplicación de autenticación en tu teléfono.</p></div>
          <ol className="dosf-pasos">
            <li>Abre tu aplicación de autenticación (Google Authenticator, Microsoft Authenticator u otra).</li>
            <li>Elige <b>escanear un código QR</b>.</li>
            <li>Escanea este código y escribe el número de 6 dígitos que aparecerá en tu teléfono.</li>
          </ol>
          <div className="dosf-centro">
            <a className="btn btn-primary btn-sm" href={conf.data.otpauthUri}><Icon name="external" size={15} />Abrir en mi autenticador</a>
            <small className="muted-p">Si estás en tu teléfono y ya tienes una aplicación compatible, te preguntará con cuál abrirla.</small>
          </div>
          <div className="dosf-tiendas">
            <p><b>¿Aún no tienes una aplicación?</b> Descarga Google Authenticator. En el computador, escanea el QR de tu teléfono; en el teléfono, usa el botón.</p>
            <div>
              {([['Android', conf.data.urlAndroid, conf.data.qrAndroid], ['iPhone', conf.data.urlIos, conf.data.qrIos]] as const).map(([so, url, qr]) => (
                <div key={so} className="dosf-tienda">
                  {qr && <img src={qr} alt={`QR para descargar Google Authenticator en ${so}`} width={110} height={110} />}
                  <a className="btn btn-outline btn-sm" href={url} target="_blank" rel="noreferrer">Descargar para {so}</a>
                </div>
              ))}
            </div>
          </div>
          <div className="dosf-qr">
            {conf.data.qr ? <img src={conf.data.qr} alt="Código QR para vincular tu aplicación de autenticación" width={220} height={220} />
              : <div className="dosf-qr-mock"><Icon name="grid" size={36} /><small>En el modo simulado no se dibuja el QR: usa la clave manual.</small></div>}
          </div>
          <div className="dosf-centro">
            <button type="button" className="link-btn" onClick={() => setManual(!manual)}>¿No puedes escanear el código?</button>
            {manual && (
              <div className="dosf-clave">
                <small>Escribe esta clave en tu aplicación (tipo «basada en tiempo»):</small>
                <code>{conf.data.clave}</code>
                <Button size="sm" variant="ghost" icon="copy" onClick={() => copiar(conf.data!.clave.replace(/ /g, ''), 'Clave copiada.')}>Copiar clave</Button>
              </div>
            )}
          </div>
          <Field label="Código de 6 dígitos" required error={error} hint="Solo se activará cuando confirmemos este código.">
            <Input className="dosf-codigo" inputMode="numeric" autoComplete="one-time-code" value={codigo} placeholder="000000"
              onChange={(e) => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 6))} onKeyDown={(e) => e.key === 'Enter' && confirmar()} />
          </Field>
        </div>
      )}
    </Modal>
  )
}

/** Desactivar la 2FA: contraseña y un código vigente (de la app o de recuperación). */
function Desactivar2fa({ abierto, onClose, onListo }: { abierto: boolean; onClose: () => void; onListo: (s: SeguridadCuenta) => void }) {
  const toast = useToast()
  const [password, setPassword] = useState('')
  const [codigo, setCodigo] = useState('')
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)
  useEffect(() => { if (!abierto) { setPassword(''); setCodigo(''); setError('') } }, [abierto])
  const enviar = async () => {
    if (!password || !codigo.trim()) { setError('Ingresa tu contraseña y un código.'); return }
    setError(''); setEnviando(true)
    try { onListo(await api.desactivar2fa(password, codigo.trim())); toast.ok('Desactivaste la verificación en dos pasos.') }
    catch (e) { setError((e as Error).message) } finally { setEnviando(false) }
  }
  return (
    <Modal abierto={abierto} onClose={onClose} titulo="Desactivar la verificación en dos pasos" ancho={460}
      pie={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button variant="danger" loading={enviando} onClick={enviar}>Desactivar</Button></>}>
      <div className="stack cfg-modal">
        <p className="muted-p">Tu cuenta quedará protegida solo con la contraseña. Para confirmar, ingresa tu contraseña y un código vigente.</p>
        <Field label="Contraseña" required><Input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
        <Field label="Código de la aplicación o de recuperación" required hint="6 dígitos de tu app, o uno de tus códigos XXXX-XXXX.">
          <Input value={codigo} autoComplete="one-time-code" onChange={(e) => setCodigo(e.target.value.toUpperCase().slice(0, 9))} onKeyDown={(e) => e.key === 'Enter' && enviar()} />
        </Field>
        {error && <div className="alert alert-err"><Icon name="alert" size={18} />{error}</div>}
      </div>
    </Modal>
  )
}
