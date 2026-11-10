import { useState, type ReactNode } from 'react'
import { api } from '../../api'
import { ApiError } from '../../api/errors'
import type { Licitacion, Perfil } from '../../api/types'
import { Badge, Button, Card, CardHeader, useAsync } from '../../components/ui/ui'
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

export function TenderDetailPyme({ l, perfil, documentos, postular, publicadaPor }: {
  l: Licitacion
  perfil: Perfil
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
          <DondeSeEjecuta l={l} regionPyme={regionPyme} />
        </div>
        <div className="stack">
          <Compatibilidad l={l} perfil={perfil} regionPyme={regionPyme} />
          {postular}
          {publicadaPor}
          <LineaDeTiempo l={l} total={l.postulantes} dias={dias} abierta={abierta} adjudicacion={ADJ_PYME} />
        </div>
      </div>
      <Similares l={l} />
    </>
  )
}

function Compatibilidad({ l, perfil, regionPyme }: { l: Licitacion; perfil: Perfil; regionPyme?: number }) {
  const cat = useCatalogos()
  const { pct, chips } = compatibilidad(l, perfil, regionPyme, cat.tamano)
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
      {chips.some((c) => c.aviso) && <p className="pan-nota">Completa tu perfil en <Link to="/app/perfil">Mi perfil</Link> para subir tu compatibilidad.</p>}
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
