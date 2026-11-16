import { useCallback, useEffect, useState } from 'react'

/*
 * Modo oscuro de la app interna (Licitador y Pyme). Se guarda en el navegador y se aplica con data-tema="oscuro" en <html>,
 * solo mientras se está dentro de la app: las páginas públicas (inicio, login, registro) y el Admin siguen en claro.
 */
export type Tema = 'claro' | 'oscuro'
const CLAVE = 'lw_tema'

export function temaGuardado(): Tema { try { return localStorage.getItem(CLAVE) === 'oscuro' ? 'oscuro' : 'claro' } catch { return 'claro' } }

/** activo = el usuario está en la app interna con rol Licitador o Pyme. Al salir de la app se quita el tema oscuro. */
export function useTema(activo: boolean) {
  const [tema, setTema] = useState<Tema>(temaGuardado)
  useEffect(() => {
    const html = document.documentElement
    if (activo && tema === 'oscuro') html.dataset.tema = 'oscuro'; else delete html.dataset.tema
    return () => { delete html.dataset.tema }
  }, [activo, tema])
  const alternar = useCallback(() => setTema((t) => {
    const n: Tema = t === 'oscuro' ? 'claro' : 'oscuro'
    try { localStorage.setItem(CLAVE, n) } catch { /* sin almacenamiento: solo esta visita */ }
    return n
  }), [])
  return { tema, alternar }
}
