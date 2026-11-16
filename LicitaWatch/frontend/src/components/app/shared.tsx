import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import type { Licitacion } from '../../api/types'
import { Icon, type IconName } from '../../lib/icons'
import { CuentaRegresiva, conReloj } from './CuentaRegresiva'
import { Link } from '../../lib/router'
import { Badge, tonoEstado } from '../ui/ui'
import { useCatalogos } from '../../context/AuthContext'
import { diasHasta, duracionTexto, hace, rangoPresupuesto } from '../../lib/format'
import { NotifItem, iconoNotificacion, useNotificaciones } from '../layout/AppShell'
import { useAuth } from '../../context/AuthContext'
import { useGuardadas } from '../../lib/guardadas'

/* ---------- Carrusel superior ---------- */
export interface Slide { chip: string; icon: IconName; titulo: string; texto: string; tono: 'blue' | 'teal' | 'violet' | 'green'; to?: string; cta?: string }

/** Segundos que dura cada diapositiva del carrusel. */
const SEG_DIAPOSITIVA = 6
const sinMovimiento = () => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches } catch { return false } }

/**
 * Carrusel de los paneles. Avanza solo cada SEG_DIAPOSITIVA segundos: el punto activo se llena como barra de progreso y, al
 * llenarse, pasa a la siguiente. Con el mouse encima se pausa (la barra se detiene). Al cambiar a mano, el tiempo parte de cero.
 */
export function BannerCarousel({ slides }: { slides: Slide[] }) {
  const [i, setI] = useState(0)
  const [pausa, setPausa] = useState(false)
  const [vuelta, setVuelta] = useState(0)   // reinicia la barra al cambiar a mano (aunque se elija la misma diapositiva)
  const ir = (k: number) => { setI((k + slides.length) % slides.length); setVuelta((v) => v + 1) }
  const siguiente = () => setI((x) => (x + 1) % slides.length)
  // Con «reducir movimiento» no hay barra animada: se avanza con un temporizador simple.
  useEffect(() => {
    if (pausa || !sinMovimiento()) return
    const t = setTimeout(siguiente, SEG_DIAPOSITIVA * 1000)
    return () => clearTimeout(t)
  }, [i, pausa, vuelta]) // eslint-disable-line react-hooks/exhaustive-deps
  const s = slides[i]
  return (
    <section className={`banner banner-${s.tono}`} onMouseEnter={() => setPausa(true)} onMouseLeave={() => setPausa(false)}>
      <div className="banner-orbs"><i /><i /></div>
      <div className="banner-body" key={i}>
        <span className="banner-chip"><Icon name={s.icon} size={14} />{s.chip}</span>
        <h2>{s.titulo}</h2>
        <p>{s.texto}</p>
        {s.to && <Link to={s.to} className="banner-cta">{s.cta ?? 'Ver más'} <Icon name="arrowright" size={16} /></Link>}
      </div>
      {/* Anillo de progreso alrededor del ícono: se completa en SEG_DIAPOSITIVA segundos y, al cerrarse, pasa a la siguiente. */}
      <div className={`banner-anillo ${pausa ? 'pausa' : ''}`} style={{ '--seg': `${SEG_DIAPOSITIVA}s` } as CSSProperties} aria-hidden>
        <svg viewBox="0 0 120 120">
          <circle className="fondo" cx="60" cy="60" r="54" />
          <circle key={`${i}-${vuelta}`} className="avance" cx="60" cy="60" r="54" pathLength={100} onAnimationEnd={siguiente} />
        </svg>
        <Icon name={s.icon} size={48} />
      </div>
      <div className="banner-ctrl">
        <button onClick={() => ir(i - 1)} aria-label="Anterior"><Icon name="chevleft" size={16} /></button>
        <div className="banner-dots">{slides.map((_, k) => <i key={k} className={k === i ? 'on' : ''} onClick={() => ir(k)} />)}</div>
        <button onClick={() => ir(i + 1)} aria-label="Siguiente"><Icon name="chevright" size={16} /></button>
        <small>{i + 1}/{slides.length}</small>
      </div>
    </section>
  )
}

