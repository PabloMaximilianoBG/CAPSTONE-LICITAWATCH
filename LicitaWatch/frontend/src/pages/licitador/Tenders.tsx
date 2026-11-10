import { useEffect, useRef, useState } from 'react'
import { api } from '../../api'
import { DURACION_MAX_MESES, MAX_DOCUMENTO_BYTES, MAX_DOCUMENTOS, MAX_PUBLICAR_BYTES, PLAZO_MINIMO_DIAS, type AlcancePymes, type DocumentoLicitacion, type DocumentoRequerido, type EstadoLicitacion, type Licitacion, type ReferenciaPresupuesto } from '../../api/types'
import { Button, Card, CardHeader, Cargando, EmptyState, Field, Input, PageHeader, Select, Tabs, Textarea, useAsync, useToast } from '../../components/ui/ui'
import { TenderCard, VolverLink } from '../../components/app/shared'
import { navigate } from '../../lib/router'
import { Icon } from '../../lib/icons'
import { useAuth, useCatalogos } from '../../context/AuthContext'
import { fechaCorta, tipoArchivo } from '../../lib/format'
import { DocumentosSolicitados, PENDIENTE_PLANTILLA, PanelPublicar, SugerenciaPresupuesto, plantillaPara } from './PublicarAyudas'

