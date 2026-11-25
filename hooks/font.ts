// The text's pixel font: Fusion Pixel Font 12px monospaced, Traditional Chinese (TakWolf, SIL OFL 1.1,
// see ../fonts/OFL.txt). fontdata.ts holds its glyphs as bits, made by ../fonts/build_font.py.

import { BITS_FULL, BITS_HALF, CODES_FULL, CODES_HALF } from './fontdata'
import { iconGlyph } from './icons'

export const GLYPH_H = 12
// A glyph: its width in font pixels (6 or 12) and one bitmask per row, the leftmost pixel the highest bit.
// An icon also carries `paint`, each pixel's own color, drawn in place of the text's color.
export type Glyph = { w: number; rows: number[]; paint?: number[][] }

let table: Map<number, Glyph> | undefined

// A 12-hour clock's AM and PM, as an alarm clock marks them: tiny AM over PM before the digits, the one in
// force lit, the other dim. Wide (a private-use code point), so the pair has a whole cell to itself.
export const AM = '\uE0F0', PM = '\uE0F1'
const TINY: Record<string, string[]> = {
  A: ['.#.', '#.#', '###', '#.#', '#.#'],
  P: ['##.', '#.#', '##.', '#..', '#..'],
  M: ['#...#', '##.##', '#.#.#', '#...#', '#...#'],
}
const DIM = 0x6a5a48
function ampm(lit: 'AM' | 'PM'): Glyph {
  const w = 9, rows = Array.from({ length: GLYPH_H }, () => 0), paint: number[][] = Array.from({ length: GLYPH_H }, () => [])
  for (const [word, top] of [['AM', 0], ['PM', 7]] as const) {
    let x = 0
    for (const ch of word) {
      const art = TINY[ch]!
      art.forEach((line, r) => [...line].forEach((px, c) => {
        if (px !== '#') return
        rows[top + r]! |= 1 << (w - 1 - (x + c))
        if (word !== lit) paint[top + r]![x + c] = DIM // the other one stays dim; the lit one takes the text's colour
      }))
      x += art[0]!.length + 1
    }
  }
  return { w, rows, paint }
}
const MARKS = new Map([[AM.codePointAt(0)!, ampm('AM')], [PM.codePointAt(0)!, ampm('PM')]])

function load(codes: string, bits: string, w: number, into: Map<number, Glyph>) {
  const bytes = Uint8Array.from(atob(bits), c => c.charCodeAt(0))
  const per = w > 8 ? 2 : 1
  let code = 0
  codes.split(',').forEach((delta, i) => {
    code += parseInt(delta, 36)
    const rows: number[] = []
    for (let r = 0; r < GLYPH_H; r++) {
      const at = (i * GLYPH_H + r) * per
      rows.push(per === 2 ? (bytes[at]! << 8) | bytes[at + 1]! : bytes[at]!)
    }
    into.set(code, { w, rows })
  })
}

// Undefined for a character the font lacks (emoji, rare CJK): the caller draws it as text instead.
// An icon answers with its frame at `t`, in milliseconds.
export function glyph(ch: string, t = 0): Glyph | undefined {
  const code = ch.codePointAt(0) ?? 0
  const icon = iconGlyph(code, t) ?? MARKS.get(code)
  if (icon) return icon
  if (!table) {
    table = new Map()
    load(CODES_HALF, BITS_HALF, 6, table)
    load(CODES_FULL, BITS_FULL, 12, table)
  }
  return table.get(code)
}