/* ---------- Tarjeta de licitación ---------- */
/** Estrella ⭐ para guardar o quitar una licitación (solo Pyme). */
export function BotonGuardar({ licitacionId, conTexto }: { licitacionId: number; conTexto?: boolean }) {
  const { sesion } = useAuth()
  const { guardada, alternar } = useGuardadas(sesion?.usuario.id)
  if (sesion?.usuario.rol !== 'PYME') return null
  const on = guardada(licitacionId)
  return (
    <button type="button" className={`btn-guardar ${on ? 'on' : ''} ${conTexto ? 'con-texto' : ''}`} aria-pressed={on}
      title={on ? 'Quitar de guardadas' : 'Guardar para revisarla después'}
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); alternar(licitacionId) }}>
      <Icon name="star" size={conTexto ? 16 : 18} />{conTexto && <span>{on ? 'Guardada' : 'Guardar'}</span>}
    </button>
  )
}

export function TenderCard({ l, acciones }: { l: Licitacion; acciones?: ReactNode }) {
  const cat = useCatalogos()
  const dias = diasHasta(l.fechaCierre)
  const urgente = l.estado === 'Abierta' && dias <= 5 && dias >= 0
  return (
    <article className="tcard">
      <BotonGuardar licitacionId={l.id} />
      <Link to={`/app/licitacion/${l.id}`} className="tcard-main">
        <div className="tcard-top">
          <Badge tono={tonoEstado(l.estado)} dot>{l.estado}</Badge>
          <span className="tcard-rubro">{cat.rubro(l.rubroId)}</span>
        </div>
        <h4>{l.titulo}</h4>
        <p className="tcard-emp"><Icon name="building" size={14} />{l.licitadorNombre}</p>
        <div className="tcard-meta">
          <span><Icon name="pin" size={14} />{cat.region(l.regionId)}</span>
          <span><Icon name="dollar" size={14} />{rangoPresupuesto(l.presupuestoMin, l.presupuestoMax)}</span>
          {l.duracionMeses && <span><Icon name="briefcase" size={14} />{duracionTexto(l.duracionMeses)}</span>}
        </div>
        <div className="tcard-foot">
          {l.estado === 'Abierta' && dias >= 0 && conReloj(l.fechaCierre)
            ? <span className={urgente ? 'urg' : ''}><CuentaRegresiva hasta={l.fechaCierre} /></span>
            : <span className={urgente ? 'urg' : ''}><Icon name="clock" size={14} />{l.estado !== 'Abierta' ? 'Finalizada' : dias < 0 ? 'Vencida' : `Cierra en ${dias} día${dias === 1 ? '' : 's'}`}</span>}
          <span><Icon name="users" size={14} />{l.postulantes} postulante{l.postulantes === 1 ? '' : 's'}</span>
        </div>
      </Link>
      {acciones && <div className="tcard-actions">{acciones}</div>}
    </article>
  )
}

/* ---------- Panel de notificaciones (columna derecha) ---------- */
export function NotifPanel({ limite = 4 }: { limite?: number }) {
  const { pendientes, marcar } = useNotificaciones()
  const rol = useAuth().sesion!.usuario.rol
  return (
    <div className="card card-pad notif-panel">
      <div className="card-header">
        <div className="card-title-wrap"><span className="card-title-icon"><Icon name="bell" size={18} /></span><h3 className="card-title">Notificaciones</h3></div>
        <Link to="/app/notificaciones" className="link">Ver todas</Link>
      </div>
      {pendientes.length === 0 ? <p className="muted-p">Todo al día. No tienes notificaciones nuevas.</p> : pendientes.slice(0, limite).map((n) => (
        <NotifItem key={n.id} n={n} rol={rol} className="notif-item unread">
          <span className="notif-ic"><Icon name={iconoNotificacion(n.tipo)} size={16} /></span>
          <div><b>{n.titulo}</b><p>{n.detalle}</p><small>{hace(n.createdAt)}</small></div>
        </NotifItem>
      ))}
      {pendientes.length > 1 && <button className="btn btn-soft btn-sm btn-block" onClick={marcar}>Marcar todas como leídas</button>}
    </div>
  )
}

/* ---------- Filtros de búsqueda ---------- */
export function VolverLink({ to, texto }: { to: string; texto: string }) {
  return <Link to={to} className="back"><Icon name="arrowleft" size={16} /> {texto}</Link>
}
