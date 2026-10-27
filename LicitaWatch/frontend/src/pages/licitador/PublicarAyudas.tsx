import type { AlcancePymes, Licitacion, ReferenciaPresupuesto } from '../../api/types'
import { Card, Progress } from '../../components/ui/ui'
import { TenderCard } from '../../components/app/shared'
import { Icon } from '../../lib/icons'
import { clp, fechaCorta } from '../../lib/format'

/* Ayudas del formulario «Publicar licitación»: plantillas por rubro, indicador de calidad, cronograma y panel lateral. */

/** Textos entre [corchetes] que la plantilla deja para completar. */
export const PENDIENTE_PLANTILLA = /\[[^\]\n]+\]/

const EJEMPLOS: Record<string, { alcance: string; requisitos: string[] }> = {
  'Construcción': { alcance: 'Ej: obras civiles de 200 m² en bodega: radier, tabiquería y terminaciones', requisitos: ['Inscripción vigente en registro de contratistas (si aplica)', 'Experiencia en obras similares (adjuntar referencias)', 'Prevencionista de riesgos y seguro de responsabilidad civil'] },
  'Tecnología': { alcance: 'Ej: desarrollo de una plataforma web con 3 módulos e integración a nuestro ERP', requisitos: ['Portafolio de proyectos similares', 'Equipo propuesto y sus roles', 'Soporte y garantía posterior a la entrega'] },
  'Salud': { alcance: 'Ej: suministro mensual de insumos clínicos para 2 pabellones', requisitos: ['Registro ISP vigente de los productos', 'Certificados de calidad y fichas técnicas', 'Capacidad de despacho con cadena de frío (si aplica)'] },
  'Minería': { alcance: 'Ej: servicio de mantención de equipos de carguío en faena', requisitos: ['Acreditación para ingresar a faena', 'Experiencia en minería (adjuntar referencias)', 'Plan de seguridad y prevencionista en terreno'] },
  'Logística y Transporte': { alcance: 'Ej: transporte semanal de carga paletizada entre Santiago y Concepción', requisitos: ['Flota propia y antigüedad de los vehículos', 'Seguro de carga vigente', 'Seguimiento GPS de los despachos'] },
  'Alimentos y Casino': { alcance: 'Ej: servicio de casino para 80 trabajadores, almuerzo de lunes a viernes', requisitos: ['Resolución sanitaria vigente', 'Minutas de ejemplo con valor nutricional', 'Manipuladores con capacitación al día'] },
  'Energía': { alcance: 'Ej: instalación de planta fotovoltaica de 50 kW sobre techo', requisitos: ['Instalador autorizado SEC', 'Experiencia en proyectos similares', 'Garantía de equipos e instalación'] },
  'Mantención Industrial': { alcance: 'Ej: mantención preventiva trimestral de compresores y bombas', requisitos: ['Técnicos certificados en los equipos', 'Pauta de mantención propuesta', 'Disponibilidad para emergencias'] },
  'Aseo y Mantención': { alcance: 'Ej: aseo diario de oficinas de 600 m², de lunes a viernes', requisitos: ['Dotación de personal y turnos propuestos', 'Insumos y maquinaria incluidos', 'Contratos y cotizaciones previsionales al día'] },
  'Seguridad': { alcance: 'Ej: guardias para portería 24/7 en planta industrial', requisitos: ['Autorización OS-10 vigente', 'Guardias con curso OS-10 al día', 'Supervisión y reportes de turno'] },
}

/** Descripción guía según el rubro (alcance, requisitos, plazos y condiciones de pago). */
export function plantillaPara(rubro: string): string {
  const e = EJEMPLOS[rubro] ?? { alcance: 'Ej: qué necesitas, cantidades y dónde se realizará', requisitos: ['Experiencia en trabajos similares', 'Documentación legal y tributaria al día'] }
  return [
    'ALCANCE',
    `[${e.alcance}]`,
    '',
    'REQUISITOS PARA POSTULAR',
    ...e.requisitos.map((r) => `- ${r}`),
    '- [Agrega otros requisitos o bórrala]',
    '',
    'PLAZOS',
    '- Inicio estimado: [fecha o semana]',
    '- Duración o plazo de entrega: [plazo]',
    '',
    'CONDICIONES DE PAGO',
    '- [Ej: 30 días desde la recepción conforme de la factura]',
  ].join('\n')
}

export interface DatosCalidad {
  titulo: string; descripcion: string; rubroId: number; regionId: number; min: string; max: string
  cierreValido: boolean; maxPost: string; documento: boolean; imagen: boolean
}

/** Criterios del indicador de calidad; los puntos suman 100. */
export function calidad(d: DatosCalidad) {
  const criterios = [
    { ok: d.titulo.trim().length >= 8, puntos: 15, texto: 'Título claro (mínimo 8 caracteres)' },
    { ok: d.descripcion.trim().length >= 150 && !PENDIENTE_PLANTILLA.test(d.descripcion), puntos: 25, texto: 'Descripción completa (150+ caracteres, sin textos entre corchetes)' },
    { ok: !!d.rubroId && !!d.regionId, puntos: 10, texto: 'Rubro y región' },
    { ok: !!d.min || !!d.max, puntos: 15, texto: 'Presupuesto estimado' },
    { ok: d.cierreValido, puntos: 10, texto: 'Fecha de cierre' },
    { ok: !!d.maxPost, puntos: 5, texto: 'Máximo de postulantes' },
    { ok: d.documento, puntos: 15, texto: 'Bases o documento adjunto' },
    { ok: d.imagen, puntos: 5, texto: 'Imagen de portada' },
  ]
  return { pct: criterios.filter((c) => c.ok).reduce((s, c) => s + c.puntos, 0), criterios }
}

