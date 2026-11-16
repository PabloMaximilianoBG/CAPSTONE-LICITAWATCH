import { api } from '../../api'
import type { ResumenLicitador } from '../../api/types'
import { AreaChart, Donut } from '../../lib/charts'
import { Badge, Button, Card, CardHeader, Cargando, EmptyState, PageHeader, StatCard, tonoEstado, useAsync } from '../../components/ui/ui'
import { BannerCarousel, NotifPanel, TenderCard } from '../../components/app/shared'
import { AccesosRapidosCard, ListaCierres, PrimerosPasosCard, type Acceso } from '../../components/app/PanelTarjetas'
import { useAuth } from '../../context/AuthContext'
import { Link, navigate } from '../../lib/router'
import { Icon } from '../../lib/icons'
import { diasHasta, fechaCorta } from '../../lib/format'

export function LicitadorDashboard() {
  const res = useAsync(() => api.resumenLicitador(), [])
  const r = res.data
  if (res.loading && !r) return <Cargando />
  if (!r) return (
    <Card><EmptyState icon="alert" titulo="No pudimos cargar tu panel" texto={res.error ?? 'Revisa tu conexión e inténtalo de nuevo.'}
      accion={<Button icon="refresh" onClick={res.recargar}>Reintentar</Button>} /></Card>
  )
  const promedio = r.publicadas ? (r.postulacionesRecibidas / r.publicadas).toFixed(1).replace('.0', '').replace('.', ',') : '0'
  return (
    <div className="stack">
      <BannerCarousel slides={[
        { chip: 'Siempre gratis', icon: 'gift', tono: 'blue', titulo: 'Publica y adjudica sin pagar nada', texto: 'Como Licitador, todas las funcionalidades son gratuitas: publicaciones ilimitadas, postulaciones y chat.', to: '/app/licitaciones/nueva', cta: 'Publicar licitación' },
        { chip: 'Postulaciones', icon: 'users', tono: 'teal', titulo: 'Revisa y selecciona a la mejor Pyme', texto: 'Aprueba o rechaza cada propuesta y adjudica con un clic. Las Premium aparecen primero.', to: '/app/licitaciones', cta: 'Ver mis licitaciones' },
        { chip: 'Chat privado', icon: 'chat', tono: 'violet', titulo: 'Conversa con la Pyme adjudicada', texto: 'Cuando adjudicas, el chat se abre automáticamente para coordinar los siguientes pasos.', to: '/app/chat', cta: 'Abrir chat' },
      ]} />
      <PageHeader title="Panel de control" subtitle="Resumen de tus licitaciones y postulaciones recibidas." actions={<Button icon="plus" onClick={() => navigate('/app/licitaciones/nueva')}>Publicar licitación</Button>} />
      <div className="grid-main">
        <div className="stack">
          <div className="stats stats-3">
            <StatCard icon="file" label="Licitaciones publicadas" valor={r.publicadas} />
            <StatCard icon="clock" label="Abiertas" valor={r.abiertas} tono="green" />
            <StatCard icon="award" label="Adjudicadas" valor={r.adjudicadas} tono="amber" />
            <StatCard icon="users" label="Postulaciones recibidas" valor={r.postulacionesRecibidas} tono="violet" />
            <StatCard icon="inbox" label="Por revisar" valor={r.pendientes} tono={r.pendientes > 0 ? 'red' : 'accent'} />
            <StatCard icon="chart" label="Postulaciones por licitación" valor={promedio} tono="green" />
          </div>
          <div className="grid-2-eq">
            <div className="stack">
              <Card>
                <CardHeader icon="trending" title="Postulaciones por mes" subtitle="Últimos 6 meses" />
                <AreaChart datos={r.porMes} />
              </Card>
              <ProximosCierres />
            </div>
            <Card>
              <CardHeader icon="chart" title="Estado de tus licitaciones" />
              <Donut centro={String(r.publicadas)} subtitulo="licitaciones" segmentos={[
                { etiqueta: 'Abiertas', valor: r.abiertas, color: 'var(--green)' },
                { etiqueta: 'Adjudicadas', valor: r.adjudicadas, color: 'var(--violet)' },
                { etiqueta: 'Cerradas', valor: Math.max(0, r.publicadas - r.abiertas - r.adjudicadas), color: '#C3CCDD' },
              ]} />
              {r.pendientes > 0 && (
                <Link to="/app/licitaciones" className="callout">
                  <Icon name="alert" size={18} /><span><b>{r.pendientes} postulación{r.pendientes === 1 ? '' : 'es'}</b> esperando tu revisión</span><Icon name="arrowright" size={16} />
                </Link>
              )}
            </Card>
          </div>
          <Card>
            <CardHeader icon="file" title="Tus licitaciones recientes" action={<Link to="/app/licitaciones" className="link">Ver todas</Link>} />
            {r.recientes.length === 0 ? <EmptyState icon="file" titulo="Aún no publicas licitaciones" texto="Publica tu primera necesidad y recibe propuestas." accion={<Button icon="plus" onClick={() => navigate('/app/licitaciones/nueva')}>Publicar licitación</Button>} /> : (
              <div className="tgrid">{r.recientes.map((l) => <TenderCard key={l.id} l={l} />)}</div>
            )}
          </Card>
        </div>
        <div className="stack">
          <NotifPanel />
          <PrimerosPasos r={r} />
          <AsiTeVen />
          <AccesosRapidos />
          <Card className="tip-card">
            <Badge tono="blue" icon="sparkles">Consejo</Badge>
            <h4>Describe bien tu necesidad</h4>
            <p>Las licitaciones con presupuesto, plazos y bases adjuntas reciben hasta 3 veces más postulaciones de calidad.</p>
            <Link to="/app/licitaciones/nueva" className="link">Publicar ahora →</Link>
          </Card>
        </div>
      </div>
    </div>
  )
}

