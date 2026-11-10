import type { ReactNode } from 'react'
import { api } from '../../api'
import type { Licitacion, Postulacion, PulsoLicitacion, RadarPymes } from '../../api/types'
import { Avatar, Badge, Card, CardHeader, EmptyState, Progress, tonoEstado, useAsync, type Tono } from '../../components/ui/ui'
import { ChileMap } from '../../components/app/ChileMap'
import { useCatalogos } from '../../context/AuthContext'
import { Icon } from '../../lib/icons'
import { clp, diasHasta, duracionTexto, fechaCorta } from '../../lib/format'

/* Vista panorámica del detalle de una licitación para su Licitador dueño (los demás roles ven el detalle de siempre). */

const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

/**
 * Separa la sección «REQUISITOS PARA POSTULAR» de la descripción: devuelve sus ítems (líneas con -, •, * o numeración)
 * y el resto del texto. Sin la sección (o sin ítems) devuelve la descripción completa.
 */
export function separarRequisitos(descripcion: string): { texto: string; requisitos: string[] } {
  const lineas = descripcion.split('\n')
  const ini = lineas.findIndex((x) => /^\s*REQUISITOS PARA POSTULAR\s*:?\s*$/i.test(x))
  if (ini < 0) return { texto: descripcion, requisitos: [] }
  const requisitos: string[] = []
  let fin = ini + 1
  for (; fin < lineas.length; fin++) {
    const m = lineas[fin].match(/^\s*(?:[-•*]|\d+[.)])\s+(.+)$/)
    if (m) requisitos.push(m[1].trim())
    else if (lineas[fin].trim() || requisitos.length) break   // termina en la primera línea que no es ítem (las líneas vacías antes del primer ítem se saltan)
  }
  if (!requisitos.length) return { texto: descripcion, requisitos: [] }
  const texto = [...lineas.slice(0, ini), ...lineas.slice(fin)].join('\n').replace(/\n{3,}/g, '\n\n').trim()
  return { texto, requisitos }
}

/** «hoy», «ayer» o «hace N días» por día calendario (fecha_postulacion no guarda la hora). */
function haceDias(iso: string): string {
  const d = new Date(iso); d.setHours(0, 0, 0, 0)
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
  const n = Math.round((hoy.getTime() - d.getTime()) / 86_400_000)
  return n <= 0 ? 'hoy' : n === 1 ? 'ayer' : `hace ${n} días`
}

function Dato({ label, valor }: { label: string; valor: ReactNode }) {
  return <div className="pan-dato"><span>{label}</span><b>{valor}</b></div>
}

