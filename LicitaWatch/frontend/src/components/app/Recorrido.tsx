import { useCallback, useEffect, useLayoutEffect, useState, type CSSProperties } from 'react'
import type { Rol } from '../../api/types'
import { Button } from '../ui/ui'
import { Icon, type IconName } from '../../lib/icons'
import { useLocation } from '../../lib/router'

/*
 * Recorrido guiado (Licitador y Pyme): ilumina partes de la página con un globo explicativo.
 * Aparece una sola vez, en la primera entrada al panel, solo a las cuentas creadas desde RECORRIDO_DESDE
 * (se recuerda en el navegador, sin BD). Se puede volver a ver desde Ayuda con verRecorrido().
 */

/** Las cuentas creadas antes de esta fecha no ven el recorrido automáticamente (solo desde Ayuda). */
const RECORRIDO_DESDE = '2026-11-16T00:00:00-03:00'
const EVENTO = 'lw:ver-recorrido'
const claveVisto = (usuarioId: number) => `lw_recorrido_visto_${usuarioId}`

/** Abre el recorrido desde cualquier parte (p. ej. el botón «Ver recorrido» de Ayuda). */
export function verRecorrido() { window.dispatchEvent(new Event(EVENTO)) }

interface Paso { selector?: string; icon: IconName; titulo: string; texto: string }
const menu = (ruta: string) => `.sidebar a.sb-link[href="${ruta}"]`

const PASOS: Record<'LICITADOR' | 'PYME', (nombre: string) => Paso[]> = {
  PYME: (nombre) => [
    { icon: 'sparkles', titulo: `¡Hola${nombre ? `, ${nombre}` : ''}! Bienvenido a LicitaWatch`, texto: 'Te mostramos dónde está cada cosa en menos de un minuto.' },
    { selector: menu('/app/explorar'), icon: 'search', titulo: 'Explorar licitaciones', texto: 'Encuentra oportunidades por rubro, región y presupuesto, y postula desde el detalle de cada una.' },
    { selector: menu('/app/postulaciones'), icon: 'send', titulo: 'Mis postulaciones', texto: 'Sigue el estado de tus propuestas: pendiente, aprobada, rechazada o adjudicada.' },
    { selector: menu('/app/asistente'), icon: 'sparkles', titulo: 'LicitAsist (IA)', texto: 'Tu asistente analiza licitaciones, arma tu plan del mes y revisa tus mensajes. Es parte del plan Premium.' },
    { selector: '.topbar .bell', icon: 'bell', titulo: 'Notificaciones', texto: 'Aquí te avisamos cuando un Licitador responde o se publica una licitación de tu rubro.' },
    { selector: menu('/app/perfil'), icon: 'user', titulo: 'Mi perfil y Configuración', texto: 'Completa tu perfil para subir tu compatibilidad, y protege tu cuenta desde Configuración.' },
  ],
  LICITADOR: (nombre) => [
    { icon: 'sparkles', titulo: `¡Hola${nombre ? `, ${nombre}` : ''}! Bienvenido a LicitaWatch`, texto: 'Te mostramos dónde está cada cosa en menos de un minuto.' },
    { selector: menu('/app/licitaciones/nueva'), icon: 'plus', titulo: 'Publicar licitación', texto: 'Publica lo que necesitas, gratis y sin límites. Te ayudamos con plantillas por rubro.' },
    { selector: menu('/app/licitaciones'), icon: 'file', titulo: 'Mis licitaciones', texto: 'Revisa las postulaciones de cada licitación, apruébalas o recházalas y adjudica a la mejor Pyme.' },
    { selector: menu('/app/chat'), icon: 'chat', titulo: 'Chat', texto: 'Al adjudicar se abre un chat privado con la Pyme para coordinar el trabajo.' },
    { selector: '.topbar .bell', icon: 'bell', titulo: 'Notificaciones', texto: 'Aquí te avisamos cuando una Pyme postula a tus licitaciones.' },
    { selector: menu('/app/perfil'), icon: 'user', titulo: 'Mi perfil y Configuración', texto: 'Mantén al día los datos de tu empresa y protege tu cuenta desde Configuración.' },
  ],
}

/** Rectángulo del elemento si está visible en pantalla (en celular el menú lateral está oculto). */
function rectDe(selector?: string): DOMRect | null {
  if (!selector) return null
  const el = document.querySelector(selector)
  if (!el) return null
  const r = el.getBoundingClientRect()
  return r.width > 0 && r.height > 0 && r.right > 0 && r.left < window.innerWidth ? r : null
}

