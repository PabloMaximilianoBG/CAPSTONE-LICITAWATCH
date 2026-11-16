import type { PuntoMensual } from '../api/types'

/** «Buenos días» (5 a 12 h), «Buenas tardes» (12 a 20 h) o «Buenas noches», según la hora del computador. */
export function saludoSegunHora(fecha = new Date()): string {
  const h = fecha.getHours()
  return h >= 5 && h < 12 ? 'Buenos días' : h >= 12 && h < 20 ? 'Buenas tardes' : 'Buenas noches'
}

/** «lunes 16 de noviembre» en español de Chile. */
export function fechaLarga(fecha = new Date()): string {
  return fecha.toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' })
}

/** Variación del último mes contra el anterior (serie «porMes» de los resúmenes): texto y tono para la etiqueta del indicador. */
export function tendenciaMensual(porMes: PuntoMensual[]): { texto: string; tono: 'sube' | 'baja' | 'igual' } | null {
  if (porMes.length < 2) return null
  const actual = porMes[porMes.length - 1].valor, anterior = porMes[porMes.length - 2].valor
  const d = actual - anterior
  if (d > 0) return { texto: `↑ ${d} más que el mes pasado`, tono: 'sube' }
  if (d < 0) return { texto: `↓ ${-d} menos que el mes pasado`, tono: 'baja' }
  return { texto: actual === 0 ? 'Sin movimiento este mes' : '= igual que el mes pasado', tono: 'igual' }
}
