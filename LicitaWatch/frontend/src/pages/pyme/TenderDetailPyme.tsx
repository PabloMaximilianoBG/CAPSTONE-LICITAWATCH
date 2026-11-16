import { useState, type ReactNode } from 'react'
import { api } from '../../api'
import { ApiError } from '../../api/errors'
import type { Licitacion, Perfil } from '../../api/types'
import { Badge, Button, Card, CardHeader, Progress, useAsync } from '../../components/ui/ui'
import { TenderCard } from '../../components/app/shared'
import { ChileMap } from '../../components/app/ChileMap'
import { LineaDeTiempo, separarRequisitos } from '../licitador/TenderPanorama'
import { useCatalogos } from '../../context/AuthContext'
import { Donut } from '../../lib/charts'
import { compatibilidad } from '../../lib/compatibilidad'
import { diasHasta, fechaCorta } from '../../lib/format'
import { Icon } from '../../lib/icons'
import { Link, navigate } from '../../lib/router'

/* Detalle de una licitación para la Pyme: compatibilidad, postular (con borrador de IA), confianza del licitador, línea de tiempo, mapa y similares. */

const ADJ_PYME = { hecha: 'El Licitador eligió a una Pyme y abrió el chat', pendiente: 'El Licitador elige una postulación y se abre el chat con esa Pyme' }

export function TenderDetailPyme({ l, perfil, premium, documentos, postular, publicadaPor }: {
  l: Licitacion
  perfil: Perfil
  /** Plan de la Pyme: Premium ve el detalle de compatibilidad, la competencia y la confianza del Licitador. undefined = cargando. */
  premium?: boolean
  /** Lista de documentos con ver y descargar, tal como la arma TenderDetail. */
  documentos: ReactNode
  /** Tarjeta «Postular» (o «Tu postulación») de TenderDetail. */
  postular: ReactNode
  publicadaPor: ReactNode
}) {
  const cat = useCatalogos()
  const regionPyme = cat.regionDeCiudad(perfil.ciudadId)
  const { texto, requisitos } = separarRequisitos(l.descripcion)
  const dias = diasHasta(l.fechaCierre)
  const abierta = l.estado === 'Abierta' && dias >= 0
  return (
    <>
      <div className="grid-main tdp">
        <div className="stack">
          <Card>
            <CardHeader icon="file" title="Descripción" />
            {texto && <p className="prose">{texto}</p>}
            {requisitos.length > 0 && <>
              <h4 className="tdp-sub">Requisitos para postular</h4>
              <ul className="pan-checks">{requisitos.map((r, i) => <li key={i}><Icon name="checkcircle" size={16} />{r}</li>)}</ul>
            </>}
          </Card>
          <Card>
            <CardHeader icon="paperclip" title={`Documentos adjuntos${l.documentos.length ? ` (${l.documentos.length})` : ''}`} />
            {documentos}
          </Card>
          <div className="grid-2-eq tdp-fila">
            <DondeSeEjecuta l={l} regionPyme={regionPyme} />
            <LineaDeTiempo l={l} total={l.postulantes} dias={dias} abierta={abierta} adjudicacion={ADJ_PYME} />
          </div>
          {publicadaPor}
        </div>
        <div className="stack">
          <Compatibilidad l={l} perfil={perfil} regionPyme={regionPyme} premium={premium} />
          <Competencia l={l} premium={premium} />
          {postular}
        </div>
      </div>
      <Similares l={l} />
    </>
  )
}

/** Aviso corto de función Premium (candado + frase + enlace a Mi suscripción); nunca un bloque grande vacío. */
export function SoloPremium({ children }: { children: ReactNode }) {
  return <p className="tdp-premium"><Icon name="lock" size={13} /><span>{children} <Link to="/app/suscripcion">Mejorar plan</Link></span></p>
}

