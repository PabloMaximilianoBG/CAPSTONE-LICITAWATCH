import { useState } from 'react'
import { api } from '../../api'
import { ApiError } from '../../api/errors'
import type { AnalisisLicitacion, RevisionMensaje } from '../../api/types'
import { Badge, Button, Card, CardHeader, Cargando, EmptyState, Modal, useAsync, useToast, type Tono } from '../../components/ui/ui'
import { Donut } from '../../lib/charts'
import { Icon, type IconName } from '../../lib/icons'
import { Link, navigate } from '../../lib/router'
import { rangoPresupuesto } from '../../lib/format'

/* LicitAsist razona por la Pyme (Premium): ¿me conviene postular?, mi plan del mes y revisa mi mensaje. */

const VEREDICTO: Record<AnalisisLicitacion['veredicto'], { t: string; d: string; tono: Tono; icon: IconName }> = {
  'postular': { t: 'Te conviene postular', d: 'Calza bien con tu empresa y tienes buenas opciones.', tono: 'green', icon: 'checkcircle' },
  'con-cuidado': { t: 'Postula con cuidado', d: 'Puede convenirte, pero revisa los puntos marcados antes de enviar.', tono: 'amber', icon: 'alert' },
  'no-postular': { t: 'Mejor no postular', d: 'Hay otras licitaciones donde tus postulaciones rinden más.', tono: 'red', icon: 'xcircle' },
}
const ESTADO_REQ = { 'cumple': { icon: 'checkcircle' as IconName, clase: 'ok' }, 'no-cumple': { icon: 'xcircle' as IconName, clase: 'no' }, 'revisar': { icon: 'help' as IconName, clase: 'rev' } }
const colorPuntaje = (n: number) => (n >= 70 ? 'var(--green)' : n >= 45 ? 'var(--amber)' : 'var(--red)')
const NotaIa = ({ ia }: { ia: boolean }) => (
  <p className="pan-nota"><Icon name={ia ? 'sparkles' : 'info'} size={14} />{ia ? 'Análisis de LicitAsist con IA. Úsalo como apoyo: la decisión es tuya.' : 'Análisis básico del sistema (la IA no respondió en este momento).'}</p>
)

/** Modal «¿Me conviene postular?»: veredicto, puntaje, resumen, requisitos que cumple y riesgos. irAPostular: botón para abrir la licitación. */
export function AnalisisModal({ licitacionId, onClose, irAPostular }: { licitacionId: number; onClose: () => void; irAPostular?: boolean }) {
  const a = useAsync(() => api.analizarLicitacion(licitacionId), [licitacionId])
  const v = a.data ? VEREDICTO[a.data.veredicto] : null
  return (
    <Modal abierto onClose={onClose} titulo="¿Me conviene postular?" ancho={680}
      pie={<><Button variant="ghost" onClick={onClose}>Cerrar</Button>{irAPostular && a.data && <Button icon="send" onClick={() => navigate(`/app/licitacion/${licitacionId}`)}>Ver y postular</Button>}</>}>
      {a.loading ? <div className="lia-pensando"><Cargando texto="LicitAsist está analizando la licitación con tu perfil…" /></div>
        : !a.data || !v ? <EmptyState icon="alert" titulo="No pudimos analizar esta licitación" texto={a.error ?? undefined} /> : (
          <div className="stack lia-analisis">
            <div className={`lia-veredicto tono-${v.tono}`}>
              <Donut leyenda={false} centro={String(a.data.puntaje)} subtitulo="de 100" segmentos={[
                { etiqueta: 'Puntaje', valor: a.data.puntaje, color: colorPuntaje(a.data.puntaje) }, { etiqueta: 'Resto', valor: 100 - a.data.puntaje, color: 'var(--surface-2)' }]} />
              <div>
                <h3><Icon name={v.icon} size={20} />{v.t}</h3>
                <p>{v.d}</p>
                <div className="lia-chips">
                  <Badge tono="gray">Compatibilidad {a.data.compatibilidad}%</Badge>
                  <Badge tono={a.data.competencia === 'Baja' ? 'green' : a.data.competencia === 'Media' ? 'amber' : 'red'}>Competencia {a.data.competencia.toLowerCase()}</Badge>
                  <Badge tono={a.data.diasAlCierre > 3 ? 'green' : a.data.diasAlCierre >= 1 ? 'amber' : 'red'}>{a.data.diasAlCierre < 1 ? 'Cierra hoy' : `Cierra en ${a.data.diasAlCierre} días`}</Badge>
                </div>
              </div>
            </div>
            <div><h4 className="lia-sub">En resumen</h4><p className="prose">{a.data.resumen}</p></div>
            {a.data.requisitos.length > 0 && (
              <div>
                <h4 className="lia-sub">Requisitos frente a tu empresa</h4>
                <ul className="lia-reqs">
                  {a.data.requisitos.map((r, i) => (
                    <li key={i} className={ESTADO_REQ[r.estado].clase}><Icon name={ESTADO_REQ[r.estado].icon} size={17} />
                      <div><b>{r.texto}</b><small>{r.estado === 'cumple' ? 'Cumples' : r.estado === 'no-cumple' ? 'No cumples' : 'Por revisar'} · {r.nota}</small></div></li>
                  ))}
                </ul>
              </div>
            )}
            {a.data.riesgos.length > 0 && (
              <div>
                <h4 className="lia-sub">A tener en cuenta</h4>
                <ul className="lia-riesgos">{a.data.riesgos.map((r) => <li key={r}><Icon name="alert" size={15} />{r}</li>)}</ul>
              </div>
            )}
            <NotaIa ia={a.data.ia} />
          </div>
        )}
    </Modal>
  )
}

