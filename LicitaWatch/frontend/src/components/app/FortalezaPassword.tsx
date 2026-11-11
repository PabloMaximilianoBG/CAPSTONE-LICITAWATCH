import { Icon } from '../../lib/icons'

/* Indicador de fortaleza de la contraseña con las mismas reglas del registro (validarPassword): 8+ caracteres, mayúscula, minúscula y número. */

const REGLAS: { texto: string; ok: (p: string) => boolean }[] = [
  { texto: 'Mínimo 8 caracteres', ok: (p) => p.length >= 8 },
  { texto: 'Una mayúscula', ok: (p) => /[A-Z]/.test(p) },
  { texto: 'Una minúscula', ok: (p) => /[a-z]/.test(p) },
  { texto: 'Un número', ok: (p) => /\d/.test(p) },
]
const NIVELES = [
  { texto: 'Muy débil', clase: 'n0' }, { texto: 'Débil', clase: 'n1' }, { texto: 'Aceptable', clase: 'n2' }, { texto: 'Fuerte', clase: 'n3' }, { texto: 'Muy fuerte', clase: 'n4' },
]

/** Nivel 0–4: las 4 reglas obligatorias dan «Fuerte»; 12+ caracteres o un símbolo la suben a «Muy fuerte». */
export function nivelPassword(p: string): number {
  const cumple = REGLAS.filter((r) => r.ok(p)).length
  if (cumple < 4) return Math.min(cumple, 2)
  return p.length >= 12 || /[^A-Za-z0-9]/.test(p) ? 4 : 3
}

export function FortalezaPassword({ password }: { password: string }) {
  if (!password) return null
  const n = nivelPassword(password)
  return (
    <div className="fuerza" aria-live="polite">
      <div className={`fuerza-barra ${NIVELES[n].clase}`}>{[1, 2, 3, 4].map((i) => <span key={i} className={i <= n ? 'on' : ''} />)}</div>
      <small className="fuerza-txt">Seguridad: <b>{NIVELES[n].texto}</b></small>
      <ul className="fuerza-reglas">
        {REGLAS.map((r) => <li key={r.texto} className={r.ok(password) ? 'ok' : ''}><Icon name={r.ok(password) ? 'check' : 'x'} size={12} />{r.texto}</li>)}
      </ul>
    </div>
  )
}