export function TenderPanorama({ l, postulaciones, documentos, accionDocumentos, gestion, publicadaPor, listaPostulaciones, onVer }: {
  l: Licitacion
  postulaciones: Postulacion[]
  /** Lista de documentos (con ver, descargar y quitar) y el botón para agregar, tal como los arma TenderDetail. */
  documentos: ReactNode
  accionDocumentos?: ReactNode
  gestion: ReactNode
  publicadaPor: ReactNode
  /** Lista completa de postulaciones con sus acciones (aprobar, rechazar, adjudicar). */
  listaPostulaciones: ReactNode
  onVer: (p?: Postulacion) => void
}) {
  const cat = useCatalogos()
  // El pulso se recalcula cuando cambia alguna postulación (al aprobar o rechazar).
  const firma = postulaciones.map((p) => `${p.id}:${p.estado}`).join(',')
  const pulso = useAsync(() => api.pulsoLicitacion(l.id), [l.id, firma])
  const radar = useAsync(() => api.radarPymes(l.rubroId, l.regionId), [l.rubroId, l.regionId])
  const { texto, requisitos } = separarRequisitos(l.descripcion)
  const total = postulaciones.length
  const dias = diasHasta(l.fechaCierre)
  const abierta = l.estado === 'Abierta' && dias >= 0

  return (
    <div className="pan-grid">
      {/* ---------- Fila 1: detalle + columna lateral ---------- */}
      <Card className="pan-span-2 pan-detalle">
        <div className="pan-detalle-top">
          <div className="td-badges">
            <Badge tono={tonoEstado(l.estado)} dot>{l.estado}</Badge>
            <Badge tono="gray" icon="tag">{cat.rubro(l.rubroId)}</Badge>
            <Badge tono="gray" icon="pin">{cat.region(l.regionId)}</Badge>
          </div>
          <small>Licitación #{l.id}</small>
        </div>
        <h1>{l.titulo}</h1>
        {texto && <p className="prose">{texto}</p>}
        <div className="pan-datos">
          <Dato label="Presupuesto máx." valor={clp(l.presupuestoMax ?? l.presupuestoMin)} />
          <Dato label="Postulaciones" valor={l.maxPostulantes ? `${total} de ${l.maxPostulantes}` : `${total} · sin límite`} />
          <Dato label="Cierre" valor={fechaCorta(l.fechaCierre)} />
          <Dato label="Documentos" valor={l.documentos.length === 0 ? 'Sin archivos' : `${l.documentos.length} archivo${l.documentos.length === 1 ? '' : 's'}`} />
          <Dato label="Rubro" valor={cat.rubro(l.rubroId)} />
          <Dato label="Región" valor={cat.region(l.regionId)} />
          <Dato label="Duración del proyecto" valor={l.duracionMeses ? duracionTexto(l.duracionMeses) : 'Sin definir'} />
          <Dato label="Publicada el" valor={fechaCorta(l.createdAt)} />
        </div>
        <div className={`pan-req-docs ${requisitos.length ? '' : 'solo-docs'}`}>
          {requisitos.length > 0 && (
            <div>
              <h4>Requisitos para postular</h4>
              <ul className="pan-checks">{requisitos.map((r, i) => <li key={i}><Icon name="checkcircle" size={16} />{r}</li>)}</ul>
            </div>
          )}
          <div>
            <div className="pan-sub"><h4>Documentos</h4>{accionDocumentos}</div>
            {documentos}
          </div>
        </div>
      </Card>
      <div className="pan-lateral">
        {gestion}
        {publicadaPor}
        <Presupuesto min={l.presupuestoMin} max={l.presupuestoMax} />
      </div>

      {/* ---------- Fila 2: línea de tiempo, radar, cupos y pulso ---------- */}
      <LineaDeTiempo l={l} total={total} dias={dias} abierta={abierta} />
      <Radar radar={radar.data} cargando={radar.loading} l={l} postulaciones={postulaciones} />
      <CuposYPulso pulso={pulso.data} cargando={pulso.loading} />

      {/* ---------- Fila 3: postulaciones recientes y embudo ---------- */}
      <Card className="pan-span-2">
        <CardHeader icon="users" title="Postulaciones recientes"
          action={total > 0 ? <button type="button" className="link-btn" onClick={() => onVer()}>Ver todas ({total})</button> : undefined} />
        {total === 0 ? <EmptyState icon="inbox" titulo="Aún no hay postulaciones" texto="Cuando una Pyme postule, la verás aquí." /> : (
          <>
            <ul className="pan-recientes">
              {[...postulaciones].sort((a, b) => b.fecha.localeCompare(a.fecha) || b.id - a.id).slice(0, 3).map((p) => (
                <li key={p.id}>
                  <Avatar nombre={p.pymeNombre} size={38} />
                  <div className="pan-rec-main">
                    <b>{p.pymeNombre} {p.premium && <Badge tono="teal" icon="crown">Premium</Badge>}</b>
                    <small>{p.pymeCiudadId ? `${cat.ciudad(p.pymeCiudadId)} · ` : ''}{cat.rubro(p.pymeRubroId)}</small>
                  </div>
                  <div className="pan-rec-chips">
                    {p.pymeTamanoId && <Badge tono="gray">{cat.tamano(p.pymeTamanoId)}</Badge>}
                    <Badge tono={tonoEstado(p.estado)} dot>{p.estado}</Badge>
                    <small>{haceDias(p.fecha)}</small>
                    <button type="button" className="link-btn" onClick={() => onVer(p)}>Ver</button>
                  </div>
                </li>
              ))}
            </ul>
            <p className="pan-nota">Ordenadas de la más reciente a la más antigua. Entra a cada una para ver el mensaje de la Pyme.</p>
          </>
        )}
      </Card>
      <Embudo pulso={pulso.data} total={total} />

      {/* Lista completa (con aprobar, rechazar y adjudicar): destino de «Ver todas» y «Ver». */}
      <div className="pan-span-3">{listaPostulaciones}</div>
    </div>
  )
}

function Presupuesto({ min, max }: { min?: number; max?: number }) {
  return (
    <Card>
      <CardHeader icon="dollar" title="Presupuesto referencial" />
      {min == null && max == null ? <p className="muted-p">Presupuesto a convenir con las Pymes.</p> : (
        <>
          <div className="pan-rango"><div className={min == null ? 'solo-max' : ''} /></div>
          <div className="pan-rango-ext">
            {min != null && <div><span>Mínimo</span><b>{clp(min)}</b></div>}
            {max != null && <div className="der"><span>Máximo</span><b>{clp(max)}</b></div>}
          </div>
          <p className="pan-nota">{min != null && max != null ? 'Las Pymes ofertan dentro de este rango.' : 'Las Pymes ofertan hasta este monto.'}</p>
        </>
      )}
    </Card>
  )
}

