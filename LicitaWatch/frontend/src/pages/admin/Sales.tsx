import { useState } from 'react'
import { api } from '../../api'
import type { Plan } from '../../api/types'
import { Badge, Button, Card, CardHeader, Cargando, EmptyState, Field, Input, Modal, PageHeader, StatCard, Textarea, tonoEstado, useAsync, useToast } from '../../components/ui/ui'
import { AreaChart, Donut } from '../../lib/charts'
import { clp, fechaHora } from '../../lib/format'

const PRECIO_MIN = 1000, PRECIO_MAX = 10_000_000   // mismos límites que valida ms-ventas-bs

export function AdminSales() {
  const toast = useToast()
  const est = useAsync(() => api.estadisticasAdmin(), [])
  const ventas = useAsync(() => api.ventasAdmin(), [])
  const planes = useAsync(() => api.planes(), [])
  const historial = useAsync(() => api.historialPreciosPlan(), [])

  // Edición de precio: el admin ingresa el nuevo monto, el motivo y vuelve a escribir su contraseña.
  const [editar, setEditar] = useState<Plan | null>(null)
  const [precio, setPrecio] = useState('')
  const [motivo, setMotivo] = useState('')
  const [password, setPassword] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const abrir = (p: Plan) => { setEditar(p); setPrecio(String(p.precioMensual)); setMotivo(''); setPassword(''); setError(null) }
  const cerrar = () => { if (!guardando) { setEditar(null); setPassword('') } }
  const monto = Number(precio.replace(/\D/g, ''))
  const errPrecio = !precio ? 'Ingresa el nuevo precio' : monto < PRECIO_MIN || monto > PRECIO_MAX ? `Debe estar entre ${clp(PRECIO_MIN)} y ${clp(PRECIO_MAX)}` : editar && monto === editar.precioMensual ? 'Es igual al precio actual' : null
  const errMotivo = motivo.trim().length < 5 ? 'Mínimo 5 caracteres' : null
  const valido = !errPrecio && !errMotivo && password.length > 0

  const guardar = async () => {
    if (!editar || !valido) return
    setGuardando(true); setError(null)
    try {
      await api.actualizarPrecioPlan(editar.id, monto, password, motivo.trim())
      toast.ok(`Precio del plan ${editar.nombre} actualizado a ${clp(monto)}.`)
      setEditar(null); setPassword('')
      planes.recargar(); historial.recargar()
    } catch (e) { setError((e as Error).message); setPassword('') }
    finally { setGuardando(false) }
  }

  if (est.loading || ventas.loading) return <Cargando />
  const e = est.data!
  const pymes = e.pymes || 1
  return (
    <div className="stack">
      <PageHeader title="Ventas y suscripciones" subtitle="Pymes registradas, suscripciones pagadas y ganancias." />
      <div className="stats stats-4">
        <StatCard icon="users" label="Pymes registradas" valor={e.pymes} />
        <StatCard icon="crown" label="Pymes Premium (pagan)" valor={e.pymesPremium} tono="violet" delta={`${Math.round((e.pymesPremium / pymes) * 100)}% de conversión`} />
        <StatCard icon="wallet" label="Ingresos del mes" valor={clp(e.ingresosMes)} tono="green" />
        <StatCard icon="dollar" label="Ingresos totales" valor={clp(e.ingresosTotal)} tono="amber" />
      </div>
      <div className="grid-2-eq">
        <Card><CardHeader icon="trending" title="Ingresos por mes" /><AreaChart datos={e.ingresosPorMes} formato={clp} /></Card>
        <Card><CardHeader icon="layers" title="Pymes por plan" />
          <Donut segmentos={[{ etiqueta: 'Premium', valor: e.pymesPremium, color: 'var(--violet)' }, { etiqueta: 'Estándar', valor: e.pymesEstandar, color: 'var(--blue)' }]} centro={`${e.pymes}`} subtitulo="Pymes" />
        </Card>
      </div>

      {/* Precios configurables de los planes */}
      <Card pad={false}>
        <div className="pad"><CardHeader icon="dollar" title="Precios de los planes" subtitle="El cambio aplica de inmediato a los nuevos pagos. Las ventas ya registradas conservan su monto." /></div>
        {planes.loading ? <Cargando /> : (
          <div className="table-wrap"><table className="table">
            <thead><tr><th>Plan</th><th>Precio mensual</th><th>Postulaciones/mes</th><th /></tr></thead>
            <tbody>{planes.data?.map((p) => (
              <tr key={p.id}>
                <td><Badge tono={p.nombre === 'Premium' ? 'violet' : 'gray'} icon={p.nombre === 'Premium' ? 'crown' : undefined}>{p.nombre}</Badge></td>
                <td><b>{p.precioMensual === 0 ? 'Gratis' : clp(p.precioMensual)}</b></td>
                <td>{p.postulacionesMes}</td>
                <td className="row-actions">
                  {p.precioMensual > 0
                    ? <Button id={`editar-precio-${p.id}`} size="sm" variant="outline" icon="edit" onClick={() => abrir(p)}>Cambiar precio</Button>
                    : <small className="muted">Plan gratuito</small>}
                </td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </Card>

      <Card pad={false}>
        <div className="pad"><CardHeader icon="clock" title="Historial de cambios de precio" subtitle="Registro de auditoría: quién, cuándo y por qué." /></div>
        {historial.loading ? <Cargando /> : historial.error ? <EmptyState icon="alert" titulo="No se pudo cargar el historial" texto={historial.error} /> : !historial.data?.length ? <EmptyState icon="clock" titulo="Sin cambios registrados" texto="Aquí aparecerá cada modificación de precio." /> : (
          <div className="table-wrap"><table className="table">
            <thead><tr><th>Fecha</th><th>Plan</th><th>Precio anterior</th><th>Precio nuevo</th><th>Administrador</th><th>Motivo</th></tr></thead>
            <tbody>{historial.data.map((h) => (
              <tr key={h.id}>
                <td>{fechaHora(h.fecha)}</td><td>{h.plan}</td>
                <td>{h.precioAnterior == null ? '—' : clp(h.precioAnterior)}</td>
                <td><b>{clp(h.precioNuevo)}</b></td>
                <td>{h.usuarioNombre}</td><td>{h.motivo ?? '—'}</td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </Card>

      <Card pad={false}>
        <div className="pad"><CardHeader icon="card" title="Transacciones" /></div>
        {!ventas.data?.length ? <EmptyState icon="card" titulo="Sin transacciones" /> : (
          <div className="table-wrap"><table className="table">
            <thead><tr><th>Fecha</th><th>Pyme</th><th>Plan</th><th>Método</th><th>Transacción</th><th>Monto</th><th>Estado</th></tr></thead>
            <tbody>{ventas.data.map((v) => (
              <tr key={v.id}><td>{fechaHora(v.fecha)}</td><td><b>{v.usuarioNombre}</b></td><td>{v.plan}</td><td>{v.metodo}</td><td><code>{v.idTransaccion}</code></td><td>{clp(v.monto)}</td><td><Badge tono={tonoEstado(v.estado)} dot>{v.estado}</Badge></td></tr>
            ))}</tbody>
          </table></div>
        )}
      </Card>

      <Modal abierto={!!editar} onClose={cerrar} titulo={`Cambiar precio del plan ${editar?.nombre ?? ''}`} ancho={500}
        pie={<><Button variant="ghost" onClick={cerrar} disabled={guardando}>Cancelar</Button><Button id="confirmar-precio" onClick={guardar} loading={guardando} disabled={!valido}>Confirmar cambio</Button></>}>
        <form className="stack" onSubmit={(ev) => { ev.preventDefault(); guardar() }}>
          <p>Precio actual: <b>{editar ? clp(editar.precioMensual) : ''}</b>. El nuevo valor se cobrará en los pagos que se inicien desde ahora.</p>
          <Field label="Nuevo precio mensual (CLP)" required error={precio ? errPrecio : null} ok={!errPrecio ? clp(monto) : null}>
            <Input id="nuevo-precio" icon="dollar" inputMode="numeric" value={precio} onChange={(ev) => setPrecio(ev.target.value.replace(/\D/g, ''))} autoFocus />
          </Field>
          <Field label="Motivo del cambio" required hint="Queda en el registro de auditoría." error={motivo && errMotivo ? errMotivo : null}>
            <Textarea id="motivo-precio" rows={2} maxLength={200} value={motivo} onChange={(ev) => setMotivo(ev.target.value)} placeholder="Ej.: ajuste por IPC 2026" />
          </Field>
          <Field label="Confirma con tu contraseña" required hint="Por seguridad, vuelve a ingresar tu contraseña de administrador." error={error}>
            <Input id="password-precio" icon="lock" type="password" autoComplete="current-password" value={password} onChange={(ev) => setPassword(ev.target.value)} />
          </Field>
          <button type="submit" hidden />
        </form>
      </Modal>
    </div>
  )
}
