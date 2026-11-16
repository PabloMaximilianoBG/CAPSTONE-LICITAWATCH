import { useCallback, useEffect, useState } from 'react'

/*
 * Licitaciones guardadas ⭐ de la Pyme: ids en el navegador (por usuario, sin BD).
 * Un evento sincroniza la estrella de las tarjetas, el detalle, la página «Guardadas» y el contador del menú.
 */
const EVENTO = 'lw:guardadas'
const clave = (usuarioId: number) => `lw_guardadas_${usuarioId}`

function leer(usuarioId: number): number[] {
  try { const v = JSON.parse(localStorage.getItem(clave(usuarioId)) ?? '[]'); return Array.isArray(v) ? v.filter((x) => typeof x === 'number') : [] } catch { return [] }
}

export function useGuardadas(usuarioId: number | undefined) {
  const [ids, setIds] = useState<number[]>(() => (usuarioId ? leer(usuarioId) : []))
  useEffect(() => {
    if (!usuarioId) return
    setIds(leer(usuarioId))
    const h = () => setIds(leer(usuarioId))
    window.addEventListener(EVENTO, h)
    return () => window.removeEventListener(EVENTO, h)
  }, [usuarioId])
  /** Guarda o quita; las más recientes primero. Devuelve true si quedó guardada. */
  const alternar = useCallback((licitacionId: number) => {
    if (!usuarioId) return false
    const actual = leer(usuarioId), esta = actual.includes(licitacionId)
    const nuevo = esta ? actual.filter((x) => x !== licitacionId) : [licitacionId, ...actual]
    try { localStorage.setItem(clave(usuarioId), JSON.stringify(nuevo)) } catch { /* sin almacenamiento */ }
    window.dispatchEvent(new Event(EVENTO))
    return !esta
  }, [usuarioId])
  return { ids, guardada: (id: number) => ids.includes(id), alternar }
}