/** Textos del paso «Adjudicación» según quién mira (por defecto, el Licitador dueño). */
const ADJ_LICITADOR = { hecha: 'Adjudicada: ya se abrió el chat con la Pyme', pendiente: 'Apruebas a la Pyme elegida y se abre el chat' }

export function LineaDeTiempo({ l, total, dias, abierta, adjudicacion = ADJ_LICITADOR }: {
  l: Licitacion; total: number; dias: number; abierta: boolean; adjudicacion?: { hecha: string; pendiente: string }
}) {
  const adjudicada = l.estado === 'Adjudicada'
  const cerrada = !abierta   // cerrada a mano, adjudicada o pasada la fecha de cierre (el backend ya la entrega como «Cerrada»)
  const tono: Tono = dias > 3 ? 'green' : dias >= 1 ? 'amber' : 'red'
  // estado de cada paso: hecho, actual o pendiente
  const pasos: { t: string; d: string; e: 'hecho' | 'actual' | 'pendiente' }[] = [
    { t: 'Publicada', d: fechaCorta(l.createdAt), e: 'hecho' },
    { t: 'Recibiendo postulaciones', d: abierta ? `${total} recibida${total === 1 ? '' : 's'} · cierra ${dias === 0 ? 'hoy' : `en ${dias} día${dias === 1 ? '' : 's'}`}` : `${total} recibida${total === 1 ? '' : 's'}`, e: abierta ? 'actual' : 'hecho' },
    { t: 'Cierre', d: fechaCorta(l.fechaCierre), e: cerrada ? 'hecho' : 'pendiente' },
    // Aprobar una postulación adjudica la licitación y solo se puede mientras está abierta (regla del backend).
    { t: 'Adjudicación', d: adjudicada ? adjudicacion.hecha : cerrada ? 'Cerró sin adjudicar' : adjudicacion.pendiente, e: adjudicada ? 'hecho' : 'pendiente' },
  ]
  return (
    <Card className="pan-alto">
      <CardHeader icon="clock" title="Línea de tiempo"
        action={abierta ? <Badge tono={tono}>{dias < 1 ? 'Cierra hoy' : `Cierra en ${dias} día${dias === 1 ? '' : 's'}`}</Badge> : <Badge tono={tonoEstado(l.estado)}>{l.estado === 'Abierta' ? 'Cerrada' : l.estado}</Badge>} />
      <ol className="pan-linea">
        {pasos.map((p) => (
          <li key={p.t} className={p.e}>
            <span className="pan-hito">{p.e === 'hecho' && <Icon name="check" size={11} />}</span>
            <div><b>{p.t} {p.e === 'actual' && <Badge tono="blue">Ahora</Badge>}</b><small>{p.d}</small></div>
          </li>
        ))}
      </ol>
      <p className="pan-nota">Cierre automático: al llegar a la fecha{l.maxPostulantes ? <> o a los <b>{l.maxPostulantes} cupos</b></> : ''}.</p>
    </Card>
  )
}

function Radar({ radar, cargando, l, postulaciones }: { radar: RadarPymes | null; cargando: boolean; l: Licitacion; postulaciones: Postulacion[] }) {
  const cat = useCatalogos()
  const origenes: Record<number, number> = {}
  postulaciones.forEach((p) => { const r = cat.regionDeCiudad(p.pymeCiudadId); if (r) origenes[r] = (origenes[r] ?? 0) + 1 })
  const ya = radar ? postulaciones.filter((p) => radar.pymeIds.includes(p.pymeId)).length : 0
  const maxTam = radar ? Math.max(1, ...Object.values(radar.porTamano)) : 1
  return (
    <Card className="pan-alto">
      <CardHeader icon="users" title="Radar de Pymes" />
      <div className="pan-radar">
        <ChileMap regionId={l.regionId} origenes={origenes} nombreRegion={(id) => cat.region(id)} alto={190} />
        <div className="pan-radar-datos">
          {cargando ? <p className="muted-p">Calculando…</p> : !radar ? <p className="muted-p">No pudimos calcular el radar.</p> : (
            <>
              <p className="pan-radar-num"><b>{radar.total}</b><span>Pyme{radar.total === 1 ? '' : 's'} de <b>{cat.rubro(l.rubroId)}</b> en la región <b>{cat.region(l.regionId)}</b> podría{radar.total === 1 ? '' : 'n'} postular</span></p>
              <ul className="pan-barras">
                {cat.tamanos.map((t) => {
                  const n = radar.porTamano[t.id] ?? 0
                  return <li key={t.id}><span>{t.nombre}</span><div className="pan-barra"><div style={{ width: `${(n / maxTam) * 100}%` }} /></div><b>{n}</b></li>
                })}
              </ul>
              <ul className="pan-leyenda"><li><i className="sel" />Región de la licitación</li><li><i className="punto" />Origen de postulaciones</li></ul>
            </>
          )}
        </div>
      </div>
      {radar && (
        <div className="pan-ya">
          <div><span>Ya postularon</span><b>{ya} de {radar.total}{radar.total ? ` (${Math.round((ya / radar.total) * 100)}%)` : ''}</b></div>
          <div className="pan-barra verde"><div style={{ width: `${radar.total ? (ya / radar.total) * 100 : 0}%` }} /></div>
        </div>
      )}
    </Card>
  )
}

