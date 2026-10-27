import { useState } from 'react'
import { api } from '../../api'
import type { EstadoPostulacion, Postulacion } from '../../api/types'
import { Badge, Button, Card, Cargando, EmptyState, Input, PageHeader, Tabs, tonoEstado, useAsync, useToast } from '../../components/ui/ui'
import { Link, navigate } from '../../lib/router'
import { Icon } from '../../lib/icons'
import { fechaCorta } from '../../lib/format'

export function MyApplications() {
  const toast = useToast()
  const { data, loading, setData } = useAsync(() => api.misPostulaciones(), [])
  const [tab, setTab] = useState<'todas' | EstadoPostulacion | 'archivadas'>('todas')
  const [q, setQ] = useState('')
  const [ocupada, setOcupada] = useState<number | null>(null)
  const todas = data ?? []
  // Las archivadas solo aparecen en su pestaña; el resto de pestañas y contadores muestran las activas.
  const activas = todas.filter((p) => !p.archivada)
  const archivadas = todas.filter((p) => p.archivada)
  const texto = q.trim().toLowerCase()
  const lista = (tab === 'archivadas' ? archivadas : activas.filter((p) => tab === 'todas' || p.estado === tab))
    .filter((p) => !texto || p.licitacionTitulo.toLowerCase().includes(texto) || p.licitadorNombre.toLowerCase().includes(texto))
  const n = (e: EstadoPostulacion) => activas.filter((p) => p.estado === e).length

  const archivar = async (p: Postulacion, archivada: boolean) => {
    setOcupada(p.id)
    try {
      const nueva = await api.archivarPostulacion(p.id, archivada)
      setData(todas.map((x) => (x.id === nueva.id ? nueva : x)))
      toast.ok(archivada ? 'Postulación archivada. La encuentras en la pestaña «Archivadas».' : 'Postulación restaurada a tu lista.')
    } catch (e) { toast.error((e as Error).message) } finally { setOcupada(null) }
  }

  return (
    <div className="stack">
      <PageHeader title="Mis postulaciones" subtitle="Da seguimiento al estado de cada propuesta que enviaste." actions={<Button variant="soft" icon="search" onClick={() => navigate('/app/explorar')}>Explorar licitaciones</Button>} />
      <Tabs valor={tab} onChange={setTab} items={[
        { id: 'todas', label: 'Todas', count: activas.length },
        { id: 'Pendiente', label: 'Pendientes', count: n('Pendiente') },
        { id: 'Aprobada', label: 'Aprobadas', count: n('Aprobada') },
        { id: 'Rechazada', label: 'Rechazadas', count: n('Rechazada') },
        { id: 'archivadas', label: 'Archivadas', count: archivadas.length },
      ]} />
      {todas.length > 0 && <Input icon="search" placeholder="Buscar por licitación o licitador…" value={q} onChange={(e) => setQ(e.target.value)} />}
      {loading ? <Cargando /> : lista.length === 0 ? (
        <Card>{texto ? <EmptyState icon="search" titulo="Sin resultados" texto="Ninguna postulación de esta pestaña coincide con tu búsqueda." />
          : tab === 'archivadas' ? <EmptyState icon="archive" titulo="No tienes postulaciones archivadas" texto="Archiva las postulaciones que ya no necesitas seguir para mantener tu lista ordenada. Siempre podrás restaurarlas." />
          : <EmptyState icon="send" titulo="Sin postulaciones" texto="Cuando postules a una licitación, la verás aquí con su estado." accion={<Button icon="search" onClick={() => navigate('/app/explorar')}>Buscar licitaciones</Button>} />}</Card>
      ) : (
        <div className="rows">
          {lista.map((p) => (
            <Card key={p.id} className="row-card">
              <div className="row-main">
                <div className="row-top">
                  <Badge tono={tonoEstado(p.estado)} dot>{p.estado}</Badge>
                  {p.adjudicada && <Badge tono="violet" icon="award">Adjudicada a ti</Badge>}
                  {p.archivada && <Badge tono="gray" icon="archive">Archivada</Badge>}
                </div>
                <Link to={`/app/licitacion/${p.licitacionId}`} className="row-title">{p.licitacionTitulo}</Link>
                <p className="row-sub"><Icon name="building" size={14} />{p.licitadorNombre} · Postulaste el {fechaCorta(p.fecha)}</p>
              </div>
              <div className="row-actions">
                {p.conversacionId && <Button icon="chat" variant="teal" size="sm" onClick={() => navigate(`/app/chat/${p.conversacionId}`)}>Abrir chat</Button>}
                <Button variant="outline" size="sm" iconRight="arrowright" onClick={() => navigate(`/app/licitacion/${p.licitacionId}`)}>Ver licitación</Button>
                <Button variant="ghost" size="sm" icon={p.archivada ? 'inbox' : 'archive'} disabled={ocupada === p.id} onClick={() => archivar(p, !p.archivada)}>{p.archivada ? 'Restaurar' : 'Archivar'}</Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
