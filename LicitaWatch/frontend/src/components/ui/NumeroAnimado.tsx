import { useEffect, useRef, useState } from 'react'

/* Número que «cuenta» desde 0 hasta su valor al aparecer (paneles de control del Licitador y la Pyme). */

const DURACION_MS = 900
const reducirMovimiento = () => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches } catch { return false } }

/**
 * Cuenta de 0 a `valor` una sola vez, al montarse (con aceleración suave al final). Si después cambia el valor, se muestra directo.
 * decimales: cifras decimales (coma chilena); sufijo: p. ej. «%». Con «reducir movimiento» activo, muestra el valor sin animar.
 * Devuelve solo texto, así que sirve también dentro de un <text> de SVG (centro del gráfico circular).
 */
export function NumeroAnimado({ valor, decimales = 0, sufijo = '' }: { valor: number; decimales?: number; sufijo?: string }) {
  const [actual, setActual] = useState(() => (reducirMovimiento() ? valor : 0))
  const animado = useRef(false)
  useEffect(() => {
    if (animado.current || reducirMovimiento() || valor === 0) { animado.current = true; setActual(valor); return }
    animado.current = true
    let raf = 0, terminado = false
    const inicio = performance.now()
    const paso = (t: number) => {
      const p = Math.min(1, (t - inicio) / DURACION_MS)
      setActual(valor * (1 - Math.pow(1 - p, 3)))   // ease-out cúbico
      if (p < 1) raf = requestAnimationFrame(paso); else terminado = true
    }
    raf = requestAnimationFrame(paso)
    // Si se interrumpe antes de terminar (React en desarrollo monta dos veces), la próxima vez vuelve a animar.
    return () => { cancelAnimationFrame(raf); if (!terminado) animado.current = false }
  }, [valor])
  const texto = actual.toLocaleString('es-CL', { minimumFractionDigits: decimales, maximumFractionDigits: decimales })
  return <>{texto}{sufijo}</>
}
