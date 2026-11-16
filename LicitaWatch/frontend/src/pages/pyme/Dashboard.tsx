import { api } from '../../api'
import type { ResumenPyme } from '../../api/types'
import { AreaChart, Donut } from '../../lib/charts'
import { Badge, Button, Card, CardHeader, Cargando, EmptyState, PageHeader, Progress, StatCard, tonoEstado, useAsync } from '../../components/ui/ui'
import { BannerCarousel, NotifPanel, TenderCard } from '../../components/app/shared'
import { AccesosRapidosCard, ListaCierres, PrimerosPasosCard } from '../../components/app/PanelTarjetas'
import { useAuth } from '../../context/AuthContext'
import { Link, navigate } from '../../lib/router'
import { Icon } from '../../lib/icons'
import { diasHasta, fechaCorta, hace } from '../../lib/format'

export function PymeDashboard() {
  const res = useAsync(() => api.resumenPyme(), [])
  const r = res.data
  if (res.loading && !r) return <Cargando />
  if (!r) return (
    <Card><EmptyState icon="alert" titulo="No pudimos cargar tu panel" texto={res.error ?? 'Revisa tu conexión e inténtalo de nuevo.'}
      accion={<Button icon="refresh" onClick={res.recargar}>Reintentar</Button>} /></Card>
  )
  const restantes = Math.max(0, r.limiteMes - r.usadasMes)
  // Las adjudicadas ya se cuentan dentro de las aprobadas.
  const decididas = r.aprobadas + r.rechazadas
  const tasa = decididas ? `${Math.round((r.aprobadas / decididas) * 100)}%` : '—'
  return (
    <div className="stack">
      <BannerCarousel slides={[
        { chip: 'Búsqueda de licitaciones', icon: 'search', tono: 'teal', titulo: 'Encuentra oportunidades para tu empresa', texto: 'Búsqueda ilimitada por rubro, región y presupuesto, en todos los planes.', to: '/app/explorar', cta: 'Explorar licitaciones' },
        { chip: 'LicitAsist · Premium', icon: 'sparkles', tono: 'violet', titulo: 'Pregúntale a tu asistente con IA', texto: 'Describe lo que buscas y LicitAsist te muestra las licitaciones abiertas más relevantes.', to: '/app/asistente', cta: 'Conocer LicitAsist' },
        { chip: 'Adjudicación', icon: 'chat', tono: 'blue', titulo: 'Gana una licitación y conversa al instante', texto: 'Cuando te adjudican, se abre un chat directo con el Licitador para coordinar.', to: '/app/postulaciones', cta: 'Ver mis postulaciones' },
      ]} />
      <PageHeader title="Panel de control" subtitle="Tu actividad de postulaciones y oportunidades recomendadas." actions={<Button icon="search" onClick={() => navigate('/app/explorar')}>Explorar licitaciones</Button>} />
      <div className="grid-main">
        <div className="stack">
          <div className="stats stats-3">
            <StatCard icon="send" label="Postulaciones totales" valor={r.postulacionesTotal} />
            <StatCard icon="clock" label="Pendientes" valor={r.pendientes} tono="amber" />
            <StatCard icon="checkcircle" label="Aprobadas" valor={r.aprobadas} tono="green" />
            <StatCard icon="award" label="Adjudicadas" valor={r.adjudicadas} tono="violet" />
            <StatCard icon="xcircle" label="Rechazadas" valor={r.rechazadas} tono="red" />
            <StatCard icon="trending" label="Tasa de aprobación" valor={tasa} tono="green" />
          </div>
          <div className="grid-2-eq">
            <div className="stack">
              <Card className="plan-usage">
                <CardHeader icon="crown" title="Tu plan este mes" action={<Badge tono={r.plan === 'Premium' ? 'teal' : 'gray'} icon={r.plan === 'Premium' ? 'crown' : undefined}>{r.plan}</Badge>} />
                <div className="usage-num"><b>{r.usadasMes}</b><span>de {r.limiteMes} postulaciones usadas</span></div>
                <Progress valor={r.usadasMes} max={r.limiteMes} tono={restantes === 0 ? 'red' : restantes === 1 ? 'amber' : 'accent'} />
                <p className="muted-p">{restantes === 0 ? 'Alcanzaste el límite del mes.' : `Te quedan ${restantes} postulación${restantes === 1 ? '' : 'es'} este mes.`}</p>
                {r.plan === 'Estándar' && (
                  <Link to="/app/suscripcion" className="callout callout-teal"><Icon name="crown" size={18} /><span><b>Pasa a Premium</b> y postula hasta 7 veces al mes</span><Icon name="arrowright" size={16} /></Link>
                )}
              </Card>
              <CierranPronto />
            </div>
            <Card>
              <CardHeader icon="chart" title="Resultado de tus postulaciones" />
              <Donut centro={String(r.postulacionesTotal)} subtitulo="postulaciones" segmentos={[
                { etiqueta: 'Aprobadas', valor: r.aprobadas, color: 'var(--green)' },
                { etiqueta: 'Pendientes', valor: r.pendientes, color: 'var(--amber)' },
                { etiqueta: 'Rechazadas', valor: r.rechazadas, color: '#E5484D' },
              ]} />
            </Card>
          </div>
          <Card>
            <CardHeader icon="trending" title="Postulaciones por mes" subtitle="Últimos 6 meses" />
            <AreaChart datos={r.porMes} />
          </Card>
          <Card>
            <CardHeader icon="sparkles" title="Recomendadas para ti" subtitle="Abiertas, primero las de tu rubro" action={<Link to="/app/explorar" className="link">Ver todas</Link>} />
            {r.recomendadas.length === 0
              ? <EmptyState icon="search" titulo="No hay licitaciones nuevas por ahora" texto="Revisa todas las licitaciones abiertas con filtros por rubro y región." accion={<Button icon="search" onClick={() => navigate('/app/explorar')}>Explorar licitaciones</Button>} />
              : <div className="tgrid dash-recomendadas">{r.recomendadas.slice(0, 3).map((l) => <TenderCard key={l.id} l={l} />)}</div>}
          </Card>
        </div>
        <div className="stack">
          <NotifPanel />
          <PostulacionesRecientes />
          <PrimerosPasos r={r} />
          <AccesosRapidosCard accesos={[
            { to: '/app/explorar', label: 'Explorar', icon: 'search' },
            { to: '/app/postulaciones', label: 'Mis postulaciones', icon: 'send' },
            { to: '/app/asistente', label: 'LicitAsist', icon: 'sparkles', bloqueado: r.plan !== 'Premium' },
            { to: '/app/configuracion', label: 'Configuración', icon: 'settings' },
          ]} />
          <Card className="tip-card tip-teal">
            <Badge tono="teal" icon="sparkles">Consejo</Badge>
            <h4>Postula con un mensaje a la medida</h4>
            <p>Menciona experiencia similar y tu disponibilidad. Los Licitadores aprueban más rápido las propuestas claras.</p>
          </Card>
        </div>
      </div>
    </div>
  )
}

