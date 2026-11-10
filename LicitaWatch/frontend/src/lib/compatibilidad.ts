import type { Licitacion, Perfil } from '../api/types'

/* «Compatibilidad contigo» del detalle de licitación para la Pyme: se calcula en el navegador con su perfil. */

/** Tamaño ideal según el presupuesto máximo (ids del catálogo tamano_empresa: 1 Pequeña, 2 Mediana, 3 Grande); undefined = cualquiera calza. */
export function tamanoIdeal(presupuestoMax?: number): number | undefined {
  if (presupuestoMax == null) return undefined
  return presupuestoMax <= 5_000_000 ? 1 : presupuestoMax <= 25_000_000 ? 2 : 3
}

export interface ChipCompat { texto: string; ok: boolean; aviso?: boolean }

/** Campos del perfil que cuentan para «perfil completo» (15 puntos repartidos entre ellos). */
const CAMPOS_PERFIL: { ok: (p: Perfil) => boolean; falta: string }[] = [
  { ok: (p) => (p.descripcionEmpresa ?? '').trim().length >= 30, falta: 'Completa la descripción de tu empresa' },
  { ok: (p) => !!p.sitioWeb?.trim(), falta: 'Agrega tu sitio web' },
  { ok: (p) => !!p.tamanoEmpresaId, falta: 'Indica el tamaño de tu empresa' },
  { ok: (p) => !!p.telefono?.trim(), falta: 'Agrega un teléfono' },
]

/** Rubro 40, región 30, tamaño ideal 15 y perfil completo 15 (proporcional a los campos completos). */
export function compatibilidad(l: Licitacion, p: Perfil, regionPyme: number | undefined, nombreTamano: (id?: number) => string) {
  const mismoRubro = l.rubroId === p.rubroId
  const mismaRegion = regionPyme != null && l.regionId === regionPyme
  const ideal = tamanoIdeal(l.presupuestoMax)
  const tamanoOk = !!p.tamanoEmpresaId && (ideal == null || ideal === p.tamanoEmpresaId)
  const completos = CAMPOS_PERFIL.filter((c) => c.ok(p)).length
  const pct = Math.round((mismoRubro ? 40 : 0) + (mismaRegion ? 30 : 0) + (tamanoOk ? 15 : 0) + 15 * completos / CAMPOS_PERFIL.length)

  const chips: ChipCompat[] = [
    { texto: mismoRubro ? 'Mismo rubro' : 'Otro rubro', ok: mismoRubro },
    { texto: mismaRegion ? 'Misma región' : 'Otra región', ok: mismaRegion },
    { texto: ideal == null ? 'Cualquier tamaño' : tamanoOk ? 'Tamaño ideal' : `Ideal: empresa ${nombreTamano(ideal).toLowerCase()}`, ok: tamanoOk },
    ...CAMPOS_PERFIL.filter((c) => !c.ok(p)).map((c) => ({ texto: c.falta, ok: false, aviso: true })),
  ]
  return { pct, chips }
}
