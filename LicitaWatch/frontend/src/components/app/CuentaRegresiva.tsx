import { useEffect, useState } from 'react'

/* Cuenta regresiva en vivo al cierre de una licitación (se actualiza cada segundo). */

/** Días a partir de los cuales se muestra el reloj en vez de «Cierra en N días». */
export const DIAS_RELOJ = 7

/** ¿Corresponde mostrar el reloj? (abierta y con DIAS_RELOJ días o menos para cerrar). */
export function conReloj(fechaCierre: string): boolean {
  const ms = new Date(fechaCierre).getTime() - Date.now()
  return ms > 0 && ms <= DIAS_RELOJ * 86_400_000
}

const dos = (n: number) => String(n).padStart(2, '0')

/** Relojito con la manecilla girando: indica a simple vista que el tiempo está corriendo. */
function RelojAnimado() {
  return (
    <svg className="cuenta-reloj" viewBox="0 0 24 24" width="17" height="17" aria-hidden>
      <circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" strokeWidth="2" />
      <line x1="12" y1="12" x2="12" y2="8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line className="cuenta-manecilla" x1="12" y1="12" x2="12" y2="5.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="12" cy="12" r="1.3" fill="currentColor" />
    </svg>
  )
}

/**
 * «Cierra en 4d 21:05:33» o, el último día, «Cierra en 05:42:18» (con clase «urgente»), con un relojito animado.
 * prefijo vacío = solo el reloj; icono = false si quien lo usa ya muestra un ícono de reloj al lado.
 */
export function CuentaRegresiva({ hasta, prefijo = 'Cierra en', icono = true }: { hasta: string; prefijo?: string; icono?: boolean }) {
  const [ahora, setAhora] = useState(() => Date.now())
  useEffect(() => { const t = setInterval(() => setAhora(Date.now()), 1000); return () => clearInterval(t) }, [])
  const ms = new Date(hasta).getTime() - ahora
  if (ms <= 0) return <span className="cuenta">Cerrada</span>
  const s = Math.floor(ms / 1000), d = Math.floor(s / 86_400), h = Math.floor((s % 86_400) / 3600), m = Math.floor((s % 3600) / 60), seg = s % 60
  const reloj = `${d > 0 ? `${d}d ` : ''}${dos(h)}:${dos(m)}:${dos(seg)}`
  return (
    <span className={`cuenta ${d === 0 ? 'urgente' : ''}`} title={`Cierra el ${new Date(hasta).toLocaleString('es-CL')}`}>
      {icono && <RelojAnimado />}{prefijo ? `${prefijo} ` : ''}<b>{reloj}</b>
    </span>
  )
}