function Compatibilidad({ l, perfil, regionPyme, premium }: { l: Licitacion; perfil: Perfil; regionPyme?: number; premium?: boolean }) {
  const cat = useCatalogos()
  const todo = compatibilidad(l, perfil, regionPyme, cat.tamano)
  const pct = todo.pct
  // Estándar: el % y si calza rubro y región. Premium: además el tamaño ideal y qué le falta del perfil.
  const chips = premium ? todo.chips : todo.chips.slice(0, 2)
  const color = pct >= 70 ? 'var(--green)' : pct >= 40 ? 'var(--amber)' : 'var(--red)'
  return (
    <Card>
      <CardHeader icon="sparkles" title="Compatibilidad contigo" />
      <div className="tdp-compat">
        <Donut leyenda={false} centro={`${pct}%`} subtitulo="compatible"
          segmentos={[{ etiqueta: 'Compatible', valor: pct, color }, { etiqueta: 'Resto', valor: 100 - pct, color: 'var(--surface-2)' }]} />
        <div className="tdp-chips">
          {chips.map((c) => <Badge key={c.texto} tono={c.aviso ? 'amber' : c.ok ? 'green' : 'gray'} icon={c.aviso ? 'alert' : c.ok ? 'check' : 'x'}>{c.texto}</Badge>)}
        </div>
      </div>
      {premium === false
        ? <SoloPremium>El detalle (tamaño ideal y qué te falta del perfil) es parte de Premium.</SoloPremium>
        : chips.some((c) => c.aviso) && <p className="pan-nota">Completa tu perfil en <Link to="/app/perfil">Mi perfil</Link> para subir tu compatibilidad.</p>}
    </Card>
  )
}

/** Competencia (Premium): postulaciones recibidas, cupos que quedan e indicador baja / media / alta. Estándar: solo el aviso. */
function Competencia({ l, premium }: { l: Licitacion; premium?: boolean }) {
  if (premium === undefined) return null
  if (!premium) return (
    <Card>
      <CardHeader icon="users" title="Competencia" />
      <SoloPremium>Mira cuántas Pymes compiten, los cupos que quedan y qué tan reñida está.</SoloPremium>
    </Card>
  )
  const n = l.postulantes, max = l.maxPostulantes
  const quedan = max ? Math.max(0, max - n) : undefined
  const ratio = max ? n / max : undefined
  const nivel = ratio != null ? (ratio < 0.4 ? 0 : ratio < 0.75 ? 1 : 2) : n <= 2 ? 0 : n <= 6 ? 1 : 2
  const NIVELES = [
    { t: 'Baja', tono: 'green' as const, d: 'Buen momento para postular: aún hay pocas propuestas.' },
    { t: 'Media', tono: 'amber' as const, d: 'Ya hay varias propuestas: destaca tu experiencia en el mensaje.' },
    { t: 'Alta', tono: 'red' as const, d: max && quedan === 0 ? 'Se completaron los cupos.' : 'Muchas propuestas: un mensaje a la medida marca la diferencia.' },
  ]
  return (
    <Card>
      <CardHeader icon="users" title="Competencia" action={<Badge tono={NIVELES[nivel].tono}>{NIVELES[nivel].t}</Badge>} />
      <div className="tdp-confianza tdp-competencia">
        <div><b>{n}</b><span>Postulaci{n === 1 ? 'ón' : 'ones'}</span></div>
        <div><b>{quedan ?? '∞'}</b><span>{max ? `Cupos libres de ${max}` : 'Sin límite de cupos'}</span></div>
      </div>
      {max ? <Progress valor={n} max={max} tono={nivel === 2 ? 'red' : nivel === 1 ? 'amber' : 'accent'} /> : null}
      <p className="pan-nota">{NIVELES[nivel].d}</p>
    </Card>
  )
}

/**
 * «Redactar con IA» dentro de la tarjeta Postular. Premium: pide el borrador a LicitAsist y lo deja en el cuadro de mensaje.
 * Estándar: botón bloqueado con enlace a Mi suscripción (el backend igual responde 403).
 */
