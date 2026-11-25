// The settings page: an old parchment scroll that unrolls from the right over the whole picture, a rod at each
// end, its edges torn in ragged bites that let the world behind show through at its top and bottom. The settings sit on it in one of two
// layouts (A: three groups of three; B: a sound mixer beside a list), as bars made the way the corner keys are,
// each with its icon and name at the left and a switch, value or slider at the right. Everything on the page is drawn on a grid of 2-pixel squares, as chunky as the icons look,
// beneath the page's words; the click pad says which bar a click lands on.

import { KEY_COLORS, type Label, type Scene, TEXT_PX, pixelBox, wide } from './game'
import { ICON, type IconName } from './icons'

// `on` set: a switch showing it. `value` set: a value the bar cycles through (`choices`: all it can be, so the
// bar is laid out for the widest and never shifts). `slider` set (0..1): a slider before the value, which a click
// or a drag along it sets. `mute` set: a speaker key before it, which clicks as that id; `muted`: the key pressed.
// `short`: the name where room is tight (layout B's shared 5H / 7D line).
export type Card = { id: string; icon: IconName; label: string; short?: string; value?: string; choices?: readonly string[]; on?: boolean; slider?: number; mute?: string; muted?: boolean }
// A thing to click, exactly where it is drawn: shares of the picture's width; its top and bottom in the text
// layer's pixels; a slider's track.
export type Span = { id: string; from: number; to: number; y: [number, number]; track?: { from: number; to: number } }
// A: three columns of three bars under group headings. B: a sound mixer beside a list of the rest.
export type Layout = 'A' | 'B'
export const LAYOUTS: readonly Layout[] = ['A', 'B']
const ORDER_A = [['musicVol', 'sfxVol', 'track'], ['row', 'clock', 'week'], ['compact', 'lang', 'fx']] as const
// side, line, and in B: hung under the line above (`sub`), or half of a split line (`zone`)
const PLACE_B: Record<string, { side: 0 | 1; line: number; sub?: true; zone?: 0 | 1 }> = {
  musicVol: { side: 0, line: 0 }, track: { side: 0, line: 1, sub: true }, sfxVol: { side: 0, line: 2 }, compact: { side: 0, line: 3 },
  row: { side: 1, line: 0 }, clock: { side: 1, line: 1, zone: 0 }, week: { side: 1, line: 1, zone: 1 }, lang: { side: 1, line: 2 }, fx: { side: 1, line: 3 },
}
// A muted speaker, 12 × 12: the speaker grey, a red cross where its sound would be.
const MUTED = ['............', '............', '....L.......', '...LL.......', 'LLLLL.R...R.', 'LGLLL..R.R..', 'LLLLL...R...', 'LLLLL..R.R..', '...LL.R...R.', '....L.......', '............', '............']

const CLEAR = 0x010203 // see-through, as the text layer takes it
const U = 2 // a square of the page's grid, in text-layer pixels
const DROP = 8 // the page's words and bars sit this many pixels below their text rows, clear of the torn top
const PAPER = 0xebdcbc, STAIN = 0xdccaa0, WORN = 0xcdb488, BURNT = 0xa07a4c, SHADE = 0xd2bf98, INK = 0x5a3a1e
const ROD = [0x3a2414, 0x8e5e34, 0xd8ac78, 0xb07c4a, 0x5a3820] // five squares, lit from the left
const CAP = { dark: 0x7a5420, body: 0xc89a4a, light: 0xf0d48e }
const textWidth = (s: string) => [...s].reduce((n, ch) => n + (wide(ch) ? 2 : 1), 0)
const PAPERS = new Map<string, Int32Array>() // drawn pages, by size and unrolling
const hash = (n: number) => (((n * 2654435761) >>> 0) % 1000) / 1000 // a steady pseudo-random 0..1

