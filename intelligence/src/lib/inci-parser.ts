import { normalizeName } from './normalize'

export const PARSER_VERSION = 'inci-parser-1.1.0'

export interface ParsedIngredientItem {
  position: number
  displayedName: string
  normalizedName: string
  flags: string[] // MAY_CONTAIN | TRAILING_NOTE_REMOVED | MARKER_STRIPPED | SUSPECT_FRAGMENT | TRADE_NAME_IN_PARENS
}

export interface ParsedIngredientList {
  items: ParsedIngredientItem[]
  removedNotes: string[]
  parserVersion: string
}

/** Splits on commas/semicolons that are not inside parentheses or brackets. */
export function splitTopLevel(s: string): string[] {
  const out: string[] = []
  let depth = 0
  let buf = ''
  for (const ch of s) {
    if (ch === '(' || ch === '[') depth++
    if ((ch === ')' || ch === ']') && depth > 0) depth--
    if ((ch === ',' || ch === ';') && depth === 0) {
      out.push(buf)
      buf = ''
    } else buf += ch
  }
  out.push(buf)
  return out.map((x) => x.trim()).filter(Boolean)
}

const NOTE_PATTERNS = [
  /\*+\s*certified organic[^,]*$/i,
  /\*+\s*fair\s*trade[^,]*$/i,
  /\*+\s*organic[^,]*$/i,
  /"?\s*fair trade ingredient\s*$/i,
]

/**
 * Parses a displayed ingredient list into ordered items. Order is preserved exactly; nothing is reordered,
 * de-duplicated or "corrected". Order never implies concentration.
 */
export function parseIngredientList(raw: string): ParsedIngredientList {
  const removedNotes: string[] = []
  let text = raw.replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim()
  text = text.replace(/^(ingredients|ingrédients|inci)\s*:\s*/i, '')
  for (const re of NOTE_PATTERNS) {
    const m = re.exec(text)
    if (m) {
      removedNotes.push(m[0].trim())
      text = text.slice(0, m.index).trim()
    }
  }
  let mayContain: string | null = null
  const mc = /\b(may contain|\+\/-)\s*[:(]?/i.exec(text)
  if (mc) {
    mayContain = text.slice(mc.index + mc[0].length).replace(/[)\]]\s*$/, '')
    text = text.slice(0, mc.index)
  }
  const parts = splitTopLevel(text.replace(/\.\s*$/, ''))
  const items: ParsedIngredientItem[] = []
  const push = (part: string, extra: string[] = []) => {
    const flags = [...extra]
    let display = part.replace(/^and\s+/i, '').trim()
    if (/[*"‰ª´†]/.test(display)) {
      flags.push('MARKER_STRIPPED')
      display = display.replace(/[*"‰ª´†]+/g, '').trim()
    }
    display = display.replace(/[.,;]+$/, '').trim()
    if (!display) return
    if (/\((optiphen|[a-z]+®|[a-z]+™)[^)]*\)/i.test(display)) flags.push('TRADE_NAME_IN_PARENS')
    // A lone capitalized word is often a list typo ("Ocimum, Basilicum (Basil) Oil"); flag it instead of guessing.
    if (/^[A-Z][a-z]+$/.test(display) && display.length > 3 && /um$|us$|is$|a$/.test(display)) flags.push('SUSPECT_FRAGMENT')
    items.push({ position: items.length + 1, displayedName: display, normalizedName: normalizeName(display), flags })
  }
  for (const p of parts) push(p)
  if (mayContain) for (const p of splitTopLevel(mayContain)) push(p, ['MAY_CONTAIN'])
  return { items, removedNotes, parserVersion: PARSER_VERSION }
}