export function RedactarConIA({ licitacionId, premium, onBorrador }: { licitacionId: number; premium: boolean; onBorrador: (texto: string) => void }) {
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [bloqueado, setBloqueado] = useState(false)   // el backend respondió 403 aunque el front creía que era Premium
  if (!premium || bloqueado) return (
    <div className="tdp-ia bloqueado">
      <Button size="sm" variant="soft" icon="lock" disabled>Redactar con IA</Button>
      <p>Redactar con IA es un beneficio Premium. Mejora tu plan para usarlo. <Link to="/app/suscripcion">Ir a Mi suscripción</Link></p>
    </div>
  )
  const redactar = async () => {
    setCargando(true); setError(null); setAviso(null)
    try {
      const b = await api.redactarPostulacion(licitacionId)
      onBorrador(b.texto)
      setAviso(b.ia ? 'Borrador listo. Revísalo y edítalo antes de enviar.' : 'La IA no respondió: te dejamos una plantilla base. Completa los textos entre [corchetes].')
    } catch (e) {
      if (e instanceof ApiError && e.status === 403) setBloqueado(true)   // el plan cambió: el backend manda
      else setError((e as Error).message || 'No pudimos redactar el borrador. Intenta de nuevo.')
    } finally { setCargando(false) }
  }
  return (
    <div className="tdp-ia">
      <Button size="sm" variant="soft" icon="sparkles" loading={cargando} onClick={redactar}>{cargando ? 'Redactando…' : 'Redactar con IA'}</Button>
      {aviso && <p>{aviso}</p>}
      {error && <p className="err">{error}</p>}
    </div>
  )
}

/** Confianza del licitador (va dentro de «Publicada por»): solo conteos y desde cuándo está en LicitaWatch. */
export function ConfianzaLicitador({ licitadorId }: { licitadorId: number }) {
  const c = useAsync(() => api.confianzaLicitador(licitadorId), [licitadorId])
  if (c.loading || !c.data) return null   // sin datos, la tarjeta se ve como antes
  return (
    <div className="tdp-confianza">
      <div><b>{c.data.publicadas}</b><span>Publicadas</span></div>
      <div><b>{c.data.adjudicadas}</b><span>Adjudicadas</span></div>
      <div><b>{fechaCorta(c.data.desde)}</b><span>En la plataforma desde</span></div>
    </div>
  )
}

function DondeSeEjecuta({ l, regionPyme }: { l: Licitacion; regionPyme?: number }) {
  const cat = useCatalogos()
  const misma = regionPyme === l.regionId
  return (
    <Card>
      <CardHeader icon="pin" title="Dónde se ejecuta" action={misma ? <Badge tono="green" icon="check">Misma región</Badge> : undefined} />
      <div className="tdp-mapa">
        <ChileMap regionId={l.regionId} marcador={regionPyme} nombreRegion={cat.region} alto={240} />
        <ul className="tdp-leyenda">
          <li><span className="sw sel" /><div><b>{cat.region(l.regionId)}</b><small>Región de ejecución</small></div></li>
          {regionPyme && <li><span className="sw mk" /><div><b>{cat.region(regionPyme)}</b><small>Tu empresa{misma ? ' · estás en la misma región' : ''}</small></div></li>}
        </ul>
      </div>
    </Card>
  )
}

/** Hasta 3 licitaciones abiertas del mismo rubro (si faltan, de la misma región), sin la actual. Usa el listado con filtros. */
function Similares({ l }: { l: Licitacion }) {
  const sim = useAsync(async () => {
    const vigente = (x: Licitacion) => x.id !== l.id && diasHasta(x.fechaCierre) >= 0
    const lista = (await api.licitaciones({ rubroId: l.rubroId, estado: 'Abierta' })).filter(vigente)
    if (lista.length < 3) lista.push(...(await api.licitaciones({ regionId: l.regionId, estado: 'Abierta' })).filter((x) => vigente(x) && !lista.some((y) => y.id === x.id)))
    return lista.slice(0, 3)
  }, [l.id])
  if (!sim.data?.length) return null
  return (
    <section className="tdp-similares">
      <div className="tdp-similares-t"><h3>Licitaciones similares</h3><button type="button" className="link-btn" onClick={() => navigate('/app/explorar')}>Ver todas</button></div>
      <div className="tgrid tgrid-3">{sim.data.map((x) => <TenderCard key={x.id} l={x} />)}</div>
    </section>
  )
}
