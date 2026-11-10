import type { Suscripcion } from '../api/types'

/** Misma verificación que bloquea LicitAsist en el menú lateral (el backend también la valida). */
export const esPremium = (s?: Suscripcion | null): boolean => s?.plan.nombre === 'Premium'