// A torn edge: for each square column, how many squares are bitten off. Bites come in runs of a few columns at
// one depth, now and then a deeper notch, so the edge is ragged rather than a saw's teeth.
function tear(n: number, seed: number, deep: number): number[] {
  const out: number[] = []
  for (let i = 0; out.length < n; i++) {
    const r = hash(seed + i * 7)
    const depth = r < 0.12 ? deep : r < 0.45 ? 1 : r < 0.7 ? 0 : Math.min(2, deep)
    const len = 2 + Math.floor(hash(seed + i * 13 + 3) * 5)
    for (let j = 0; j < len && out.length < n; j++) out.push(depth)
  }
  return out
}

// `p`: 0 rolled away, 1 over the whole picture. The page's words (and the bars' spans) only once it is all over.
export function withScroll(scene: Scene, p: number, title: string, cards: readonly Card[], layout: Layout = 'A', heads: readonly string[] = [], switcher = false): { scene: Scene; cards: Span[] } {
  if (p <= 0) return { scene, cards: [] }
  const { cols } = scene, k = scene.fine ?? 1
  const W = cols * TEXT_PX, H = (scene.px.length / (cols * k * k)) * TEXT_PX // the text layer's size
  const GW = Math.floor(W / U), GH = Math.floor(H / U) // the grid's size, in squares
  const px = new Int32Array(W * H).fill(CLEAR)
  const sq = (x: number, y: number, c: number) => {
    if (x < 0 || x >= GW || y < 0 || y >= GH) return
    for (let a = 0; a < U; a++) for (let b = 0; b < U; b++) px[(y * U + a) * W + x * U + b] = c
  }
  const box = (x: number, y: number, w: number, h: number, c: number) => { for (let Y = y; Y < y + h; Y++) for (let X = x; X < x + w; X++) sq(X, Y, c) }
  const at = (x: number, y: number) => (x >= 0 && x < GW && y >= 0 && y < GH ? px[y * U * W + x * U]! : CLEAR)

  const R = ROD.length
  const right = GW - R - 1 // the right rod's first square, fixed near the picture's edge
  const x0 = Math.min(right - 2, Math.round((GW - R) * (1 - Math.min(p, 1))) + R + 1) // the paper's first square

  // The paper and its rods depend only on the size and how far it is unrolled: drawn once for each, then reused
  // (redrawing every stain and burnt edge each frame made the open page several times dearer than the picture).
  const key = `${W}x${H}:${x0}`
  const kept = PAPERS.get(key)
  if (kept) px.set(kept)
  else {
    // The paper: flat, a few old stains, torn top and bottom, the torn edge burnt dark and worn paler inside it.
    const topBite = tear(GW, 11, 2).map((d, X) => (Math.abs(X - GW / 2) < GW / 5 ? Math.min(d, 1) : d))
    const footBite = tear(GW, 53, 3) // the top's bites stay shallow above the title
    const stains = [[0.22, 0.62, 9], [0.55, 0.3, 7], [0.8, 0.7, 10]] as const
    for (let X = x0; X < right; X++) {
      const top = topBite[X]!, foot = GH - 1 - footBite[X]!
      for (let Y = top; Y <= foot; Y++) {
        const stain = stains.some(([fx, fy, r]) => Math.hypot(X - fx * GW, (Y - fy * GH) * 1.6) < r)
        sq(X, Y, stain ? STAIN : PAPER)
      }
    }
    // Burn the edges: a paper square next to a missing one turns dark; the next ring in, worn.
    const paper = (x: number, y: number) => x >= x0 && x < right && at(x, y) !== CLEAR
    const near = (x: number, y: number, t: (x: number, y: number) => boolean) => t(x - 1, y) || t(x + 1, y) || t(x, y - 1) || t(x, y + 1)
    const burnt: [number, number][] = [], worn: [number, number][] = []
    for (let Y = 0; Y < GH; Y++) for (let X = x0 + 1; X < right - 1; X++) {
      if (paper(X, Y) && near(X, Y, (a, b) => !paper(a, b))) burnt.push([X, Y])
    }
    for (const [X, Y] of burnt) sq(X, Y, BURNT)
    for (let Y = 0; Y < GH; Y++) for (let X = x0; X < right; X++) {
      if (paper(X, Y) && at(X, Y) !== BURNT && near(X, Y, (a, b) => at(a, b) === BURNT)) worn.push([X, Y])
    }
    for (const [X, Y] of worn) sq(X, Y, WORN)
    // The rods: the moving one just left of the paper, the fixed one at the right; a shade on the paper beside each.
    const rod = (rx: number) => {
      ROD.forEach((c, i) => box(rx + i, 1, 1, GH - 2, c))
      for (const Y of [0, GH - 3]) {
        box(rx - 1, Y, R + 2, 3, CAP.dark)
        box(rx, Y, R, 2, CAP.body)
        box(rx, Y, 2, 1, CAP.light)
      }
    }
    for (let Y = 2; Y < GH - 2; Y++) { if (at(x0, Y) === PAPER) sq(x0, Y, SHADE); if (at(right - 1, Y) === PAPER) sq(right - 1, Y, SHADE) }
    rod(x0 - R)
    rod(right)
    PAPERS.set(key, px.slice())
    if (PAPERS.size > 24) PAPERS.delete(PAPERS.keys().next().value!)
  }

  const labels: Label[] = [...scene.labels]
  const spans: Span[] = []
  if (p >= 1) {
    const ROW = 2 * TEXT_PX // a text row, in pixels
    // Words at pixel height `y` (their glyphs' top less one): on the row there, shifted down the rest.
    const putAt = (col: number, y: number, text: string, color: number) => { const row = Math.floor(y / ROW); labels.push({ col, row, text, colors: [...text].map(() => color), top: true, dy: y - row * ROW }) }
    const put = (col: number, row: number, text: string, color: number) => putAt(col, row * ROW + DROP, text, color)
    const fill = (x: number, y: number, w: number, h: number, c: number) => {
      for (let Y = y; Y < y + h; Y++) for (let X = x; X < x + w; X++) if (X >= 0 && X < W && Y >= 0 && Y < H) px[Y * W + X] = c
    }
    const GOLD = 0xe8b84a, VALUE = 0xffd75f, DIM = 0x8a93c8, PALE = 0xc8d0ff, WELL = 0x0c1236, WHITE = 0xffffff
    const tri = (x: number, y: number, dir: -1 | 1) => { // 4 × 6, pointing left or right
      fill(dir < 0 ? x + 2 : x, y, 2, 6, GOLD)
      fill(dir < 0 ? x : x + 2, y + 2, 2, 2, GOLD)
    }
    const knob = (x: number, mid: number, lit: boolean) => {
      const [body, light] = lit ? [VALUE, 0xfff3c4] : [DIM, PALE]
      fill(x + 2, mid - 4, 4, 8, body); fill(x, mid - 2, 8, 4, body); fill(x + 2, mid - 2, 2, 2, light)
    }
    const mutedIcon = (x: number, y: number) => MUTED.forEach((r, yy) => [...r].forEach((ch, xx) => { if (ch !== '.') fill(x + xx, y + yy, 1, 1, ch === 'R' ? 0xff5f5f : ch === 'G' ? PALE : DIM) }))
    // A value or switch or slider on a bar whose words are at `ty`, middle `mid`, contents ending at column `end`
    // (`end - 2` for a value, `end - 1` for a slider's number); a slider's rail starts at pixel `railFrom`.
    const control = (it: Card, ty: number, mid: number, end: number, railFrom: number): Span['track'] => {
      const edge = (end - 2) * TEXT_PX + 7
      if (it.slider !== undefined) { // the number right-aligned in a 4-column slot, so rails line up
        const v = it.value ?? '', vc = end - 1 - Math.max(4, textWidth(v))
        putAt(end - 1 - textWidth(v), ty, v, it.muted ? DIM : VALUE)
        const a = railFrom, b = vc * TEXT_PX - 8
        const s = Math.min(Math.max(it.slider, 0), 1), k = Math.round((a + s * (b - a - 8)) / 2) * 2
        fill(a, mid - 2, b - a, 4, WELL)
        if (s > 0) fill(a, mid - 2, k - a + 4, 4, it.muted ? 0x4a5590 : GOLD)
        knob(k, mid, s > 0 && !it.muted)
        return { from: (a + 4) / W, to: (b - 4) / W }
      }
      if (it.on !== undefined) {
        fill(edge - 16, mid - 2, 16, 4, it.on ? GOLD : WELL)
        knob(it.on ? edge - 8 : edge - 16, mid, it.on)
      } else if (it.value !== undefined) {
        const vc = end - 2 - textWidth(it.value)
        putAt(vc, ty, it.value, it.muted ? DIM : VALUE)
        if (!it.muted) { tri(vc * TEXT_PX - 7, mid - 3, -1); tri(edge - 4, mid - 3, 1) } // greyed out: nothing to cycle
      }
      return undefined
    }
    const byId = new Map(cards.map(c => [c.id, c]))

    // The title in brown ink at the top, a short rule each side.
    const tw = textWidth(title), tc = Math.round(cols / 2 - tw / 2)
    put(tc, 0, title, INK)
    const rule = (fromPx: number) => box(Math.round(fromPx / U), 3 + DROP / U, Math.round((4 * TEXT_PX) / U), 1, BURNT)
    rule((tc - 6) * TEXT_PX); rule((tc + tw + 2) * TEXT_PX)
    // The layout key, left of the gear: a small key with the two layouts' letters, the one in use in gold.
    if (switcher) {
      const c1 = cols - 5, c0 = c1 - 5, L = c0 * TEXT_PX - 2, BW = Math.ceil((5 * TEXT_PX + 4) / 2) * 2
      pixelBox(BW / 2, 10, (X, Y, c) => fill(L + X * 2, 4 + Y * 2, 2, 2, c), 1)
      LAYOUTS.forEach((l, i) => putAt(c0 + 1 + i * 2, 6, l, l === layout ? VALUE : DIM))
      spans.push({ id: 'layout', from: L / W, to: (L + BW) / W, y: [2, 26] })
    }

    const inner = Math.ceil(((R + 3) * U) / TEXT_PX) + 2 // columns clear inside each rod
    if (layout === 'A') {
      // Three columns, one per group, its name in ink with a rule to the column's end and three bars under it.
      // The bar standard, in text pixels: a bar is 30 tall and starts two pixels left of its first column; inside
      // its rim and bevel (4) everything keeps 5 or 6 clear. The icon is the second column's glyph (12 × 12, 6 in
      // and 5 down), the name starts at the fifth column, 8 past the icon; the value ends two columns in from the
      // bar's end, a 4 × 6 arrow 3 past it on each side; a switch ends where the right arrow does.
      const per = 3, gap = 2
      let bw = Math.floor((cols - inner * 2 - gap * (per - 1)) / per)
      if ((cols - per * bw - gap * (per - 1)) % 2) bw -= 1 // an even remainder: equal margins either side
      const margin = (cols - per * bw - gap * (per - 1)) / 2
      const TOPS = [40, 74, 108], HEAD = 24 // the bars' tops; the headings' words
      ORDER_A.forEach((ids, gi) => {
        const col = margin + gi * (bw + gap), name = heads[gi] ?? ''
        // The group's rails all start past its longest name, so they are as long as each other.
        const railCol = Math.max(0, ...ids.map(id => byId.get(id)).filter(c => c?.slider !== undefined).map(c => col + 4 + textWidth(c!.label)))
        putAt(col, HEAD, name, INK)
        const rx = Math.ceil(((col + textWidth(name)) * TEXT_PX + 6) / U), re = Math.floor(((col + bw) * TEXT_PX) / U)
        box(rx, (HEAD + 6) / U, re - rx, 1, BURNT)
        ids.forEach((id, line) => {
          const it = byId.get(id)
          if (!it) return
          const T = TOPS[line]!, L = col * TEXT_PX - 2, BW = Math.ceil((bw * TEXT_PX + 4) / 2) * 2
          const mid = T + 15, ty = T + 8
          pixelBox(BW / 2, 15, (X, Y, c) => fill(L + X * 2, T + Y * 2, 2, 2, c))
          if (it.mute) { // the speaker key: a dark plate in the icon's place, the speaker on it, crossed out when muted
            const x = L + 6, y = T + 6, w = 22, h = 18
            fill(x + 2, y, w - 4, h, WELL); fill(x, y + 2, w, h - 4, WELL)
            if (it.muted) mutedIcon((col + 1) * TEXT_PX + 1, ty + 1)
            else putAt(col + 1, ty, ICON[it.icon], WHITE)
            spans.push({ id: it.mute, from: L / W, to: (x + w + 1) / W, y: [T, T + 30] })
          } else putAt(col + 1, ty, ICON[it.icon], WHITE)
          putAt(col + 4, ty, it.label, it.muted ? DIM : WHITE)
          const track = control(it, ty, mid, col + bw, railCol * TEXT_PX + 8)
          // A value beside a key (the track's name): only the name and its arrows switch it, clear of the key.
          const from = it.mute && it.slider === undefined && it.value !== undefined ? (col + bw - 2 - textWidth(it.value)) * TEXT_PX - 10 : it.mute ? L + 29 : L
          spans.push({ id: it.id, from: from / W, to: (L + BW) / W, y: [T, T + 30], track })
        })
      })
    } else {
      // Two tall panels: a mixer and a list (the rest), two apart. Each is one rimmed box 59 squares
      // tall (y 26..144): rim and bevel 4, then four lines of 26 with a 2-pixel divider between. Line i's words
      // are on text row 2 + 2i, their middle at 43 + 28i.
      const left = inner + 1, gap = 2, mixW = Math.round((cols - left * 2 - gap) * 0.54) // 40 of 88 columns: the mixer a little wider, its rails long
      const PANEL = [{ c0: left, bw: mixW }, { c0: left + mixW + gap, bw: cols - inner - 1 - (left + mixW + gap) }] as const
      const TOP = 26, LINE0 = 30, PITCH = 28, LH = 26
      PANEL.forEach(({ c0, bw }, side) => {
        const L = c0 * TEXT_PX - 2, BW = Math.ceil((bw * TEXT_PX + 4) / 2) * 2
        pixelBox(BW / 2, 59, (X, Y, c) => fill(L + X * 2, TOP + Y * 2, 2, 2, c))
        for (let i = 0; i < 4; i++) { // each line its own light top and darker foot, as a bar has
          const y0 = LINE0 + i * PITCH
          fill(L + 4, y0, BW - 8, 12, KEY_COLORS.top); fill(L + 4, y0 + 12, BW - 8, LH - 12, KEY_COLORS.foot)
          if (i === 3) continue
          const hung = cards.some(c => PLACE_B[c.id]?.side === side && PLACE_B[c.id]?.line === i + 1 && PLACE_B[c.id]?.sub) // a dotted divider over a hung line
          for (let x = L + 4; x < L + BW - 4; x += hung ? 4 : 2) fill(x, y0 + LH, 2, 2, KEY_COLORS.bevel)
        }
      })
      // The split line (5H | 7D): each half as wide as its widest value needs, the room left shared out; the
      // icons only when they fit.
      const list = PANEL[1], widest = (id: string) => { const c = byId.get(id); return Math.max(...(c?.choices ?? [c?.value ?? '']).map(textWidth)) }
      const nameW = (id: string) => textWidth(byId.get(id)?.short ?? byId.get(id)?.label ?? '')
      const need = (id: string, icon: boolean) => (icon ? 4 : 1) + nameW(id) + 2 + widest(id) + 2
      const icons = need('clock', true) + need('week', true) <= list.bw
      const n0 = need('clock', icons), slack = list.bw - n0 - need('week', icons), split = n0 + Math.max(0, Math.floor(slack / 2))
      const splitLine = PLACE_B.clock!.line
      fill((list.c0 + split) * TEXT_PX - 2, LINE0 + splitLine * PITCH + 4, 2, LH - 8, KEY_COLORS.bevel)
      // The mixer's rails all start past its longest name, so they line up.
      const mixer = PANEL[0]
      const railCol = Math.max(...cards.filter(c => PLACE_B[c.id]?.side === 0 && c.slider !== undefined).map(c => mixer.c0 + (c.mute ? 5 : 4) + textWidth(c.label)))
      for (const it of cards) {
        const at = PLACE_B[it.id]
        if (!at) continue
        const { c0, bw } = PANEL[at.side]
        const lc = at.zone === 1 ? c0 + split : c0, le = at.zone === 0 ? c0 + split : c0 + bw
        const ty = LINE0 + at.line * PITCH + 5, mid = 43 + at.line * PITCH, y0 = LINE0 + at.line * PITCH
        const y: [number, number] = [y0 - 1, y0 + LH + 1] // the line, to the middle of the dividers either side
        const x0 = at.zone === 1 ? (lc * TEXT_PX - 1) : c0 * TEXT_PX + 2, x1 = at.zone === 0 ? le * TEXT_PX - 1 : (c0 + bw) * TEXT_PX - 2 // inside the panel's rim
        const halved = at.zone !== undefined
        const iconCol = lc + (at.sub ? 5 : 1), nameCol = halved && !icons ? lc + 1 : lc + (at.sub ? 8 : it.mute ? 5 : 4)
        if (it.mute) { // the mute key: a small rimmed key round the speaker; pressed and dark when muted
          const gx = (lc + 1) * TEXT_PX + 1, kx = gx - 6, ky = mid - 11
          pixelBox(12, 11, (X, Y, c) => fill(kx + X * 2, ky + Y * 2, 2, 2, it.muted && c !== KEY_COLORS.rim ? (c === KEY_COLORS.bevel ? 0x2a3470 : WELL) : c), 1)
          if (it.muted) mutedIcon(gx, mid - 6)
          else putAt(lc + 1, ty, ICON[it.icon], WHITE)
          spans.push({ id: it.mute, from: x0 / W, to: (kx + 24) / W, y })
        } else if (!halved || icons) putAt(iconCol, ty, ICON[it.icon], WHITE)
        if (at.sub) { // the hanger: from under the key above, down and across to this line's icon
          const x = (lc + 1) * TEXT_PX + 1 + 6
          fill(x, y0 - 4, 2, mid - y0 + 5, KEY_COLORS.bevel); fill(x, mid - 1, (iconCol * TEXT_PX + 1) - x - 4, 2, KEY_COLORS.bevel)
        }
        const name = halved ? (it.short ?? it.label) : it.label
        putAt(nameCol, ty, name, at.sub ? PALE : it.muted ? DIM : WHITE)
        const track = control(it, ty, mid, le, railCol * TEXT_PX + 8)
        spans.push({ id: it.id, from: (it.mute ? (lc + 1) * TEXT_PX + 1 + 18 : x0) / W, to: x1 / W, y, track })
      }
    }
  }
  // The page lies beneath its own words; the picture's words and stamps under it are cut off at its left rod.
  return {
    scene: { ...scene, labels, stamps: [...(scene.stamps ?? []), { x: 0, y: 0, w: W, h: H, px, under: true, top: true }], cover: ((x0 - R - 1) * U) / TEXT_PX },
    cards: spans,
  }
}

// The thing under a click at `f` (a share of the width) and `y` (the text layer's pixels), if any.
export const cardAt = (spans: readonly Span[], f: number, y: number) => spans.find(s => f >= s.from && f <= s.to && y >= s.y[0] && y <= s.y[1])?.id
// Where along a slider's track a click at `f` lands, 0..1, if the bar has one (a little past either end counts).
export function sliderAt(spans: readonly Span[], id: string, f: number): number | undefined {
  const t = spans.find(s => s.id === id)?.track
  if (!t || f < t.from - 0.02 || f > t.to + 0.02) return undefined
  return Math.min(Math.max((f - t.from) / (t.to - t.from), 0), 1)
}
