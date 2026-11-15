export class ApiError extends Error {
  status: number
  constructor(message: string, status = 400) {
    super(message)
    this.status = status
  }
}

/** Evento global cuando el servidor rechaza la sesión (cerrada desde otro dispositivo o vencida): AuthContext lleva al login con el aviso. */
export const EVENTO_SESION = 'lw:sesion-terminada'
export type MotivoSesion = 'cerrada' | 'expirada'
export function avisarSesionTerminada(mensaje: string) {
  const motivo: MotivoSesion = /cerrada/i.test(mensaje) ? 'cerrada' : 'expirada'
  try { window.dispatchEvent(new CustomEvent<MotivoSesion>(EVENTO_SESION, { detail: motivo })) } catch { /* sin ventana (pruebas) */ }
}