function CuposYPulso({ pulso, cargando }: { pulso: PulsoLicitacion | null; cargando: boolean }) {
  if (!pulso) return <Card className="pan-alto"><CardHeader icon="trending" title="Cupos y pulso" /><p className="muted-p">{cargando ? 'Calculando…' : 'No pudimos cargar el pulso de la licitación.'}</p></Card>
  const semana = pulso.porDia.reduce((s, d) => s + d.valor, 0)
  const ritmo = semana / 7 < 0.5 ? 'bajo' : semana / 7 < 1.5 ? 'moderado' : 'alto'
  const maxDia = Math.max(1, ...pulso.porDia.map((d) => d.valor))
  return (
    <Card className="pan-alto">
      <CardHeader icon="trending" title="Cupos y pulso" />
      {pulso.cupos ? (
        <>
          <div className="pan-cupos"><p><b>{pulso.total}</b> de {pulso.cupos} cupos usados</p><span>{Math.max(0, pulso.cupos - pulso.total)} disponibles</span></div>
          <Progress valor={pulso.total} max={pulso.cupos} tono={pulso.total >= pulso.cupos ? 'red' : 'accent'} />
          <p className="pan-nota">Al llegar a {pulso.cupos}, la licitación deja de recibir postulaciones.</p>
        </>
      ) : <div className="pan-cupos"><p><b>{pulso.total}</b> postulaci{pulso.total === 1 ? 'ón' : 'ones'}</p><span>Sin límite de cupos</span></div>}
      <div className="pan-pulso">
        <i className={pulso.hoy > 0 ? 'vivo' : ''} />
        <div><b>{pulso.hoy} postulaci{pulso.hoy === 1 ? 'ón' : 'ones'} hoy</b><small>Ritmo {ritmo} · {semana} en los últimos 7 días</small></div>
      </div>
      <p className="pan-mini-t">Postulaciones por día</p>
      <div className="pan-dias">
        {pulso.porDia.map((d, i) => (
          <div key={d.fecha} title={`${d.valor} el ${fechaCorta(d.fecha + 'T12:00:00')}`}>
            <div className="pan-dia-col"><div className={i === 6 ? 'hoy' : ''} style={{ height: `${Math.max(d.valor ? 14 : 4, (d.valor / maxDia) * 100)}%` }} /></div>
            <small>{i === 6 ? 'Hoy' : DIAS[new Date(d.fecha + 'T12:00:00').getDay()]}</small>
          </div>
        ))}
      </div>
    </Card>
  )
}

function Embudo({ pulso, total }: { pulso: PulsoLicitacion | null; total: number }) {
  const filas = [{ estado: 'Recibidas', cantidad: total, tono: 'accent' }, ...(pulso?.conteoPorEstado ?? []).map((c) => ({ ...c, tono: tonoEstado(c.estado) as string }))]
  return (
    <Card>
      <CardHeader icon="filter" title="Embudo de postulaciones" />
      <ul className="pan-embudo">
        {filas.map((f) => (
          <li key={f.estado}>
            <div><span>{f.estado}</span><b>{f.cantidad}</b></div>
            <div className={`pan-barra ${f.tono}`}><div style={{ width: `${total ? (f.cantidad / total) * 100 : 0}%` }} /></div>
          </li>
        ))}
      </ul>
      <p className="pan-nota">Revisa las postulaciones y, antes del cierre, <b>adjudica a una Pyme</b>: al aprobar una, las demás pendientes se rechazan.</p>
    </Card>
  )
}