/** Licitaciones abiertas que cierran antes (hasta 4), con la cuenta regresiva en verde, ámbar o rojo. */
function ProximosCierres() {
  const mias = useAsync(() => api.misLicitaciones(), [])
  const abiertas = (mias.data ?? []).filter((l) => l.estado === 'Abierta' && diasHasta(l.fechaCierre) >= 0)
    .sort((a, b) => a.fechaCierre.localeCompare(b.fechaCierre)).slice(0, 4)
  return (
    <Card>
      <CardHeader icon="calendar" title="Próximos cierres" subtitle="Tus licitaciones abiertas" />
      {mias.loading && !mias.data ? <Cargando /> : (
        <ListaCierres licitaciones={abiertas} vacio="No tienes licitaciones abiertas. Cuando publiques una, verás aquí cuánto le queda para cerrar."
          detalle={(l) => `${l.postulantes} postulante${l.postulantes === 1 ? '' : 's'} · cierra el ${fechaCorta(l.fechaCierre)}`} />
      )}
    </Card>
  )
}

function PrimerosPasos({ r }: { r: ResumenLicitador }) {
  const { sesion } = useAuth()
  const seg = useAsync(() => api.seguridadCuenta(), [])
  const p = sesion!.perfil
  return <PrimerosPasosCard pasos={[
    { ok: !!p.telefono?.trim() && (p.descripcionEmpresa ?? '').trim().length >= 30, texto: 'Completa tu perfil (teléfono y descripción)', to: '/app/perfil' },
    { ok: !!seg.data?.emailVerificado, texto: 'Verifica tu correo', to: '/app/configuracion' },
    { ok: r.publicadas > 0, texto: 'Publica tu primera licitación', to: '/app/licitaciones/nueva' },
    { ok: r.postulacionesRecibidas > 0 && r.pendientes === 0, texto: 'Revisa las postulaciones recibidas', to: '/app/licitaciones' },
    { ok: !!seg.data?.dosFactoresActivo, texto: 'Activa la verificación en dos pasos', to: '/app/configuracion' },
  ]} />
}

/** Lo que ven las Pymes en «Publicada por»: publicadas, adjudicadas y desde cuándo está en la plataforma. */
function AsiTeVen() {
  const { sesion } = useAuth()
  const c = useAsync(() => api.confianzaLicitador(sesion!.usuario.id), [])
  if (!c.data) return null
  return (
    <Card>
      <CardHeader icon="eye" title="Así te ven las Pymes" subtitle="Lo que muestran tus licitaciones en «Publicada por»" />
      <div className="tdp-confianza">
        <div><b>{c.data.publicadas}</b><span>Publicadas</span></div>
        <div><b>{c.data.adjudicadas}</b><span>Adjudicadas</span></div>
        <div><b>{fechaCorta(c.data.desde)}</b><span>En LicitaWatch desde</span></div>
      </div>
    </Card>
  )
}

const ACCESOS: Acceso[] = [
  { to: '/app/licitaciones/nueva', label: 'Publicar', icon: 'plus' },
  { to: '/app/licitaciones', label: 'Mis licitaciones', icon: 'file' },
  { to: '/app/chat', label: 'Chat', icon: 'chat' },
  { to: '/app/configuracion', label: 'Configuración', icon: 'settings' },
]
function AccesosRapidos() { return <AccesosRapidosCard accesos={ACCESOS} /> }

export { tonoEstado }
