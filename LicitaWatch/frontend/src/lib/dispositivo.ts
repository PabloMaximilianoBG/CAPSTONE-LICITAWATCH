/* Dispositivo y navegador a partir del User-Agent (mismas reglas que SesionService en ms-usuarios-bs); lo usa el modo simulado. */

export function navegadorDe(ua: string): string {
  if (!ua) return 'Navegador desconocido'
  if (ua.includes('Edg/')) return 'Edge'
  if (ua.includes('OPR/') || ua.includes('Opera')) return 'Opera'
  if (ua.includes('SamsungBrowser/')) return 'Samsung Internet'
  if (ua.includes('Firefox/') || ua.includes('FxiOS/')) return 'Firefox'
  if (ua.includes('Chrome/') || ua.includes('CriOS/')) return 'Chrome'
  if (ua.includes('Safari/')) return 'Safari'
  return 'Navegador desconocido'
}

export function dispositivoDe(ua: string): string {
  if (!ua) return 'Dispositivo desconocido'
  if (ua.includes('iPad')) return 'iPad · Tablet'
  if (ua.includes('iPhone')) return 'iPhone · Celular'
  if (ua.includes('Android')) return `Android · ${ua.includes('Mobile') ? 'Celular' : 'Tablet'}`
  if (ua.includes('Windows')) return 'Windows · Computador'
  if (ua.includes('Mac OS X') || ua.includes('Macintosh')) return 'macOS · Computador'
  if (ua.includes('CrOS')) return 'ChromeOS · Computador'
  if (ua.includes('Linux')) return 'Linux · Computador'
  return 'Dispositivo desconocido'
}

/** Oculta el último octeto: 190.22.15.*** */
export const ipParcial = (ip: string) => (ip.includes('.') && !ip.includes(':') ? ip.slice(0, ip.lastIndexOf('.')) + '.***' : ip)
