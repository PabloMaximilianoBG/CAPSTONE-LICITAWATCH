import { useEffect, useRef, useState } from 'react'
import { api } from '../../api'
import type { MensajeAsistente } from '../../api/types'
import { Button, Card, Cargando, EmptyState, PageHeader, Select, useAsync } from '../../components/ui/ui'
import { AnalisisModal, PlanDelMesCard } from './LicitAsistAcciones'
import { Icon, type IconName } from '../../lib/icons'
import { Link, navigate } from '../../lib/router'
import { rangoPresupuesto } from '../../lib/format'

/** Preguntas sugeridas por grupo: muestran que LicitAsist encuentra, sigue tus postulaciones y aconseja. */
const SUGERENCIAS: Record<'encontrar' | 'postulaciones' | 'consejos', { label: string; icon: IconName; preguntas: string[] }> = {
  encontrar: { label: 'Encontrar', icon: 'search', preguntas: ['¿Qué licitaciones de mi rubro están abiertas?', '¿Cuáles tienen menos competencia ahora?', '¿Qué licitaciones cierran esta semana?', '¿Cuál es la de mayor presupuesto que me calza?'] },
  postulaciones: { label: 'Mis postulaciones', icon: 'send', preguntas: ['¿Cómo van mis postulaciones?', '¿Cuántas postulaciones me quedan este mes?', '¿Qué puedo mejorar si me rechazaron?'] },
  consejos: { label: 'Consejos', icon: 'sparkles', preguntas: ['¿Qué le falta a mi perfil para ganar más licitaciones?', 'Dame 3 consejos para un buen mensaje de postulación', '¿Qué documentos suelen pedir en mi rubro?', '¿Cómo funciona la adjudicación y el chat?'] },
}

export function Assistant() {
  const sub = useAsync(() => api.miSuscripcion(), [])
  const [msgs, setMsgs] = useState<MensajeAsistente[]>([{ rol: 'asistente', texto: '¡Hola! Soy LicitAsist. Cuéntame qué tipo de licitaciones buscas (rubro, región o presupuesto) y las encuentro por ti.' }])
  const [texto, setTexto] = useState('')
  const [pensando, setPensando] = useState(false)
  const [grupo, setGrupo] = useState<keyof typeof SUGERENCIAS>('encontrar')
  const fin = useRef<HTMLDivElement>(null)
  useEffect(() => { fin.current?.scrollIntoView({ block: 'end' }) }, [msgs.length, pensando])

  if (sub.loading) return <Cargando />
  if (sub.data?.plan.nombre !== 'Premium' || sub.data.estado !== 'Activa') {
    return (
      <div className="stack">
        <PageHeader title="LicitAsist" subtitle="Tu asistente de IA para encontrar licitaciones." />
        <Card><EmptyState icon="lock" titulo="LicitAsist es una función Premium" texto="Pregúntale en lenguaje natural y recibe las licitaciones que mejor calzan con tu empresa."
          accion={<Button variant="teal" icon="crown" onClick={() => navigate('/app/suscripcion')}>Ver plan Premium</Button>} /></Card>
      </div>
    )
  }
  const enviar = async (t = texto) => {
    if (!t.trim() || pensando) return
    setMsgs((m) => [...m, { rol: 'usuario', texto: t }]); setTexto(''); setPensando(true)
    try { const r = await api.preguntarAsistente(t); setMsgs((m) => [...m, r]) }
    catch (e) { setMsgs((m) => [...m, { rol: 'asistente', texto: (e as Error).message }]) }
    finally { setPensando(false) }
  }
  return (
    <div className="stack">
      <PageHeader title="LicitAsist" subtitle="Tu asistente con IA: analiza, prioriza y redacta por ti." />
      <AccionesLicitAsist />
      <PlanDelMesCard />
      <h3 className="lia-titulo-chat"><Icon name="chat" size={18} />Busca conversando</h3>
      <Card pad={false} className="assistant">
        <div className="chat-msgs">
          {msgs.map((m, i) => (
            <div key={i} className={`bubble ${m.rol === 'usuario' ? 'me' : 'other'}`}>
              {m.rol === 'asistente' && <span className="bot-ic"><Icon name="sparkles" size={16} /></span>}
              <p style={{ whiteSpace: 'pre-line' }}>{m.texto}</p>
              {m.licitaciones && m.licitaciones.length > 0 && (
                <div className="bot-results">{m.licitaciones.map((l) => (
                  <Link key={l.id} to={`/app/licitacion/${l.id}`} className="bot-result"><b>{l.titulo}</b><small>{l.licitadorNombre} · {rangoPresupuesto(l.presupuestoMin, l.presupuestoMax)}</small></Link>
                ))}</div>
              )}
            </div>
          ))}
          {pensando && <div className="bubble other"><span className="typing"><i /><i /><i /></span></div>}
          <div ref={fin} />
        </div>
        <div className="lia-sugerencias">
          <div className="lia-grupos" role="tablist">
            {(Object.keys(SUGERENCIAS) as (keyof typeof SUGERENCIAS)[]).map((g) => (
              <button key={g} role="tab" aria-selected={grupo === g} className={`lia-grupo ${grupo === g ? 'on' : ''}`} onClick={() => setGrupo(g)}>
                <Icon name={SUGERENCIAS[g].icon} size={14} />{SUGERENCIAS[g].label}
              </button>
            ))}
          </div>
          <div className="chips">{SUGERENCIAS[grupo].preguntas.map((s) => <button key={s} className="chip" disabled={pensando} onClick={() => enviar(s)}>{s}</button>)}</div>
        </div>
        <footer className="chat-input">
          <input className="input" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Escribe tu consulta…" onKeyDown={(e) => e.key === 'Enter' && enviar()} />
          <Button icon="send" onClick={() => enviar()} disabled={!texto.trim() || pensando}>Enviar</Button>
        </footer>
      </Card>
    </div>
  )
}

