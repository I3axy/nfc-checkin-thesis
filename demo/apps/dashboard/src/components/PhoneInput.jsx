import { useMemo } from 'react'
import { C, S } from '../lib/theme'

// A telefonszám E.164 alakban tárolódik (pl. +36301234567). A felületen két
// részre bontva jelenik meg: országhívó + belföldi szám. Az intézmény Szabadkán
// van, ezért Szerbia és Magyarország áll elöl.
// A `trunk` a belföldi hívószám-előtag, amit a nemzetközi alak NEM tartalmaz.
// Magyarországon ez "06" (06 30 123 4567), a legtöbb országban egyetlen "0".
export const DIAL_CODES = [
  { code: '+381', label: 'RS +381', trunk: '0' },
  { code: '+36',  label: 'HU +36',  trunk: '06' },
  { code: '+385', label: 'HR +385', trunk: '0' },
  { code: '+387', label: 'BA +387', trunk: '0' },
  { code: '+40',  label: 'RO +40',  trunk: '0' },
  { code: '+43',  label: 'AT +43',  trunk: '0' },
  { code: '+49',  label: 'DE +49',  trunk: '0' },
  { code: '+386', label: 'SI +386', trunk: '0' },
  { code: '+421', label: 'SK +421', trunk: '0' },
  { code: '+380', label: 'UA +380', trunk: '0' },
]

export const DEFAULT_DIAL = '+381'

// E.164 -> { dial, rest }. A leghosszabb illeszkedő hívószámot választjuk,
// különben a +38 kezdetű országok összekeverednének.
export function splitPhone(value) {
  const v = (value ?? '').replace(/[^\d+]/g, '')
  if (!v.startsWith('+')) return { dial: DEFAULT_DIAL, rest: v }
  const hit = [...DIAL_CODES].sort((a, b) => b.code.length - a.code.length).find(c => v.startsWith(c.code))
  return hit ? { dial: hit.code, rest: v.slice(hit.code.length) } : { dial: DEFAULT_DIAL, rest: v.replace(/^\+/, '') }
}

// A belföldi hívószám-előtagot le kell vágni, mert az E.164 alak nem
// tartalmazza. Magyar számnál ez "06" — puszta nulla-levágással a
// 06 30 123 4567 hibásan 6301234567 lenne.
export function joinPhone(dial, rest) {
  let digits = (rest ?? '').replace(/\D/g, '')
  const trunk = DIAL_CODES.find(c => c.code === dial)?.trunk ?? '0'
  if (trunk && digits.startsWith(trunk)) digits = digits.slice(trunk.length)
  else digits = digits.replace(/^0+/, '')
  return digits ? `${dial}${digits}` : null
}

export function PhoneInput({ value, onChange, placeholder = '30 123 4567' }) {
  const { dial, rest } = useMemo(() => splitPhone(value), [value])
  return (
    <div style={{ display: 'flex', gap: '0.4rem' }}>
      <select
        value={dial}
        onChange={e => onChange(joinPhone(e.target.value, rest))}
        style={{ ...S.input, width: 'auto', flexShrink: 0, fontFamily: "'JetBrains Mono', monospace" }}
      >
        {DIAL_CODES.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
      </select>
      <input
        value={rest}
        onChange={e => onChange(joinPhone(dial, e.target.value))}
        inputMode="tel"
        placeholder={placeholder}
        style={{ ...S.input, flex: 1, fontFamily: "'JetBrains Mono', monospace" }}
      />
    </div>
  )
}

// Megjelenítéshez: +36301234567 -> +36 30 123 4567
export function fmtPhone(value) {
  if (!value) return '—'
  const { dial, rest } = splitPhone(value)
  const groups = rest.replace(/(\d{2})(\d{3})(\d+)/, '$1 $2 $3')
  return `${dial} ${groups}`.trim()
}
