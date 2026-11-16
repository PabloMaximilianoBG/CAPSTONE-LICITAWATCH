import type { ReactNode } from 'react'
import type { Licitacion } from '../../api/types'
import { Badge, Card, CardHeader, Progress, type Tono } from '../ui/ui'
import { Link } from '../../lib/router'
import { Icon, type IconName } from '../../lib/icons'
import { diasHasta, fechaCorta } from '../../lib/format'
import { CuentaRegresiva, conReloj } from './CuentaRegresiva'

/* Tarjetas compartidas de los paneles de control del Licitador y de la Pyme (mismo diseño en ambos). */

const tonoCierre = (d: number): Tono => (d > 3 ? 'green' : d >= 1 ? 'amber' : 'red')

/** Lista de licitaciones con la cuenta regresiva al cierre (verde > 3 días, ámbar 1–3, rojo hoy). vacio = texto si no hay ninguna. */
export function ListaCierres({ licitaciones, vacio, detalle }: { licitaciones: Licitacion[]; vacio: ReactNode; detalle?: (l: Licitacion) => string }) {
  if (!licitaciones.length) return <p className="muted-p dash-vacio">{vacio}</p>
  return (
    <ul className="dash-lista">
      {licitaciones.map((l) => {
        const d = diasHasta(l.fechaCierre)
        return (
          <li key={l.id}>
            <Link to={`/app/licitacion/${l.id}`} className="dash-item">
              <div><b title={l.titulo}>{l.titulo}</b><small>{detalle ? detalle(l) : `Cierra el ${fechaCorta(l.fechaCierre)}`}</small></div>
              <Badge tono={tonoCierre(d)}>{conReloj(l.fechaCierre) ? <CuentaRegresiva hasta={l.fechaCierre} prefijo="" /> : `${d} día${d === 1 ? '' : 's'}`}</Badge>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}

export interface Paso { ok: boolean; texto: string; to: string }

/** «Primeros pasos»: avance y lista con check; los pendientes son enlaces. Con todo completo lo celebra. */
export function PrimerosPasosCard({ pasos }: { pasos: Paso[] }) {
  const hechos = pasos.filter((x) => x.ok).length
  return (
    <Card>
      <CardHeader icon="checkcircle" title="Primeros pasos" subtitle={hechos === pasos.length ? '¡Todo listo! Tu cuenta está completa.' : `${hechos} de ${pasos.length} completados`} />
      <Progress valor={hechos} max={pasos.length} tono={hechos === pasos.length ? 'accent' : 'amber'} />
      <ul className="dash-pasos">
        {pasos.map((x) => (
          <li key={x.texto} className={x.ok ? 'ok' : ''}>
            <span className="dash-check"><Icon name={x.ok ? 'check' : 'chevright'} size={13} /></span>
            {x.ok ? <span>{x.texto}</span> : <Link to={x.to}>{x.texto}</Link>}
          </li>
        ))}
      </ul>
    </Card>
  )
}

export interface Acceso { to: string; label: string; icon: IconName; bloqueado?: boolean }

/** «Accesos rápidos»: grilla de 2 columnas; bloqueado muestra un candado (p. ej. LicitAsist en el plan Estándar). */
export function AccesosRapidosCard({ accesos }: { accesos: Acceso[] }) {
  return (
    <Card>
      <CardHeader icon="zap" title="Accesos rápidos" />
      <div className="dash-accesos">
        {accesos.map((a) => (
          <Link key={a.to} to={a.to} className="dash-acceso">
            <Icon name={a.icon} size={18} /><span>{a.label}</span>
            {a.bloqueado && <Icon name="lock" size={12} className="dash-candado" />}
          </Link>
        ))}
      </div>
    </Card>
  )
}
