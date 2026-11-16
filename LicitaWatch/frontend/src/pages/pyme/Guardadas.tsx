import { api } from '../../api'
import { Button, Card, Cargando, EmptyState, PageHeader, useAsync } from '../../components/ui/ui'
import { TenderCard } from '../../components/app/shared'
import { useAuth } from '../../context/AuthContext'
import { useGuardadas } from '../../lib/guardadas'
import { navigate } from '../../lib/router'

/** Licitaciones que la Pyme marcó con ⭐ para revisar después (guardadas en el navegador). */
export function Guardadas() {
  const { sesion } = useAuth()
  const { ids } = useGuardadas(sesion?.usuario.id)
  const todas = useAsync(() => api.licitaciones(), [])
  // En el orden en que se guardaron (la más reciente primero); las que ya no existen se omiten.
  const lista = ids.map((id) => todas.data?.find((l) => l.id === id)).filter((l): l is NonNullable<typeof l> => !!l)
  return (
    <div className="stack">
      <PageHeader title="Guardadas" subtitle="Las licitaciones que marcaste con ⭐ para revisar después."
        actions={<Button variant="outline" icon="search" onClick={() => navigate('/app/explorar')}>Explorar licitaciones</Button>} />
      {todas.loading && !todas.data ? <Cargando /> : lista.length === 0 ? (
        <Card><EmptyState icon="star" titulo="Aún no guardas licitaciones" texto="Toca ⭐ en las licitaciones que te interesen y aparecerán aquí."
          accion={<Button icon="search" onClick={() => navigate('/app/explorar')}>Explorar licitaciones</Button>} /></Card>
      ) : <div className="tgrid tgrid-3">{lista.map((l) => <TenderCard key={l.id} l={l} />)}</div>}
    </div>
  )
}
