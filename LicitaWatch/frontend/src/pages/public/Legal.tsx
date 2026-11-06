import { Link } from '../../lib/router'
import { PublicPage } from '../../components/layout/PublicLayout'
import { Badge, Card } from '../../components/ui/ui'
import { Icon } from '../../lib/icons'
import { VERSION_POLITICA, VERSION_TERMINOS } from '../../api/types'

const SECCIONES_TERMINOS: { titulo: string; puntos: string[] }[] = [
  {
    titulo: '1. Objeto de la plataforma (Borrador)',
    puntos: [
      'LicitaWatch es un marketplace privado B2B que conecta a empresas Licitadoras que publican requerimientos de bienes o servicios con Pymes proveedoras que postulan a dichas oportunidades en Chile.',
      'LicitaWatch actúa como plataforma tecnológica de intermediación y trazabilidad, sin formar parte de los contratos comerciales finales que celebren el Licitador y la Pyme adjudicada.',
    ],
  },
  {
    titulo: '2. Registro, roles y validación de identidad (Borrador)',
    puntos: [
      'Para operar en LicitaWatch es obligatorio registrarse como Licitador o como Pyme, informando un RUT de empresa válido ante el SII y un RUT personal del representante o contacto.',
      'El usuario declara que los antecedentes ingresados son veraces y se compromete a mantener actualizada su información de contacto y perfil.',
      'La activación de la cuenta requiere la verificación del correo electrónico de acceso.',
    ],
  },
  {
    titulo: '3. Planes, gratuidad y pagos vía Webpay Plus (Borrador)',
    puntos: [
      'El perfil Licitador es gratuito para la publicación y adjudicación de licitaciones.',
      'Las Pymes cuentan con un Plan Estándar gratuito (con cupo mensual limitado de postulaciones) y un Plan Premium de suscripción mensual pagada.',
      'Los pagos del Plan Premium se procesan exclusivamente a través de Transbank Webpay Plus; LicitaWatch no almacena datos completos de tarjetas bancarias.',
    ],
  },
  {
    titulo: '4. Publicación, postulación, adjudicación y chat (Borrador)',
    puntos: [
      'El Licitador define las bases, plazos de cierre, presupuesto referencial y documentos adjuntos de cada licitación.',
      'Al adjudicar una postulación previamente aprobada, se habilita un canal de chat privado entre el Licitador y la Pyme adjudicada para coordinar la ejecución del servicio.',
    ],
  },
  {
    titulo: '5. Uso aceptable y suspensión de cuentas (Borrador)',
    puntos: [
      'Queda prohibido publicar información falsa, suplantar razones sociales o utilizar la plataforma para fines distintos a la contratación B2B lícita.',
      'La administración de LicitaWatch podrá suspender o bloquear cuentas que incumplan estas condiciones.',
    ],
  },
]

const SECCIONES_POLITICA: { titulo: string; puntos: string[] }[] = [
  {
    titulo: '1. Responsable y marco normativo (Borrador)',
    puntos: [
      'El tratamiento de datos personales y empresariales en LicitaWatch se realiza conforme a la legislación chilena vigente sobre protección de la vida privada y datos personales (Ley N° 19.628 y sus modificaciones).',
    ],
  },
  {
    titulo: '2. Datos recopilados en el registro y operación (Borrador)',
    puntos: [
      'Datos de la persona de contacto: nombres, apellidos, RUT personal, correo electrónico y teléfono móvil.',
      'Datos de la empresa: razón social, RUT empresarial (validado con el SII), rubro, región, ciudad, tamaño de empresa, sitio web y descripción.',
      'Datos operacionales y de auditoría: fecha y hora de aceptación de documentos legales, versión aceptada, último inicio de sesión, licitaciones, postulaciones y mensajes del chat.',
    ],
  },
  {
    titulo: '3. Finalidad del tratamiento de datos (Borrador)',
    puntos: [
      'Verificar la identidad tributaria y comercial de las empresas participantes en el marketplace B2B.',
      'Permitir la publicación de licitaciones, el envío de postulaciones, las notificaciones de avisos por rubro y la comunicación entre Licitador y Pyme adjudicada.',
      'Gestionar la suscripción del Plan Premium y emitir comprobantes asociados a las transacciones de Webpay Plus.',
    ],
  },
  {
    titulo: '4. Confidencialidad y seguridad (Borrador)',
    puntos: [
      'Las contraseñas se almacenan cifradas mediante algoritmo BCrypt y las sesiones se autentican mediante tokens firmados (JWT).',
      'Los datos bancarios de pago son procesados directamente por Transbank en su entorno seguro.',
    ],
  },
  {
    titulo: '5. Derechos del titular de los datos (Borrador)',
    puntos: [
      'El usuario puede acceder y actualizar los datos de contacto de su perfil desde la plataforma, así como solicitar la rectificación o eliminación de su cuenta a través de los canales de soporte de LicitaWatch.',
    ],
  },
]

function PaginaLegal({
  tipo,
  titulo,
  subtitulo,
  version,
  secciones,
}: {
  tipo: 'terminos' | 'politica'
  titulo: string
  subtitulo: string
  version: string
  secciones: { titulo: string; puntos: string[] }[]
}) {
  return (
    <PublicPage>
      <section className="sec legal-sec">
        <div className="wrap narrow-page">
          <div className="legal-head">
            <div className="legal-badges">
              <Badge tono="blue" icon="shieldcheck">Documento legal · Versión {version}</Badge>
              <Badge tono="amber" icon="alert">Borrador sujeto a revisión previa</Badge>
            </div>
            <h1>{titulo}</h1>
            <p className="muted-p">{subtitulo}</p>
            <div className="legal-tabs">
              <Link to="/terminos-y-condiciones" className={`tab ${tipo === 'terminos' ? 'on' : ''}`}>
                <Icon name="file" size={16} />
                <span>Términos y Condiciones</span>
              </Link>
              <Link to="/politica-de-privacidad" className={`tab ${tipo === 'politica' ? 'on' : ''}`}>
                <Icon name="shield" size={16} />
                <span>Política de Privacidad</span>
              </Link>
            </div>
          </div>

          <div className="alert alert-warn legal-aviso">
            <Icon name="alert" size={18} />
            <div className="alert-body">
              <b>Texto preliminar pendiente de validación legal definitiva</b>
              <span>
                Este contenido corresponde a una propuesta estructural para revisión del equipo de LicitaWatch (v{version}). No constituye una publicación legal definitiva sin aprobación previa.
              </span>
            </div>
          </div>

          <Card>
            <div className="legal-body">
              {secciones.map((s) => (
                <section key={s.titulo} className="legal-block">
                  <h3>{s.titulo}</h3>
                  <ul>
                    {s.puntos.map((p) => (
                      <li key={p}>
                        <Icon name="check" size={16} />
                        <span>{p}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          </Card>
        </div>
      </section>
    </PublicPage>
  )
}

export function TerminosCondiciones() {
  return (
    <PaginaLegal
      tipo="terminos"
      titulo="Términos y Condiciones de Uso"
      subtitulo="Condiciones generales que regulan el registro y uso del marketplace privado de licitaciones B2B LicitaWatch."
      version={VERSION_TERMINOS}
      secciones={SECCIONES_TERMINOS}
    />
  )
}

export function PoliticaPrivacidad() {
  return (
    <PaginaLegal
      tipo="politica"
      titulo="Política de Privacidad"
      subtitulo="Lineamientos sobre la recopilación, uso, resguardo y derechos asociados a los datos personales y empresariales en LicitaWatch."
      version={VERSION_POLITICA}
      secciones={SECCIONES_POLITICA}
    />
  )
}