/** Las 3 cosas que LicitAsist hace por la Pyme (además de buscar): analizar una licitación, priorizar el mes y revisar el mensaje. */
function AccionesLicitAsist() {
  const abiertas = useAsync(() => api.licitaciones({ estado: 'Abierta' }), [])
  const [elegida, setElegida] = useState(0)
  const [analizar, setAnalizar] = useState<number | null>(null)
  return (
    <div className="lia-acciones">
      <Card className="lia-accion">
        <span className="lia-accion-ic"><Icon name="checkcircle" size={20} /></span>
        <b>¿Me conviene postular?</b>
        <p>Analiza una licitación con tu perfil: veredicto, puntaje, requisitos que cumples y riesgos.</p>
        <div className="lia-accion-pie">
          <Select value={elegida} onChange={(e) => setElegida(Number(e.target.value))}>
            <option value={0}>{abiertas.loading ? 'Cargando licitaciones…' : 'Elige una licitación abierta'}</option>
            {(abiertas.data ?? []).map((l) => <option key={l.id} value={l.id}>{l.titulo}</option>)}
          </Select>
          <Button size="sm" icon="sparkles" disabled={!elegida} onClick={() => setAnalizar(elegida)}>Analizar</Button>
        </div>
      </Card>
      <Card className="lia-accion">
        <span className="lia-accion-ic"><Icon name="calendar" size={20} /></span>
        <b>Mi plan del mes</b>
        <p>Ordena las licitaciones abiertas según cuánto te convienen, para que tus postulaciones del mes rindan más.</p>
        <div className="lia-accion-pie"><small className="muted-p">Lo ves aquí abajo y se actualiza con cada licitación nueva.</small></div>
      </Card>
      <Card className="lia-accion">
        <span className="lia-accion-ic"><Icon name="edit" size={20} /></span>
        <b>Revisa mi mensaje</b>
        <p>Antes de enviar, LicitAsist le pone nota a tu mensaje, te dice qué falta y te propone una versión mejorada.</p>
        <div className="lia-accion-pie"><small className="muted-p">Está en la tarjeta «Postular» de cada licitación.</small><Link to="/app/explorar" className="link">Explorar licitaciones →</Link></div>
      </Card>
      {analizar != null && <AnalisisModal licitacionId={analizar} irAPostular onClose={() => setAnalizar(null)} />}
    </div>
  )
}