/** Licitaciones abiertas de su rubro a las que aún no postula, las que cierran antes primero (hasta 4). */
function CierranPronto() {
  const { sesion } = useAuth()
  const rubroId = sesion!.perfil.rubroId
  const datos = useAsync(async () => {
    const [abiertas, mias] = await Promise.all([api.licitaciones({ rubroId, estado: 'Abierta' }), api.misPostulaciones()])
    const postuladas = new Set(mias.map((p) => p.licitacionId))
    return abiertas.filter((l) => !postuladas.has(l.id) && diasHasta(l.fechaCierre) >= 0).sort((a, b) => a.fechaCierre.localeCompare(b.fechaCierre)).slice(0, 4)
  }, [rubroId])
  return (
    <Card>
      <CardHeader icon="calendar" title="Cierran pronto en tu rubro" subtitle="Abiertas a las que aún no postulas" />
      {datos.loading && !datos.data ? <Cargando /> : (
        <ListaCierres licitaciones={datos.data ?? []} vacio="No hay licitaciones abiertas de tu rubro pendientes. Revisa Explorar para ver las de otros rubros."
          detalle={(l) => `${l.licitadorNombre} · cierra el ${fechaCorta(l.fechaCierre)}`} />
      )}
    </Card>
  )
}

/** Últimas 3 postulaciones con su estado; si fue adjudicada, enlace directo al chat. */
function PostulacionesRecientes() {
  const mias = useAsync(() => api.misPostulaciones(), [])
  const ultimas = [...(mias.data ?? [])].sort((a, b) => b.fecha.localeCompare(a.fecha) || b.id - a.id).slice(0, 3)
  return (
    <Card>
      <CardHeader icon="send" title="Mis postulaciones recientes" action={ultimas.length ? <Link to="/app/postulaciones" className="link">Ver todas</Link> : undefined} />
      {mias.loading && !mias.data ? <Cargando /> : ultimas.length === 0 ? (
        <p className="muted-p dash-vacio">Aún no postulas. <Link to="/app/explorar" className="link">Explora licitaciones</Link> y envía tu primera propuesta.</p>
      ) : (
        <ul className="dash-lista">
          {ultimas.map((p) => (
            <li key={p.id}>
              <Link to={p.conversacionId ? `/app/chat/${p.conversacionId}` : `/app/licitacion/${p.licitacionId}`} className="dash-item">
                <div><b title={p.licitacionTitulo}>{p.licitacionTitulo}</b><small>{p.licitadorNombre} · {hace(p.fecha)}{p.conversacionId ? ' · abrir chat' : ''}</small></div>
                {p.adjudicada ? <Badge tono="violet" icon="award">Adjudicada</Badge> : <Badge tono={tonoEstado(p.estado)} dot>{p.estado}</Badge>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

/** Primeros pasos de la Pyme: el perfil completo es lo mismo que mide «Compatibilidad contigo» en el detalle de cada licitación. */
function PrimerosPasos({ r }: { r: ResumenPyme }) {
  const { sesion } = useAuth()
  const seg = useAsync(() => api.seguridadCuenta(), [])
  const p = sesion!.perfil
  const perfilCompleto = (p.descripcionEmpresa ?? '').trim().length >= 30 && !!p.sitioWeb?.trim() && !!p.tamanoEmpresaId && !!p.telefono?.trim()
  return <PrimerosPasosCard pasos={[
    { ok: perfilCompleto, texto: 'Completa tu perfil (descripción, sitio web, tamaño y teléfono)', to: '/app/perfil' },
    { ok: !!seg.data?.emailVerificado, texto: 'Verifica tu correo', to: '/app/configuracion' },
    { ok: r.postulacionesTotal > 0, texto: 'Envía tu primera postulación', to: '/app/explorar' },
    { ok: !!seg.data?.dosFactoresActivo, texto: 'Activa la verificación en dos pasos', to: '/app/configuracion' },
  ]} />
}