function Calidad({ datos }: { datos: DatosCalidad }) {
  const { pct, criterios } = calidad(datos)
  const faltan = criterios.filter((c) => !c.ok)
  return (
    <Card className="pub-box">
      <div className="pub-box-t"><Icon name="star" size={15} />Tu licitación está completa al <b>{pct}%</b></div>
      <Progress valor={pct} max={100} tono={pct < 60 ? 'amber' : 'accent'} />
      {faltan.length > 0 ? (
        <ul className="pub-checks">{faltan.map((c) => <li key={c.texto}><Icon name="plus" size={13} />{c.texto} <small>+{c.puntos}%</small></li>)}</ul>
      ) : <p className="pub-nota"><Icon name="checkcircle" size={14} />¡Excelente! Las licitaciones completas reciben mejores postulaciones.</p>}
      {faltan.some((c) => c.texto.startsWith('Bases')) && <p className="pub-nota">Las licitaciones con bases adjuntas atraen postulaciones más precisas.</p>}
    </Card>
  )
}

function Cronograma({ cierre }: { cierre?: string }) {
  const hoy = new Date().toISOString()
  const dias = cierre ? Math.round((new Date(cierre).getTime() - new Date(new Date().toDateString()).getTime()) / 86_400_000) : undefined
  const pasos = [
    { t: 'Publicación', d: `Hoy, ${fechaCorta(hoy)}`, icon: 'send' as const },
    { t: 'Recepción de postulaciones', d: dias != null ? `${dias} día${dias === 1 ? '' : 's'} para que las Pymes postulen` : 'Hasta la fecha de cierre', icon: 'users' as const },
    { t: 'Cierre', d: cierre ? fechaCorta(cierre) : 'Define la fecha de cierre', icon: 'lock' as const },
    { t: 'Adjudicación', d: 'Apruebas la mejor postulación y se abre el chat con la Pyme', icon: 'award' as const },
  ]
  return (
    <Card className="pub-box">
      <div className="pub-box-t"><Icon name="calendar" size={15} />Cronograma</div>
      <ol className="pub-crono">{pasos.map((p) => <li key={p.t}><span className="pub-crono-ic"><Icon name={p.icon} size={13} /></span><div><b>{p.t}</b><small>{p.d}</small></div></li>)}</ol>
    </Card>
  )
}

function Alcance({ alcance, rubro, region }: { alcance?: AlcancePymes | null; rubro: string; region: string }) {
  if (!alcance) return null
  return (
    <Card className="pub-box">
      <div className="pub-box-t"><Icon name="bell" size={15} />Alcance estimado</div>
      {alcance.rubro === 0
        ? <p className="pub-nota">Aún no hay Pymes de {rubro} registradas para avisarles. Tu licitación igual quedará visible en «Explorar licitaciones».</p>
        : <p className="pub-alcance"><b>{alcance.rubro}</b> Pyme{alcance.rubro === 1 ? '' : 's'} de {rubro} recibirá{alcance.rubro === 1 ? '' : 'n'} el aviso al publicar{alcance.region > 0 && <>, <b>{alcance.region}</b> de ellas en la región {region}</>}.</p>}
    </Card>
  )
}

/** Recuadro bajo el presupuesto: rango habitual del rubro y aviso si el ingresado se aleja mucho. */
export function SugerenciaPresupuesto({ referencia, rubro, min, max, usar }: { referencia?: ReferenciaPresupuesto | null; rubro: string; min: string; max: string; usar: (desde: number, hasta: number) => void }) {
  if (!referencia) return null
  if (referencia.desde == null || referencia.hasta == null) return <p className="pub-sugerencia"><Icon name="info" size={14} />Aún no hay suficientes licitaciones de {rubro} con presupuesto para sugerir un rango.</p>
  const { desde, hasta } = referencia
  const distinto = (max && Number(max) < desde / 2) || (min && Number(min) > hasta * 2)
  return (
    <div className={`pub-sugerencia ${distinto ? 'warn' : ''}`}>
      <Icon name={distinto ? 'alert' : 'trending'} size={14} />
      <span>
        {distinto ? 'Tu rango es muy distinto al habitual. ' : ''}En {rubro}, las licitaciones similares van de <b>{clp(desde)}</b> a <b>{clp(hasta)}</b> (según {referencia.cantidad}).{' '}
        {(Number(min) !== desde || Number(max) !== hasta) && <button type="button" className="link-btn" onClick={() => usar(desde, hasta)}>Usar este rango</button>}
      </span>
    </div>
  )
}

/** Columna derecha: vista previa como la verán las Pymes, calidad, alcance y cronograma. */
export function PanelPublicar({ vista, datos, alcance, rubro, region, cierre }: { vista: Licitacion; datos: DatosCalidad; alcance?: AlcancePymes | null; rubro: string; region: string; cierre?: string }) {
  return (
    <aside className="pub-aside">
      <div>
        <p className="pub-aside-t">Vista previa · así la verán las Pymes</p>
        {/* inert: la tarjeta no es clicable ni enfocable (React 18 no tipa el atributo) */}
        <div className="pub-preview" aria-hidden {...{ inert: '' }}><TenderCard l={vista} /></div>
      </div>
      <Calidad datos={datos} />
      <Alcance alcance={alcance} rubro={rubro} region={region} />
      <Cronograma cierre={cierre} />
    </aside>
  )
}
