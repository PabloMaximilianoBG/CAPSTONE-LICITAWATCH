import { useEffect, useState, type ReactNode } from 'react'
import { api } from '../../api'
import type { SeguridadCuenta, SesionActiva } from '../../api/types'
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