/** Botón «¿Me conviene postular?» (Premium) que abre el análisis. */
export function BotonMeConviene({ licitacionId }: { licitacionId: number }) {
  const [abierto, setAbierto] = useState(false)
  return <>
    <Button size="sm" variant="soft" icon="sparkles" onClick={() => setAbierto(true)}>¿Me conviene postular?</Button>
    {abierto && <AnalisisModal licitacionId={licitacionId} onClose={() => setAbierto(false)} />}
  </>
}

/** «Revisa mi mensaje» (Premium), junto a «Redactar con IA» en la tarjeta Postular. onUsar = pegar la versión mejorada en el mensaje. */
export function RevisarMensaje({ licitacionId, mensaje, onUsar }: { licitacionId: number; mensaje: string; onUsar: (texto: string) => void }) {
  const toast = useToast()
  const [r, setR] = useState<RevisionMensaje | null>(null)
  const [cargando, setCargando] = useState(false)
  const listo = mensaje.trim().length >= 30
  const revisar = async () => {
    setCargando(true)
    try { setR(await api.revisarMensaje(licitacionId, mensaje)) }
    catch (e) { toast.error(e instanceof ApiError && e.status === 403 ? 'Revisar tu mensaje es un beneficio Premium.' : (e as Error).message) }
    finally { setCargando(false) }
  }
  return (
    <div className="lia-revision">
      <Button size="sm" variant="soft" icon="checkcircle" loading={cargando} disabled={!listo} onClick={revisar} title={listo ? undefined : 'Escribe al menos unas líneas'}>
        {cargando ? 'Revisando…' : 'Revisar mi mensaje'}
      </Button>
      {r && (
        <div className="lia-revision-res">
          <div className="lia-revision-top"><b>Tu mensaje</b><Badge tono={r.puntaje >= 70 ? 'green' : r.puntaje >= 45 ? 'amber' : 'red'}>{r.puntaje}/100</Badge>
            <button type="button" className="icon-btn" onClick={() => setR(null)} aria-label="Cerrar revisión"><Icon name="x" size={14} /></button></div>
          {r.fortalezas.length > 0 && <ul className="lia-bien">{r.fortalezas.map((x) => <li key={x}><Icon name="check" size={13} />{x}</li>)}</ul>}
          {r.mejoras.length > 0 && <ul className="lia-falta">{r.mejoras.map((x) => <li key={x}><Icon name="arrowright" size={13} />{x}</li>)}</ul>}
          {r.version && (
            <div className="lia-version">
              <small>Versión mejorada</small>
              <p>{r.version}</p>
              <Button size="sm" icon="check" onClick={() => { onUsar(r.version!); setR(null); toast.ok('Usamos la versión mejorada. Revísala y completa los datos entre [corchetes] antes de enviar.') }}>Usar esta versión</Button>
            </div>
          )}
          <NotaIa ia={r.ia} />
        </div>
      )}
    </div>
  )
}

/** «Mi plan del mes»: en qué licitaciones usar las postulaciones que quedan, con puntaje y por qué. */
export function PlanDelMesCard() {
  const plan = useAsync(() => api.planDelMes(), [])
  const p = plan.data
  return (
    <Card>
      <CardHeader icon="calendar" title="Mi plan del mes" subtitle={p ? `Te quedan ${p.restantes} de ${p.limite} postulaciones: te conviene usarlas aquí` : 'Priorizamos las licitaciones que más te convienen'}
        action={p ? <button type="button" className="link-btn" onClick={plan.recargar}>Actualizar</button> : undefined} />
      {plan.loading ? <div className="lia-pensando"><Cargando texto="LicitaWatch está comparando las licitaciones abiertas con tu perfil…" /></div>
        : !p ? <EmptyState icon="alert" titulo="No pudimos armar tu plan" texto={plan.error ?? undefined} />
          : p.recomendaciones.length === 0 ? <EmptyState icon="search" titulo="No hay licitaciones abiertas pendientes" texto="Ya postulaste a todas las abiertas o no hay nuevas por ahora." /> : (
            <>
              <ol className="lia-plan">
                {p.recomendaciones.map((x, i) => (
                  <li key={x.licitacion.id}>
                    <span className="lia-plan-n" style={{ background: colorPuntaje(x.puntaje) }}>{x.puntaje}</span>
                    <div className="lia-plan-txt">
                      <b>{i + 1}. {x.licitacion.titulo}</b>
                      <small>{x.licitacion.licitadorNombre} · {rangoPresupuesto(x.licitacion.presupuestoMin, x.licitacion.presupuestoMax)}</small>
                      <p><Icon name="sparkles" size={13} />{x.motivo}</p>
                    </div>
                    <Link to={`/app/licitacion/${x.licitacion.id}`} className="btn btn-sm btn-outline">Ver y postular</Link>
                  </li>
                ))}
              </ol>
              {p.restantes === 0 && <p className="pan-nota"><Icon name="info" size={14} />Ya usaste tus postulaciones de este mes: guarda este plan para el próximo.</p>}
              <NotaIa ia={p.ia} />
            </>
          )}
    </Card>
  )
}
