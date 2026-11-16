/*
 * Confeti de celebración sin librerías: un <canvas> encima de la página durante ~3 segundos que luego se elimina.
 * Se usa en momentos clave (publicar, adjudicar, ganar una licitación, pasar a Premium). Respeta «reducir movimiento».
 */
const COLORES = ['#3b5bff', '#0fb5a6', '#7c5cff', '#f59e0b', '#16a34a', '#ef4444', '#facc15']

export function lanzarConfeti(cantidad = 320) {
  try { if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return } catch { /* sin matchMedia: se lanza igual */ }
  const canvas = document.createElement('canvas')
  canvas.className = 'confeti'
  canvas.setAttribute('aria-hidden', 'true')
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  canvas.width = window.innerWidth * dpr; canvas.height = window.innerHeight * dpr
  document.body.appendChild(canvas)
  const ctx = canvas.getContext('2d')
  if (!ctx) { canvas.remove(); return }
  ctx.scale(dpr, dpr)
  const W = window.innerWidth, H = window.innerHeight
  // Dos ráfagas desde las esquinas inferiores hacia el centro, más una lluvia suave desde arriba.
  const piezas = Array.from({ length: cantidad }, (_, i) => {
    const lado = i % 3, desdeAbajo = lado < 2
    const ang = desdeAbajo ? (lado === 0 ? -Math.PI / 3 : -2 * Math.PI / 3) + (Math.random() - .5) * .7 : Math.PI / 2
    const vel = desdeAbajo ? 14 + Math.random() * 10 : 2 + Math.random() * 3
    return {
      x: desdeAbajo ? (lado === 0 ? 0 : W) : Math.random() * W, y: desdeAbajo ? H : -20 - Math.random() * H * .3,
      vx: Math.cos(ang) * vel, vy: Math.sin(ang) * vel, giro: Math.random() * Math.PI, vgiro: (Math.random() - .5) * .3,
      ancho: 9 + Math.random() * 8, alto: 6 + Math.random() * 8,
      color: COLORES[i % COLORES.length], circulo: Math.random() < .25,
      espera: i % 2 === 0 ? 0 : 450 + Math.random() * 500,   // la mitad sale en una segunda ráfaga
    }
  })
  const inicio = performance.now(), DURACION = 5500
  const cuadro = (t: number) => {
    const p = (t - inicio) / DURACION
    ctx.clearRect(0, 0, W, H)
    ctx.globalAlpha = p > .8 ? Math.max(0, 1 - (p - .8) / .2) : 1   // se desvanece al final
    for (const c of piezas) {
      if (t - inicio < c.espera) continue
      c.vy += 0.22; c.vx *= 0.99; c.vy *= 0.99; c.x += c.vx; c.y += c.vy; c.giro += c.vgiro
      ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(c.giro); ctx.fillStyle = c.color
      if (c.circulo) { ctx.beginPath(); ctx.arc(0, 0, c.ancho / 2.5, 0, Math.PI * 2); ctx.fill() }
      else ctx.fillRect(-c.ancho / 2, -c.alto / 2, c.ancho, c.alto * Math.abs(Math.cos(c.giro)))   // «voltea» al girar
      ctx.restore()
    }
    if (p < 1) requestAnimationFrame(cuadro); else canvas.remove()
  }
  requestAnimationFrame(cuadro)
}

/** Lanza el confeti una sola vez por clave (p. ej. una postulación adjudicada), recordándolo en el navegador. */
export function confetiUnaVez(clave: string) {
  const k = `lw_confeti_${clave}`
  try { if (localStorage.getItem(k)) return; localStorage.setItem(k, '1') } catch { /* sin almacenamiento: se lanza igual */ }
  lanzarConfeti()
}