/** Fecha (aaaa-mm-dd, hora local) desde la que se puede cerrar una licitación publicada hoy. */
function cierreMinimo(): string {
  const d = new Date(); d.setDate(d.getDate() + PLAZO_MINIMO_DIAS)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function MyTenders() {
  const { data, loading } = useAsync(() => api.misLicitaciones(), [])
  const [tab, setTab] = useState<'todas' | EstadoLicitacion>('todas')
  const lista = (data ?? []).filter((l) => tab === 'todas' || l.estado === tab)
  const cuenta = (e: EstadoLicitacion) => (data ?? []).filter((l) => l.estado === e).length
  return (
    <div className="stack">
      <PageHeader title="Mis licitaciones" subtitle="Gestiona lo que publicaste y revisa las postulaciones recibidas." actions={<Button icon="plus" onClick={() => navigate('/app/licitaciones/nueva')}>Publicar licitación</Button>} />
      <Tabs valor={tab} onChange={setTab} items={[
        { id: 'todas', label: 'Todas', count: data?.length ?? 0 },
        { id: 'Abierta', label: 'Abiertas', count: cuenta('Abierta') },
        { id: 'Adjudicada', label: 'Adjudicadas', count: cuenta('Adjudicada') },
        { id: 'Cerrada', label: 'Cerradas', count: cuenta('Cerrada') },
      ]} />
      {loading ? <Cargando /> : lista.length === 0 ? (
        <Card><EmptyState icon="file" titulo="No hay licitaciones aquí" texto="Publica una nueva licitación para empezar a recibir propuestas." accion={<Button icon="plus" onClick={() => navigate('/app/licitaciones/nueva')}>Publicar licitación</Button>} /></Card>
      ) : <div className="tgrid tgrid-3">{lista.map((l) => <TenderCard key={l.id} l={l} />)}</div>}
    </div>
  )
}

export function TenderForm() {
  const cat = useCatalogos()
  const toast = useToast()
  const { sesion } = useAuth()
  const [titulo, setTitulo] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [rubroId, setRubroId] = useState(0)
  const [regionId, setRegionId] = useState(0)
  const [min, setMin] = useState('')
  const [max, setMax] = useState('')
  const [maxPost, setMaxPost] = useState('')
  const [cierre, setCierre] = useState('')
  const [duracion, setDuracion] = useState('')   // meses del contrato que gana la Pyme adjudicada
  const [imagen, setImagen] = useState<string | undefined>()
  const [docs, setDocs] = useState<DocumentoLicitacion[]>([])
  const [pedidos, setPedidos] = useState<DocumentoRequerido[]>([])   // documentos que se piden a las Pymes (vacío = ninguno)
  const [errores, setErrores] = useState<Record<string, string>>({})
  const [enviando, setEnviando] = useState(false)
  const [plantilla, setPlantilla] = useState('')   // última plantilla precargada (se cambia sola mientras no la edites)
  const [alcance, setAlcance] = useState<AlcancePymes | null>(null)
  const [referencia, setReferencia] = useState<ReferenciaPresupuesto | null>(null)
  const refImg = useRef<HTMLInputElement>(null)
  const refDoc = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (sesion && !rubroId) { setRubroId(sesion.perfil.rubroId); setRegionId(cat.regionDeCiudad(sesion.perfil.ciudadId) ?? 0) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sesion, cat.ciudades.length])

  // Plantilla por rubro: se precarga si la descripción está vacía o sigue siendo la plantilla anterior sin editar.
  const rubroNombre = cat.rubros.find((r) => r.id === rubroId)?.nombre ?? ''   // vacío mientras cargan los catálogos
  useEffect(() => {
    if (!rubroNombre || (descripcion.trim() && descripcion !== plantilla)) return
    const t = plantillaPara(rubroNombre)
    setDescripcion(t); setPlantilla(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rubroNombre])

  // Alcance del aviso y presupuesto de referencia del rubro (si fallan, el formulario sigue sin esas ayudas).
  useEffect(() => {
    if (!rubroId) { setAlcance(null); return }
    let vivo = true
    api.alcancePymes(rubroId, regionId || undefined).then((a) => { if (vivo) setAlcance(a) }).catch(() => { if (vivo) setAlcance(null) })
    return () => { vivo = false }
  }, [rubroId, regionId])
  useEffect(() => {
    if (!rubroId) { setReferencia(null); return }
    let vivo = true
    api.referenciaPresupuesto(rubroId).then((r) => { if (vivo) setReferencia(r) }).catch(() => { if (vivo) setReferencia(null) })
    return () => { vivo = false }
  }, [rubroId])

  // Validaciones en vivo (además de las del botón Publicar).
  const minCierre = cierreMinimo()
  const errCierre = cierre && cierre < minCierre ? `Da al menos ${PLAZO_MINIMO_DIAS} días para postular (desde el ${fechaCorta(minCierre + 'T12:00:00')})` : undefined
  const errMax = min && max && Number(min) > Number(max) ? 'El máximo debe ser mayor o igual al mínimo' : undefined
  const meses = Number(duracion)
  const errDuracion = duracion && (!Number.isInteger(meses) || meses < 1 || meses > DURACION_MAX_MESES) ? `Indica de 1 a ${DURACION_MAX_MESES} meses (número entero)` : undefined
  const fechaCierreIso = cierre ? new Date(cierre + 'T23:59:59').toISOString() : undefined
  const vista: Licitacion = {
    id: 0, licitadorId: sesion?.usuario.id ?? 0, licitadorNombre: sesion?.perfil.razonSocial || 'Tu empresa', titulo: titulo.trim() || 'Título de tu licitación',
    descripcion, rubroId, regionId, presupuestoMin: min ? Number(min) : undefined, presupuestoMax: max ? Number(max) : undefined, maxPostulantes: maxPost ? Number(maxPost) : undefined,
    duracionMeses: duracion && !errDuracion ? meses : undefined, imagenUrl: imagen, documentos: docs, fechaCierre: fechaCierreIso ?? new Date(minCierre + 'T23:59:59').toISOString(), estado: 'Abierta', createdAt: new Date().toISOString(), postulantes: 0,
  }

  const subirImagen = (f?: File) => {
    if (!f) return
    if (f.size > 2_000_000) { toast.error('La imagen no puede superar los 2 MB.'); return }
    const r = new FileReader()
    r.onload = () => setImagen(String(r.result))
    r.readAsDataURL(f)
  }
  // Hasta MAX_DOCUMENTOS archivos reales (el primero queda como documento principal) para que las Pymes los vean o descarguen.
  const totalBytes = docs.reduce((s, d) => s + d.tamanoKb * 1024, 0)
  const agregarDocs = (files: FileList | null) => {
    const lista = Array.from(files ?? [])
    const libres = MAX_DOCUMENTOS - docs.length
    if (lista.length > libres) toast.error(`Puedes adjuntar hasta ${MAX_DOCUMENTOS} documentos. Se agregaron solo los primeros ${Math.max(0, libres)}.`)
    let suma = totalBytes
    for (const f of lista.slice(0, Math.max(0, libres))) {
      if (f.size > MAX_DOCUMENTO_BYTES) { toast.error(`«${f.name}» supera los 8 MB.`); continue }
      if (docs.some((d) => d.nombre === f.name)) { toast.error(`«${f.name}» ya está en la lista.`); continue }
      if (suma + f.size > MAX_PUBLICAR_BYTES) { toast.error(`«${f.name}» no cabe: al publicar los documentos pueden sumar hasta 16 MB. Agrégalo después desde el detalle de la licitación.`); continue }
      suma += f.size
      const r = new FileReader()
      r.onload = () => setDocs((ds) => [...ds, { nombre: f.name, tipo: tipoArchivo(f.name), tamanoKb: Math.max(1, Math.round(f.size / 1024)), contenido: String(r.result) }])
      r.onerror = () => toast.error(`No se pudo leer «${f.name}».`)
      r.readAsDataURL(f)
    }
  }

  const publicar = async () => {
    const e: Record<string, string> = {}
    if (titulo.trim().length < 8) e.titulo = 'Describe el título (mínimo 8 caracteres)'
    if (descripcion.trim().length < 30) e.descripcion = 'Explica la necesidad con más detalle (mínimo 30 caracteres)'
    else if (PENDIENTE_PLANTILLA.test(descripcion)) e.descripcion = 'Completa o borra los textos entre [corchetes] de la plantilla'
    if (!rubroId) e.rubroId = 'Selecciona un rubro'
    if (!regionId) e.regionId = 'Selecciona una región'
    if (!cierre) e.cierre = 'Define la fecha de cierre'
    else if (errCierre) e.cierre = errCierre
    if (errMax) e.max = errMax
    if (!duracion) e.duracion = 'Indica cuántos meses dura el proyecto'
    else if (errDuracion) e.duracion = errDuracion
    setErrores(e)
    if (Object.keys(e).length) { toast.error('Revisa los campos marcados.'); return }
    setEnviando(true)
    try {
      const l = await api.crearLicitacion({
        titulo: titulo.trim(), descripcion: descripcion.trim(), rubroId, regionId, presupuestoMin: min ? Number(min) : undefined, presupuestoMax: max ? Number(max) : undefined,
        maxPostulantes: maxPost ? Number(maxPost) : undefined, duracionMeses: meses, imagenUrl: imagen, documentos: docs, fechaCierre: new Date(cierre + 'T23:59:59').toISOString(),
        documentosRequeridos: pedidos,
      })
      toast.ok('¡Licitación publicada! Ya es visible para las Pymes.')
      navigate(`/app/licitacion/${l.id}`)
    } catch (err) { toast.error((err as Error).message) } finally { setEnviando(false) }
  }

  return (
    <div className="stack pub-page">
      <PageHeader back={<VolverLink to="/app/licitaciones" texto="Mis licitaciones" />} title="Publicar licitación" subtitle="Es gratis. Cuéntale a las Pymes qué necesitas." />
      <div className="pub-layout">
      <div className="stack">
      <Card>
        <CardHeader icon="file" title="Información general" />
        <div className="form-grid">
          <Field label="Título" required error={errores.titulo} className="span-2"><Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ej: Servicio de mantención de flota de grúas" maxLength={120} /></Field>
          <Field label="Descripción detallada" required error={errores.descripcion} hint={descripcion === plantilla && plantilla ? `Plantilla de ${rubroNombre}: reemplaza los textos entre [corchetes] con tu información.` : `${descripcion.length} caracteres`} className="span-2"><Textarea rows={descripcion === plantilla && plantilla ? 14 : 8} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Alcance, requisitos, plazos, condiciones de pago…" /></Field>
          <Field label="Rubro" required error={errores.rubroId}>
            <Select value={rubroId} onChange={(e) => setRubroId(Number(e.target.value))}><option value={0}>Selecciona rubro</option>{cat.rubros.map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}</Select>
          </Field>
          <Field label="Región de ejecución" required error={errores.regionId}>
            <Select value={regionId} onChange={(e) => setRegionId(Number(e.target.value))}><option value={0}>Selecciona región</option>{cat.regiones.map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}</Select>
          </Field>
        </div>
      </Card>
      <Card>
        <CardHeader icon="dollar" title="Presupuesto y plazos" />
        <div className="form-grid">
          <Field label="Presupuesto mínimo (CLP)"><Input type="number" min={0} value={min} onChange={(e) => setMin(e.target.value)} placeholder="1000000" /></Field>
          <Field label="Presupuesto máximo (CLP)" error={errores.max ?? errMax}><Input type="number" min={0} value={max} onChange={(e) => setMax(e.target.value)} placeholder="3000000" /></Field>
          {referencia && <div className="span-2"><SugerenciaPresupuesto referencia={referencia} rubro={rubroNombre} min={min} max={max} usar={(d, h) => { setMin(String(d)); setMax(String(h)) }} /></div>}
          <Field label="Fecha de cierre" required error={errores.cierre ?? errCierre} hint={`Mínimo ${PLAZO_MINIMO_DIAS} días desde hoy.`}><Input icon="calendar" type="date" min={minCierre} value={cierre} onChange={(e) => setCierre(e.target.value)} /></Field>
          <Field label="Duración del proyecto (meses)" required error={errores.duracion ?? errDuracion} hint="Tiempo de contrato que gana la Pyme adjudicada. Ej: 12."><Input icon="briefcase" type="number" min={1} max={DURACION_MAX_MESES} step={1} value={duracion} onChange={(e) => setDuracion(e.target.value)} placeholder="12" /></Field>
          <Field label="Máximo de postulantes" hint="Opcional. Déjalo vacío para no limitar."><Input type="number" min={1} value={maxPost} onChange={(e) => setMaxPost(e.target.value)} placeholder="10" /></Field>
        </div>
      </Card>
      <Card>
        <CardHeader icon="paperclip" title="Imagen y documentos" subtitle={`Opcional · hasta ${MAX_DOCUMENTOS} documentos (PDF, DOCX o XLSX, hasta 8 MB cada uno)`} />
        <div className="upload-row">
          <div className="upload" onClick={() => refImg.current?.click()}>
            {imagen ? <img src={imagen} alt="Imagen de la licitación" /> : <><Icon name="image" size={26} /><b>Imagen de portada</b><small>JPG o PNG, hasta 2 MB</small></>}
            <input ref={refImg} type="file" accept="image/*" hidden onChange={(e) => subirImagen(e.target.files?.[0])} />
          </div>
          <div className={`upload upload-docs ${docs.length >= MAX_DOCUMENTOS ? 'lleno' : ''}`} onClick={() => docs.length < MAX_DOCUMENTOS && refDoc.current?.click()}>
            <Icon name="upload" size={26} />
            <b>{docs.length >= MAX_DOCUMENTOS ? 'Máximo de documentos' : docs.length ? 'Agregar otro documento' : 'Subir documentos'}</b>
            <small>{docs.length ? `${docs.length} de ${MAX_DOCUMENTOS} · ` : ''}Bases técnicas, anexos, planos…</small>
            <input ref={refDoc} type="file" multiple accept=".pdf,.doc,.docx,.xls,.xlsx" hidden onChange={(e) => { agregarDocs(e.target.files); e.target.value = '' }} />
          </div>
        </div>
        {docs.length > 0 && (
          <ul className="doc-list">
            {docs.map((d, i) => (
              <li key={d.nombre + i}>
                <span className="doc-ic"><Icon name="file" size={18} /></span>
                <div><b>{d.nombre}</b><small>{i === 0 ? 'Documento principal · ' : ''}{d.tipo} · {d.tamanoKb} KB</small></div>
                <button className="icon-btn" onClick={() => setDocs(docs.filter((_, k) => k !== i))} aria-label="Quitar"><Icon name="x" size={16} /></button>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <DocumentosSolicitados rubro={rubroNombre} valor={pedidos} onChange={setPedidos} />
      <div className="form-actions">
        <Button variant="ghost" onClick={() => navigate('/app/licitaciones')}>Cancelar</Button>
        <Button size="lg" icon="send" loading={enviando} onClick={publicar}>Publicar licitación</Button>
      </div>
      </div>
      <PanelPublicar vista={vista} alcance={alcance} rubro={rubroNombre} region={regionId ? cat.region(regionId) : ''} cierre={fechaCierreIso}
        datos={{ titulo, descripcion, rubroId, regionId, min, max, cierreValido: !!cierre && !errCierre, maxPost, documento: docs.length > 0, imagen: !!imagen }} />
      </div>
    </div>
  )
}
