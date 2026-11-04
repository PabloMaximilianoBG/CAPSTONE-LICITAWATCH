/* Silueta simplificada de Chile en SVG, dividida en las 16 regiones del catálogo (ids 1–16 de norte a sur) por franjas norte-sur. */

/** Latitud sur aproximada de los límites entre regiones: la franja i va de LIMITES[i] a LIMITES[i + 1]. */
const LIMITES = [17.5, 19.2, 21.6, 26, 29.3, 32.2, 33, 34.2, 35, 36.4, 37, 38.3, 39.6, 40.4, 43.6, 49, 56]
/** Borde oeste y este de la silueta en cada límite (unidades del viewBox de 60 de ancho); Magallanes se abre hacia Tierra del Fuego. */
const BORDES: [number, number][] = [[26, 34], [26, 35], [25, 36], [23, 35], [21, 34], [20, 33], [20, 33], [19, 33], [19, 33], [18, 32],
  [17, 32], [17, 32], [16, 31], [15, 31], [12, 29], [8, 28], [14, 44]]
/** Alto mínimo de cada franja para que las regiones angostas (Valparaíso, Ñuble…) se puedan ver y resaltar. */
const MIN_FRANJA = 1.4
const ALTO = 300

const franjas = (() => {
  const altos = LIMITES.slice(1).map((l, i) => Math.max(l - LIMITES[i], MIN_FRANJA))
  const escala = (ALTO - 8) / altos.reduce((s, a) => s + a, 0)
  let y = 4
  return altos.map((a, i) => {
    const y0 = y, y1 = y + a * escala; y = y1
    const [o0, e0] = BORDES[i], [o1, e1] = BORDES[i + 1]
    return { regionId: i + 1, y0, y1, d: `M${o0},${y0} L${e0},${y0} L${e1},${y1} L${o1},${y1} Z`, cx: (o0 + e0 + o1 + e1) / 4 }
  })
})()

/**
 * Mapa de Chile con la región de la licitación resaltada y un punto verde por cada región de origen de las postulaciones
 * (el punto crece con la cantidad). nombreRegion se usa para el aria-label y los títulos.
 */
export function ChileMap({ regionId, origenes = {}, nombreRegion, alto = ALTO }: {
  regionId?: number; origenes?: Record<number, number>; nombreRegion: (id: number) => string; alto?: number
}) {
  const conPostulaciones = Object.entries(origenes).filter(([, n]) => n > 0)
  const etiqueta = `Mapa de Chile. Región de la licitación: ${regionId ? nombreRegion(regionId) : 'sin definir'}.`
    + (conPostulaciones.length ? ` Postulaciones desde: ${conPostulaciones.map(([r, n]) => `${nombreRegion(Number(r))} (${n})`).join(', ')}.` : ' Aún sin postulaciones.')
  return (
    <svg className="chile-map" viewBox={`0 0 60 ${ALTO}`} height={alto} role="img" aria-label={etiqueta}>
      {franjas.map((f) => (
        <path key={f.regionId} d={f.d} className={f.regionId === regionId ? 'sel' : ''}><title>{nombreRegion(f.regionId)}</title></path>
      ))}
      {franjas.filter((f) => (origenes[f.regionId] ?? 0) > 0).map((f) => (
        <circle key={f.regionId} cx={f.cx} cy={(f.y0 + f.y1) / 2} r={Math.min(2.2 + origenes[f.regionId] * 0.6, 4.5)} className="punto">
          <title>{`${origenes[f.regionId]} postulación${origenes[f.regionId] === 1 ? '' : 'es'} desde ${nombreRegion(f.regionId)}`}</title>
        </circle>
      ))}
    </svg>
  )
}
