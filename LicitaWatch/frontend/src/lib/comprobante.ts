/*
 * Comprobante de pago para «Guardar como PDF» (diálogo de impresión del navegador), sin librerías.
 * Se agrega un bloque al <body>, al imprimir se oculta todo lo demás (ver «.comprobante-impresion» en components.css) y luego se quita.
 * Colores fijos claros: se ve igual en modo oscuro y en papel.
 */
export interface DatosComprobante {
  transaccion: string
  fecha: string
  plan: string
  metodo?: string | null
  monto: number
  autorizacion?: string
  ultimos4?: string
  cliente: { razonSocial: string; rut: string; email: string }
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
const clp = (n: number) => '$' + Math.round(n).toLocaleString('es-CL')

export function imprimirComprobante(d: DatosComprobante) {
  const fecha = new Date(d.fecha).toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' })
  const filas: [string, string][] = [
    ['N° de transacción', d.transaccion],
    ['Fecha', fecha],
    ['Plan', `${d.plan} · 30 días`],
    ['Método de pago', d.metodo ? `Tarjeta de ${d.metodo.toLowerCase()}${d.ultimos4 ? ` terminada en ${d.ultimos4}` : ''}` : 'Webpay Plus'],
    ...(d.autorizacion ? [['Código de autorización', d.autorizacion] as [string, string]] : []),
  ]
  const html = `
    <div class="cp">
      <header class="cp-cab">
        <div class="cp-marca">
          <svg width="40" height="40" viewBox="0 0 48 48" aria-hidden="true"><rect width="48" height="48" rx="14" fill="#3B5BFF"/>
            <path d="M13 24c3.2-5.2 7-7.8 11-7.8S31.8 18.8 35 24c-3.2 5.2-7 7.8-11 7.8S16.2 29.2 13 24Z" fill="none" stroke="#fff" stroke-width="2.6" stroke-linejoin="round"/>
            <circle cx="24" cy="24" r="4.2" fill="#fff"/></svg>
          <span>Licita<b>Watch</b></span>
        </div>
        <div class="cp-tit"><h1>Comprobante de pago</h1><span class="cp-sello">APROBADO</span></div>
      </header>
      <section class="cp-bloque">
        <h2>Cliente</h2>
        <div class="cp-fila"><span>Razón social</span><b>${esc(d.cliente.razonSocial)}</b></div>
        <div class="cp-fila"><span>RUT</span><b>${esc(d.cliente.rut)}</b></div>
        <div class="cp-fila"><span>Correo</span><b>${esc(d.cliente.email)}</b></div>
      </section>
      <section class="cp-bloque">
        <h2>Detalle de la compra</h2>
        ${filas.map(([k, v]) => `<div class="cp-fila"><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join('')}
      </section>
      <div class="cp-total"><span>Total pagado</span><b>${clp(d.monto)}</b></div>
      <footer class="cp-pie">
        Pago procesado por Webpay Plus · Transbank. LicitaWatch no almacena los datos de tu tarjeta.<br>
        Emitido el ${esc(new Date().toLocaleString('es-CL'))} · licitawatch.cl
      </footer>
    </div>`
  const cont = document.createElement('div')
  cont.className = 'comprobante-impresion'
  cont.innerHTML = html
  document.body.appendChild(cont)
  document.documentElement.classList.add('imprimiendo')
  const tituloAnterior = document.title
  document.title = `Comprobante-LicitaWatch-${d.transaccion}`   // nombre sugerido del PDF
  const limpiar = () => {
    cont.remove(); document.documentElement.classList.remove('imprimiendo'); document.title = tituloAnterior
    window.removeEventListener('afterprint', limpiar)
  }
  window.addEventListener('afterprint', limpiar)
  setTimeout(() => window.print(), 50)
}