export function Recorrido({ rol, usuarioId, nombre, creadaAt }: { rol: Rol; usuarioId: number; nombre: string; creadaAt: string }) {
  const { path } = useLocation()
  const [paso, setPaso] = useState<number | null>(null)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const pasos = rol === 'LICITADOR' || rol === 'PYME' ? PASOS[rol](nombre.split(' ')[0] ?? '') : []

  // Primera entrada al panel de una cuenta nueva.
  useEffect(() => {
    if (!pasos.length || path !== '/app') return
    let visto = true
    try { visto = !!localStorage.getItem(claveVisto(usuarioId)) } catch { /* sin almacenamiento: no se muestra */ }
    if (!visto && new Date(creadaAt).getTime() >= new Date(RECORRIDO_DESDE).getTime()) { const t = setTimeout(() => setPaso(0), 600); return () => clearTimeout(t) }
  }, [path]) // eslint-disable-line react-hooks/exhaustive-deps

  // Desde Ayuda: «Ver recorrido».
  useEffect(() => {
    const h = () => { if (pasos.length) setPaso(0) }
    window.addEventListener(EVENTO, h)
    return () => window.removeEventListener(EVENTO, h)
  }, [pasos.length])

  const cerrar = useCallback(() => {
    setPaso(null)
    try { localStorage.setItem(claveVisto(usuarioId), new Date().toISOString()) } catch { /* nada */ }
  }, [usuarioId])

  // Posición del elemento iluminado (se recalcula al cambiar de paso, al hacer scroll o cambiar el tamaño de la ventana).
  useLayoutEffect(() => {
    if (paso == null) return
    const actualizar = () => setRect(rectDe(pasos[paso]?.selector))
    const selector = pasos[paso]?.selector
    if (selector) document.querySelector(selector)?.scrollIntoView({ block: 'nearest' })   // la bienvenida no ilumina nada (querySelector('') lanza error)
    actualizar()
    window.addEventListener('resize', actualizar); window.addEventListener('scroll', actualizar, true)
    return () => { window.removeEventListener('resize', actualizar); window.removeEventListener('scroll', actualizar, true) }
  }, [paso]) // eslint-disable-line react-hooks/exhaustive-deps

  // Teclado: flechas para avanzar o retroceder, Esc para saltar.
  useEffect(() => {
    if (paso == null) return
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cerrar()
      if (e.key === 'ArrowRight') { if (paso < pasos.length - 1) setPaso(paso + 1); else cerrar() }
      if (e.key === 'ArrowLeft' && paso > 0) setPaso(paso - 1)
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [paso, pasos.length, cerrar])

  if (paso == null || !pasos[paso]) return null
  const p = pasos[paso], ultimo = paso === pasos.length - 1
  const MARGEN = 8, ANCHO = 330
  // Globo a la derecha del elemento si cabe; si no, debajo; sin elemento (o en celular), centrado.
  let estilo: CSSProperties | undefined
  if (rect) {
    const derecha = rect.right + 16 + ANCHO < window.innerWidth
    estilo = derecha
      ? { top: Math.max(16, Math.min(rect.top + rect.height / 2 - 90, window.innerHeight - 220)), left: rect.right + 16 }
      : { top: Math.min(rect.bottom + 14, window.innerHeight - 220), left: Math.max(16, Math.min(rect.left, window.innerWidth - ANCHO - 16)) }
  }
  return (
    <div className="rec" role="dialog" aria-modal="true" aria-label={`Recorrido: paso ${paso + 1} de ${pasos.length}`}>
      {rect
        ? <div className="rec-luz" style={{ top: rect.top - MARGEN, left: rect.left - MARGEN, width: rect.width + MARGEN * 2, height: rect.height + MARGEN * 2 }} />
        : <div className="rec-fondo" />}
      <div className={`rec-globo ${rect ? '' : 'centro'}`} style={estilo}>
        <div className="rec-cab"><span className="rec-ic"><Icon name={p.icon} size={18} /></span><small>{paso + 1} de {pasos.length}</small>
          <button type="button" className="icon-btn" onClick={cerrar} aria-label="Cerrar recorrido"><Icon name="x" size={16} /></button></div>
        <h4>{p.titulo}</h4>
        <p>{p.texto}</p>
        <div className="rec-puntos">{pasos.map((_, i) => <i key={i} className={i === paso ? 'on' : ''} />)}</div>
        <div className="rec-pie">
          {paso === 0 ? <Button size="sm" variant="ghost" onClick={cerrar}>Saltar</Button> : <Button size="sm" variant="ghost" onClick={() => setPaso(paso - 1)}>Anterior</Button>}
          <Button size="sm" iconRight={ultimo ? undefined : 'arrowright'} icon={ultimo ? 'check' : undefined} onClick={() => (ultimo ? cerrar() : setPaso(paso + 1))}>{ultimo ? '¡Listo!' : paso === 0 ? 'Comenzar' : 'Siguiente'}</Button>
        </div>
      </div>
    </div>
  )
}
