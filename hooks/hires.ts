// Desktop's finer modes: the same scene drawn from lit shapes instead of hand-placed pixels, at k
// fine pixels per scene pixel. Coordinates are scene pixels (the 1x grid); every shape is sampled
// at the centre of each fine pixel, so a larger k shows more of its outline, shading and shine.

import { CAT_MORE, CAT_MORE_PAL, CLAWD_MORE, FISH, HEART, SWISH_LOOP } from './duo'
import { type CatState, type Poke, POKE_TICKS } from './game'
import { ACTION_FRAMES, ACTION_PAL, IDLE_FRAMES, IDLE_PAL, MOB_COMMON, MOB_FRAMES, MOB_STYLES } from './sprites'

export type HiMob = {
  id: number; x: number; w: number; kind: string; state: string
  fade: number; hp: number; maxHp: number; hurt: number; lift: number
}
// hour: local time of day, 0 to 24 with minutes as a fraction; drives the sky.
export type HiState = {
  cols: number; rows: number; k: number; tick: number; swing: number; sleeping: boolean; hour: number
  action?: { name: string; frame: number } // an event action (game.ts) drawn in place of the usual pose
  ward?: number // a refused call: the hexagon ward before Clawd, 0 to 1 over its life
  outfit?: Outfit // the hat by model, the wand by effort
  cat?: CatState // the black cat by Clawd (game.ts says what it is doing)
  poke?: Poke // a click on Clawd or the cat: its little reaction
  mobs: readonly HiMob[]; heroX: number; feet: number; hudFrom: number; sky: readonly number[]
}

// outline, shadow, body, lit side, and an optional shine spot
type Ramp = { line: number; dark: number; base: number; light: number; shine?: number }

const ORANGE: Ramp = { line: 0x4a2418, dark: 0xb5603f, base: 0xd97757, light: 0xf0a07c }
const LEG: Ramp = { line: 0x4a2418, dark: 0x9a4a2c, base: 0xc4643f, light: 0xd97757 }
const STEEL: Ramp = { line: 0x2a2d3a, dark: 0x7d8598, base: 0xb4bccd, light: 0xe2e7f2, shine: 0xffffff }
const BRIM: Ramp = { line: 0x2a2d3a, dark: 0x5d6476, base: 0x8a92a6, light: 0xa9b1c4 }
const PLUME: Ramp = { line: 0x5a1414, dark: 0xa82a24, base: 0xe0413a, light: 0xff7a6e }
const BLADE: Ramp = { line: 0x3a4a5e, dark: 0xaab8cc, base: 0xdfe8f5, light: 0xffffff }
const GOLD: Ramp = { line: 0x5a3a08, dark: 0xb07a12, base: 0xffc83d, light: 0xffe89a }
const GRIP: Ramp = { line: 0x2a1608, dark: 0x5a3414, base: 0x7a4a22, light: 0x9a6434 }
const INK: Ramp = { line: 0x1c1420, dark: 0x1c1420, base: 0x1c1420, light: 0x1c1420 }
const SLIME: Ramp = { line: 0x1e4a14, dark: 0x3a8a2a, base: 0x6cc04a, light: 0xa8e77f, shine: 0xffffff }
const BAT: Ramp = { line: 0x2a1e3a, dark: 0x5d4a7e, base: 0x7d6a9e, light: 0xa08cc4 }
const WING: Ramp = { line: 0x2a1e3a, dark: 0x8a68b8, base: 0xb48ee0, light: 0xcfb0f4 }
const CAP: Ramp = { line: 0x4a1010, dark: 0xa82a24, base: 0xe0413a, light: 0xff6a5e, shine: 0xffffff }
const STEM: Ramp = { line: 0x5a4630, dark: 0xd8c49e, base: 0xf3e3c3, light: 0xfff6e4 }
const GHOST: Ramp = { line: 0x5a628a, dark: 0xa9b2e0, base: 0xe8ecff, light: 0xffffff }
const BOSS: Ramp = { line: 0x2a1240, dark: 0x6e3a9a, base: 0x9c4dcc, light: 0xc488f0, shine: 0xf0d8ff }
const HORN: Ramp = { line: 0x4a3a20, dark: 0xc8b48a, base: 0xf3e6c4, light: 0xfffaf0 }
const EYEWHITE: Ramp = { line: 0x2a1240, dark: 0xdcd6ec, base: 0xffffff, light: 0xffffff }

const mix = (a: number, b: number, t: number) => {
  const ch = (s: number) => Math.round(((a >> s) & 255) * (1 - t) + ((b >> s) & 255) * t)
  return (ch(16) << 16) | (ch(8) << 8) | ch(0)
}
const hash = (n: number) => ((Math.imul(n ^ 0x9e3779b9, 0x85ebca6b) >>> 0) % 1000) / 1000

export function drawHires(s: HiState): Int32Array {
  const { cols, rows, k, tick } = s
  const W = cols * k, H = rows * k
  const px = new Int32Array(W * H)
  let tint: number | undefined // set while drawing a monster flashing white
  const set = (X: number, Y: number, c: number) => {
    if (X >= 0 && X < W && Y >= 0 && Y < H) px[Y * W + X] = tint ?? c
  }
  // f gets each fine pixel's centre inside the box (scene units) and returns a color, or -1 for none.
  const fill = (x0: number, y0: number, x1: number, y1: number, f: (u: number, v: number) => number) => {
    for (let Y = Math.max(0, Math.floor(y0 * k)); Y < Math.min(H, Math.ceil(y1 * k)); Y++) {
      for (let X = Math.max(0, Math.floor(x0 * k)); X < Math.min(W, Math.ceil(x1 * k)); X++) {
        const c = f((X + 0.5) / k, (Y + 0.5) / k)
        if (c >= 0) set(X, Y, c)
      }
    }
  }
  const EDGE = 1.05 / k // the outline: one fine pixel
  const shade = (r: Ramp, lit: number) => (lit > 0.4 ? r.light : lit < -0.4 ? r.dark : r.base)

  // A lit ellipse, light from the upper left; clip keeps part of it.
  const ellipse = (cx: number, cy: number, rx: number, ry: number, r: Ramp, clip?: (u: number, v: number) => boolean) =>
    fill(cx - rx, cy - ry, cx + rx, cy + ry, (u, v) => {
      if (clip && !clip(u, v)) return -1
      const nx = (u - cx) / rx, ny = (v - cy) / ry
      const d = Math.hypot(nx, ny)
      if (d > 1) return -1
      if (d > 1 - EDGE / Math.min(rx, ry)) return r.line
      if (r.shine !== undefined && (nx + 0.4) ** 2 + (ny + 0.48) ** 2 < 0.025) return r.shine
      return shade(r, -(nx * 0.55 + ny * 0.85) + (1 - d) * 0.25)
    })
  // A lit box with rounded corners.
  const box = (x0: number, y0: number, x1: number, y1: number, rad: number, r: Ramp) => {
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, hx = (x1 - x0) / 2, hy = (y1 - y0) / 2
    fill(x0, y0, x1, y1, (u, v) => {
      const qx = Math.abs(u - cx) - (hx - rad), qy = Math.abs(v - cy) - (hy - rad)
      const dist = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - rad
      if (dist > 0) return -1
      if (dist > -EDGE) return r.line
      return shade(r, -(((u - cx) / hx) * 0.35 + ((v - cy) / hy) * 0.9))
    })
  }
  const dot = (cx: number, cy: number, rad: number, c: number) =>
    fill(cx - rad, cy - rad, cx + rad, cy + rad, (u, v) => (Math.hypot(u - cx, v - cy) <= Math.max(rad, 0.5 / k) ? c : -1))
  // A filled triangle, shaded top to bottom.
  const tri = (ax: number, ay: number, bx: number, by: number, cx: number, cy: number, r: Ramp) => {
    const side = (px1: number, py1: number, px2: number, py2: number, u: number, v: number) => (px2 - px1) * (v - py1) - (py2 - py1) * (u - px1)
    const y0 = Math.min(ay, by, cy), y1 = Math.max(ay, by, cy)
    fill(Math.min(ax, bx, cx), y0, Math.max(ax, bx, cx), y1, (u, v) => {
      const d1 = side(ax, ay, bx, by, u, v), d2 = side(bx, by, cx, cy, u, v), d3 = side(cx, cy, ax, ay, u, v)
      const inside = (d1 >= 0 && d2 >= 0 && d3 >= 0) || (d1 <= 0 && d2 <= 0 && d3 <= 0)
      return inside ? shade(r, 0.6 - ((v - y0) / (y1 - y0 || 1)) * 1.4) : -1
    })
  }

  // The magic world, lit by the real time of day: a sky gradient, stars and the moon by night or a
  // soft sun by day, a far castle on a hill, glowing crystals, a blue-green meadow, drifting motes.
  const G = s.feet + 1 // the ground line
  const w = worldFor(s.hour)
  const skyAt = (v: number) => {
    const t = Math.min(Math.max(v / G, 0), 0.999) * 2, i = Math.floor(t)
    return mix(w.sky[i]!, w.sky[i + 1]!, t - i)
  }
  for (let Y = 0; Y < H; Y++) {
    const c = skyAt((Y + 0.5) / k)
    for (let X = 0; X < W; X++) px[Y * W + X] = c
  }
  // Stars hold steady; a few at a time fade down and back over a few seconds, each on its own
  // slow cycle, rather than all of them blinking every frame.
  for (let i = 0; i < 26; i++) {
    if (((i * 13) % 100) / 100 > w.stars) continue
    const x = (i * 53) % cols, y = 2 + ((i * 29) % (G - 8))
    if (y < 4) continue // clear of the keys' row along the top
    const phase = ((tick + i * 37) % 60) / 60          // a 6-second cycle at 10 frames a second
    const dim = i % 4 === 0 && phase > 0.7 ? Math.sin(((phase - 0.7) / 0.3) * Math.PI) : 0
    const c = i % 3 ? 0xfff0c8 : 0xc8dcff
    set(x * k + (i % k), y * k, mix(c, skyAt(y), dim * 0.85))
  }
  const body = w.moon ?? w.sun
  if (body !== undefined) {
    const bx = Math.round(cols * 0.55), by = 7.0 // its glow clear of the keys' row
    fill(bx - 3.6, by - 3.6, bx + 3.6, by + 3.6, (u, v) => {
      const d = Math.hypot(u - bx, v - by)
      return d < 2.3 ? (d < 2.0 ? body : mix(body, 0xf0c8a0, 0.3)) : d < 3.4 ? mix(skyAt(v), body, 0.28) : -1
    })
  }
  const hill = (u: number) => G - 4.5 - 2 * Math.sin(u / 9) - Math.sin(u / 4)
  const castleX = Math.round(cols * 0.32)
  const castle = mix(w.hill, 0x000000, 0.28)
  const roof = mix(castle, 0x6e3a9a, 0.35)
  for (let X = 0; X < W; X++) {
    const u = (X + 0.5) / k
    for (let Y = Math.floor(hill(u) * k); Y < G * k; Y++) set(X, Y, w.hill)
  }
  // A castle on the hill: a keep with battlements, a gate, two towers with pointed roofs, and a
  // central spire with a pennant. Its tip stays below the HUD text row: scene rows 0-1, y < 4.
  const solid = { line: castle, dark: castle, base: castle, light: castle }
  const R = { line: roof, dark: roof, base: roof, light: roof }
  const cb = G - 1.5 // the castle's base, behind the near hills
  const flagTop = 4.5 // the pennant's tip
  const H0 = cb - flagTop // the castle's full height
  const at = (f: number) => cb - H0 * f // a height as a fraction of the whole
  box(castleX, at(0.42), castleX + 6, cb, 0, solid)                                 // keep
  for (let i = 0; i < 4; i++) box(castleX + 0.1 + i * 1.6, at(0.47), castleX + 0.9 + i * 1.6, at(0.42), 0, solid)
  for (const tx of [-1.6, 6.2]) {
    box(castleX + tx, at(0.6), castleX + tx + 1.4, cb, 0, solid)                    // side towers
    tri(castleX + tx + 0.7, at(0.8), castleX + tx - 0.4, at(0.6), castleX + tx + 1.8, at(0.6), R)
  }
  box(castleX + 2.3, at(0.72), castleX + 3.7, at(0.42), 0, solid)                   // central spire
  tri(castleX + 3.0, at(0.92), castleX + 1.9, at(0.72), castleX + 4.1, at(0.72), R)
  box(castleX + 2.92, flagTop, castleX + 3.12, at(0.92), 0, solid)                      // flagpole
  // Clicked: the pennant flaps, every window lights up in turn, and fireworks burst either side of the spire.
  const cheer = s.poke?.who === 'castle' ? s.poke : undefined
  const wave = cheer ? Math.floor(tick / 2) % 4 : -1 // four steps of a pennant in the wind: longer, its tip up and down
  const tipX = wave < 0 ? 4.6 : [5.4, 5.0, 5.6, 4.9][wave]!, tipY = wave < 0 ? 0.4 : [0.4, 1.2, 0.5, -0.3][wave]!
  tri(castleX + 3.12, flagTop, castleX + 3.12, flagTop + (wave < 0 ? 0.8 : 1.1), castleX + tipX, flagTop + tipY, { line: 0xff6a8a, dark: 0xff6a8a, base: 0xff6a8a, light: 0xff6a8a })
  box(castleX + 2.4, cb - 2.2, castleX + 3.6, cb, 0.55, { ...solid, base: mix(castle, 0, 0.4), line: mix(castle, 0, 0.4) }) // gate
  const winAt: [number, number][] = [[0.9, at(0.3)], [4.6, at(0.3)], [-1.1, at(0.5)], [6.7, at(0.5)], [2.75, at(0.6)]]
  // Lit at night; by day the same windows are dark openings in the stone.
  const pane = w.windows ? 0xffd26e : mix(castle, 0x000000, 0.45)
  winAt.forEach(([wx, wy], i) => {
    const c = cheer && cheer.t * winAt.length * 1.5 > i ? 0xffe28a : pane // lit one after another
    box(castleX + wx, wy, castleX + wx + 0.45, wy + 0.8, 0.05, { line: c, dark: c, base: c, light: c })
  })
  if (cheer) { // two small bursts, the second a beat later, in the click's colour
    const colors = [[0xffd75f, 0xfff3c4], [0xff8ab4, 0xffd0e0], [0x8adcff, 0xe0f6ff]][cheer.n % 3]!
    for (const [bx, by, delay] of [[castleX - 2.6, 4.6, 0], [castleX + 8.8, 4.2, 0.3]] as const) { // high in the sky, clear of the towers
      const p = (cheer.t - delay) / 0.6
      if (p <= 0 || p >= 1) continue
      const r = 0.4 + p * 2.2
      for (let a = 0; a < 8; a++) {
        const x = bx + Math.cos((a / 8) * Math.PI * 2) * r, y = by + Math.sin((a / 8) * Math.PI * 2) * r * 0.8
        const c = colors[(a + Math.floor(tick / 2)) % 2]!
        for (let dy = 0; dy < Math.max(1, k / 2); dy++) for (let dx = 0; dx < Math.max(1, k / 2); dx++) set(Math.round(x * k) + dx, Math.round(y * k) + dy, c)
      }
      if (p < 0.3) set(Math.round(bx * k), Math.round(by * k), 0xffffff) // the spark at its centre
    }
  }
  for (let X = 0; X < W; X++) {
    const u = (X + 0.5) / k
    for (let Y = Math.floor((G - 1.5 - Math.sin(u / 6 + 1)) * k); Y < G * k; Y++) set(X, Y, w.near)
  }
  // A knoll of the near meadow under the castle: where the meadow dips, the castle's foot would show
  // standing on nothing. The knoll rises over its base, so it stands on the grass.
  const kx0 = castleX - 5, kx1 = castleX + 10, kmid = (kx0 + kx1) / 2, khalf = (kx1 - kx0) / 2
  for (let X = Math.floor(kx0 * k); X < Math.ceil(kx1 * k); X++) {
    const d = ((X + 0.5) / k - kmid) / khalf
    for (let Y = Math.floor((cb - 0.3 + 1.6 * d * d) * k); Y < G * k; Y++) set(X, Y, w.near)
  }
  for (const [fx, tall, col] of [[0.5, 3.5, 0x78dcff], [0.54, 2.5, 0xc88cff], [0.83, 4, 0xff8cdc], [0.66, 3, 0x8cf0c8]] as const) {
    const cx = cols * fx, lit = mix(mix(col, w.near, 0.5), col, w.crystal)
    if (w.crystal > 0.6) dot(cx, G - tall + 0.6, 0.3, mix(lit, 0xffffff, 0.6)) // the tip catches the light
    tri(cx, G - tall, cx - tall / 3, G, cx + tall / 3, G, { line: lit, dark: mix(lit, 0x281446, 0.35), base: lit, light: mix(lit, 0xffffff, 0.3) })
  }
  for (let X = 0; X < W; X++) {
    for (let Y = G * k; Y < (G + 1) * k; Y++) set(X, Y, Y === G * k ? 0x6ed2aa : 0x46aa8c)
    for (let Y = (G + 1) * k; Y < (G + 2) * k; Y++) set(X, Y, Y < (G + 1) * k + k / 2 ? 0x46305a : 0x38264a)
  }
  // Motes drift slowly up and a little sideways: one step every few frames.
  for (let x = 5; x < cols; x += 11) {
    if (hash(x * 3) < 0.4) continue
    const fx = (x + Math.floor(hash(x) * 4)) * k, petal = hash(x + 9) > 0.5 ? 0xffb4f0 : 0xb4dcff
    set(fx, G * k - 1, 0x3c9a6e); set(fx, G * k - 2, 0x3c9a6e)          // stem
    set(fx - 1, G * k - 3, petal); set(fx + 1, G * k - 3, petal)         // petals
    set(fx, G * k - 4, petal); set(fx, G * k - 3, 0xfff0a0)              // top petal, centre
  }
  for (let i = 0; i < 10; i++) {
    if (((i * 7) % 10) / 10 > w.motes) continue
    const slow = Math.floor(tick / 4)
    const x = (i * 37 + Math.floor(slow / 2) * (i % 2 ? 1 : -1) + cols * 4) % cols
    const y = G - 2 - ((slow + i * 17) % (G - 4))
    if (y < 4) continue // clear of the keys' row along the top
    set(x * k, Math.round(y * k), i % 2 ? 0xfff0a0 : 0xbedcff)
  }

  // Clawd the wizard (sprites at the end of the file).
  const hx = s.heroX
  const idle = s.swing <= 0
  const napping = idle && s.sleeping && s.mobs.length === 0
  const blink = tick % 40 < 2
  // Idle with nothing to fight: a round of actions, each held a while, the nap last.
  // The cat joins in: it peeks at the book, paws at the wand Clawd teases it with, comes over to rub against
  // him, and curls up at his feet for the nap.
  const IDLE_ORDER = ['book', 'tease', 'tea', 'rub', 'practice', 'fairy', 'nap'] as const
  const idleAct = IDLE_ORDER[Math.floor(tick / 120) % IDLE_ORDER.length]!
  const teaseStep = [0, 1, 2, 1][Math.floor(tick / 3) % 4]!
  const idleRows = !napping || idleAct === 'rub' ? undefined : idleAct === 'tease' ? CLAWD_MORE.tease[teaseStep]! : IDLE_FRAMES[idleAct]![Math.floor(tick / 3) % 24]!
  const patRows = idle && s.cat?.state === 'pat' ? CLAWD_MORE.pat[Math.floor(s.cat.t * 30 / 6) % 2]! : undefined
  // Clicked: a wave of the wand, a sip of tea, a look at the book, in turn.
  const pokeStep = s.poke ? Math.floor(s.poke.t * POKE_TICKS) : 0
  const pokeRows = idle && s.poke?.who === 'clawd'
    ? s.poke.n === 0 ? CLAWD_MORE.tease[[0, 1, 2, 1][Math.floor(pokeStep / 3) % 4]!]! : IDLE_FRAMES[s.poke.n === 1 ? 'tea' : 'book']![Math.floor(pokeStep / 3) % 24]!
    : undefined
  const actFrames = s.action ? ACTION_FRAMES[s.action.name] : undefined
  const actRows = actFrames ? actFrames[s.action!.frame % actFrames.length] : undefined
  const actPal = s.action ? ACTION_PAL[s.action.name] : undefined
  const plain = actRows ?? (!idle ? CLAWD_SWING : patRows ?? pokeRows ?? idleRows ?? (blink ? CLAWD_BLINK : tick % 8 < 4 ? CLAWD_A : CLAWD_B))
  // The black cat: where, which frame, facing which way, and whether behind Clawd (curled at his feet).
  type CatDraw = { art: string[]; at: number; lift?: number; flip?: boolean; behind?: boolean }
  const cat: CatDraw[] = []
  const extras: { art: string[]; at: number; up: number }[] = [] // a heart, a fish
  if (s.cat) {
    const { state, t } = s.cat
    const sleepy = CAT_ART.sleep[Math.floor(tick / 8) % 2]!
    if (s.poke?.who === 'cat' && (state === 'sleep' || state === 'sit')) { // clicked: a happy squint and a heart, a paw, a swish, in turn
      const n = s.poke.n
      if (n === 0) { cat.push({ art: CAT_MORE.happy[0]!, at: 24 }); extras.push({ art: HEART, at: 27, up: 15 + Math.floor(pokeStep / 5) }) }
      else if (n === 1) cat.push({ art: CAT_MORE.paw[[0, 1, 2, 1][Math.floor(pokeStep / 3) % 4]!]!, at: 24 })
      else cat.push({ art: CAT_MORE.swish[SWISH_LOOP[Math.floor(pokeStep / 2) % SWISH_LOOP.length]!]!, at: 24 })
    } else if (state === 'leap') {
      if (t < 0.35) cat.push({ art: CAT_ART.leap[0]!, at: 25 }) // crouched
      else cat.push({ art: CAT_ART.leap[1]!, at: 25 + Math.round((t - 0.35) * 30), lift: Math.round(Math.sin(((t - 0.35) / 0.65) * Math.PI) * 5) }) // springing in an arc
    } else if (state === 'return' || state === 'carry') { // back from the spring, facing him
      cat.push({ art: CAT_MORE[state === 'carry' ? 'carry' : 'walk'][Math.floor(tick / 2) % 4]!, at: Math.round(44 - t * 20), flip: true })
    } else if (state === 'pat') cat.push({ art: CAT_MORE.happy[0]!, at: 23 })
    else if (state === 'gift') { cat.push({ art: CAT_ART.sit[0]!, at: 25 }); extras.push({ art: FISH, at: 18, up: 0 }) }
    else if (state === 'arch') cat.push({ art: CAT_MORE.arch[Math.floor(tick / 4) % 2]!, at: 23, behind: !idle }) // close by him, clear of the monster at the sword
    else if (state === 'sit') cat.push({ art: CAT_MORE.swish[SWISH_LOOP[Math.floor(tick / 2) % SWISH_LOOP.length]!]!, at: 23, behind: !idle }) // behind his swing, so the wand and the spell show // close by him, facing him, its tail swishing
    else if (!napping) cat.push({ art: sleepy, at: 25 })
    else if (idleAct === 'book') cat.push({ art: CAT_MORE.peek[Math.floor(tick / 10) % 2]!, at: 25 })
    else if (idleAct === 'tease') cat.push({ art: CAT_MORE.paw[teaseStep]!, at: 27 })
    else if (idleAct === 'nap') cat.push({ art: sleepy, at: 16, behind: true })
    else if (idleAct === 'rub') { // walks over, then rubs its head on him; a heart now and then
      const phase = tick % 120
      if (phase < 24) cat.push({ art: CAT_MORE.walk[Math.floor(tick / 2) % 4]!, at: Math.round(34 - (phase / 24) * 15), flip: true })
      else {
        cat.push({ art: CAT_MORE.rub[Math.floor(tick / 6) % 2]!, at: 19, flip: true })
        const h = (phase - 24) % 24
        if (h < 16) extras.push({ art: HEART, at: 21, up: 14 + Math.floor(h / 4) })
      }
    } else cat.push({ art: sleepy, at: 25 })
  }
  const cp = Math.max(1, k / 2)
  const drawCat = ({ art, at, lift = 0, flip = false }: CatDraw) => {
    const w = Math.max(...art.map(r => r.length))
    art.forEach((row, r) => [...row].forEach((ch, c) => {
      const color = CAT_PAL[ch] ?? CAT_MORE_PAL[ch]
      if (color === undefined) return
      const x = flip ? w - 1 - c : c
      const bottom = G * k - 1 - lift * cp
      for (let dy = 0; dy < cp; dy++) for (let dx = 0; dx < cp; dx++) set(hx * k + (at + x) * cp + dx, bottom - (art.length - r) * cp + 1 + dy, color)
    }))
  }
  for (const c of cat) if (c.behind) drawCat(c)

  // Dressed for the model and the effort, whatever the pose.
  const outfit = s.outfit ?? { hat: 'sonnet', wand: 'medium' }
  const sprite = dress(plain, outfit) // every pose: the stands, the swing, the actions, the idle rounds
  const outfitPal = { ...HAT_PAL[outfit.hat], ...DRESS_PAL }
  // Drawn for k = 2; at k = 4 each of its pixels covers 2 × 2.
  const p = Math.max(1, k / 2)
  const top = G * k - sprite.length * p
  const shift = s.action?.name === 'stretch' && actRows ? 1 : 0 // its frames reach a column further left
  sprite.forEach((row, r) => [...row].forEach((ch, c) => {
    const color = (actRows ? actPal?.[ch] : undefined) ?? outfitPal[ch] ?? CLAWD_PAL[ch] ?? IDLE_PAL[ch]
    if (color === undefined) return
    for (let dy = 0; dy < p; dy++) for (let dx = 0; dx < p; dx++) set(hx * k + (c - shift) * p + dx, top + r * p + dy, color)
  }))
  if (!idle) {
    // A spell from the wand's star, its kind chosen by the foe: fire for slimes, lightning for
    // bats, frost for mushrooms, holy light for ghosts, and a star burst for the boss.
    const foe = [...s.mobs].filter(m => m.state !== 'fleeing').sort((a, b) => a.x - b.x)[0]
    const sx = hx + 14.5, sy = G - 3.5
    const tx = foe ? foe.x + foe.w / 2 : sx + 9
    const ty = foe ? s.feet + 1 - foe.lift - 3 : sy
    const t = 1 - s.swing / 6 // 0 as the spell leaves the wand, 1 as it lands (CAST_TICKS)
    castSpell(foe?.kind ?? 'slime', sx, sy, tx, ty, t, tick, dot, fill)
  }
  // The cat in front of him (all but the nap), then a heart or a fish.
  for (const c of cat) if (!c.behind) drawCat(c)
  for (const e of extras) drawCat({ art: e.art, at: e.at, lift: e.up })
  if (s.ward !== undefined) drawWard(s.ward, hx, G, tick, fill)

  // Monsters: pixel sprites in the wizard's own style (sprites at the end of the file).
  for (const m of s.mobs) {
    const flap = (tick + m.id) % 6 < 3
    const bob = m.kind === 'ghost' ? Math.round(Math.sin((tick + m.id) / 3)) / 2 : 0
    const B = s.feet + 1 - m.lift + bob
    const cx = m.x + m.w / 2
    const flash = (m.state === 'dying' && m.fade >= 6) || m.hurt > 2
    if (m.state !== 'dying' || m.fade >= 6) {
      // Slimes (four looks, by id) and the boss bounce through a 10-step squash-and-stretch, each
      // on its own beat, now and then blinking; the others flap or step between two frames.
      const bouncy = m.kind === 'slime' ? (['green', 'blue', 'teal', 'pink'] as const)[m.id % 4] : m.kind === 'boss' ? 'boss' : undefined
      const bounce = bouncy ? MOB_FRAMES[bouncy]![(((tick + m.id * 3) % 10) * 2) + ((tick + m.id * 7) % 30 === 0 ? 1 : 0)] : undefined
      const frames = MOB_SPRITES[m.kind]
      const rows = bounce ? bounce.rows : frames ? frames[flap ? 0 : 1] : undefined
      const pal = bouncy ? { ...MOB_COMMON, ...MOB_STYLES[bouncy], k: MOB_STYLES[bouncy]!.o! } : MOB_PAL
      if (rows) {
        const p = Math.max(1, k / 2)
        const sw = Math.max(...rows.map(r => r.length))
        const left = Math.round(cx * k - (sw * p) / 2), top = Math.round((B - (bounce?.lift ?? 0)) * k) - rows.length * p
        // Hit points: a small outlined bar floating above the crown, bobbing with it.
        if (m.kind === 'boss' && m.state !== 'dying') {
          const seg = 2 * p, gap = p, w = m.maxHp * (seg + gap) - gap
          const x0 = Math.round(cx * k - w / 2), y0 = top - 4 * p
          for (let y = y0 - p; y < y0 + 2 * p; y++) for (let x = x0 - p; x < x0 + w + p; x++) set(x, y, 0x1a1030)
          for (let i = 0; i < m.maxHp; i++) for (let y = y0; y < y0 + p; y++) for (let x = 0; x < seg; x++) set(x0 + i * (seg + gap) + x, y, i < m.hp ? 0xff4d5e : 0x4a2a3e)
        }
        rows.forEach((row, r) => [...row].forEach((ch, c) => {
          const color = pal[ch]
          if (color === undefined) return
          for (let dy = 0; dy < p; dy++) for (let dx = 0; dx < p; dx++) set(left + c * p + dx, top + r * p + dy, flash ? 0xffffff : color)
        }))
      }
    }

    // A burst of sparks while dying.
    if (m.state === 'dying') {
      const r = (9 - m.fade) * 0.7, by = B - 3
      for (let a = 0; a < 8; a++) {
        const t = (a * Math.PI) / 4
        dot(cx + r * Math.cos(t), by + r * 0.6 * Math.sin(t), 0.35, a % 2 ? 0xffe066 : 0xffffff)
      }
    }
  }
  return px
}

// The magic world's palette for a local hour, blended across dawn (5-7) and dusk (17-19):
// the same castle, crystals and meadow all day, only the light changes.
type World = { sky: [number, number, number]; hill: number; near: number; stars: number; crystal: number; motes: number; windows: boolean; sun?: number; moon?: number }
const W_NIGHT = { sky: [0x1c103a, 0x3a1e62, 0x6e368c] as [number, number, number], hill: 0x362256, near: 0x24464c, stars: 1, crystal: 1, motes: 1 }
const W_MORNING = { sky: [0x785ca0, 0xc48cc4, 0xffc4c8] as [number, number, number], hill: 0x6e548c, near: 0x467878, stars: 0.2, crystal: 0.5, motes: 0.4 }
const W_DAY = { sky: [0x6e78dc, 0xa0a8f0, 0xd6d2fa] as [number, number, number], hill: 0x7c74ba, near: 0x4c968c, stars: 0, crystal: 0.35, motes: 0.3 }
const W_DUSK = { sky: [0x3c286e, 0xaa5096, 0xff9678] as [number, number, number], hill: 0x54346e, near: 0x346064, stars: 0.4, crystal: 0.75, motes: 0.7 }
type WPal = typeof W_NIGHT
const wblend = (a: WPal, b: WPal, t: number): WPal => ({
  sky: [mix(a.sky[0], b.sky[0], t), mix(a.sky[1], b.sky[1], t), mix(a.sky[2], b.sky[2], t)],
  hill: mix(a.hill, b.hill, t), near: mix(a.near, b.near, t),
  stars: a.stars + (b.stars - a.stars) * t, crystal: a.crystal + (b.crystal - a.crystal) * t, motes: a.motes + (b.motes - a.motes) * t,
})

export function worldFor(hour: number): World {
  const ramp = (from: number, to: number) => Math.min(Math.max((hour - from) / (to - from), 0), 1)
  let p: WPal
  if (hour < 5 || hour >= 19) p = W_NIGHT
  else if (hour < 6) p = wblend(W_NIGHT, W_MORNING, ramp(5, 6))
  else if (hour < 8) p = wblend(W_MORNING, W_DAY, ramp(6, 8))
  else if (hour < 17) p = W_DAY
  else if (hour < 18) p = wblend(W_DAY, W_DUSK, ramp(17, 18))
  else p = wblend(W_DUSK, W_NIGHT, ramp(18, 19))
  const night = hour < 5.5 || hour >= 18.5
  return { ...p, windows: hour >= 17 || hour < 6, sun: night ? undefined : hour < 8 || hour > 16 ? 0xffb478 : 0xfff6d2, moon: night ? 0xfff6d6 : undefined }
}

// Clawd as a little wizard, at the fine grid's own pixels (drawn for k = 2: 19 tall, a bit
// under the room above the ground): the mascot's orange block with a shaded base, small eyes and
// blush, nub arms, four legs; a blue pointed hat with stars, and a star wand.
// k outline, O/o body, E eyes, p blush, U/u/N hat and band, T/t hat stars, w wand, Y/y wand star.
// Clawd's outfit. The hat says which model answers: Haiku a plain cloth cap, Sonnet the blue starry hat,
// Opus purple with a gold band, Fable a crown. The wand says how hard it thinks, a leafy twig at low up to
// the sun staff at max.
export type Outfit = { hat: 'haiku' | 'sonnet' | 'opus' | 'fable'; wand: 'low' | 'medium' | 'high' | 'xhigh' | 'max' }
const HAT_PAL: Record<Outfit['hat'], Record<string, number>> = {
  haiku: { U: 0x9a6a3e, u: 0x6e4a28, N: 0x4a3018, T: 0x9a6a3e, t: 0xc8a070 },
  sonnet: {},
  opus: { U: 0x8a4fd0, u: 0x5e2f9a, N: 0xffc83d, T: 0xffd84d, t: 0xffffff },
  fable: { U: 0xfff6e0, u: 0xd8c8a0, N: 0xffc83d, T: 0xff4f7a, t: 0x5fb8ff },
}
const DRESS_PAL: Record<string, number> = {
  G: 0xffc83d, J: 0xb07a12, S: 0xfff3b0, D: 0x2e9e5b, F: 0x5fd787, C: 0x8fe8ff, H: 0xffffff, V: 0xc08cff, v: 0x7a4fd0, A: 0xf4f6ff, B: 0xaab4e0,
}
// A wand's head: 7 columns (16–22) over rows 0–5; the stick under it, in column 19, recoloured for the gold staffs.
const WAND_HEAD: Record<Outfit['wand'], { art: string[]; stick: string } | undefined> = {
  low: { art: ['..DF...', '.FFDF.F', '..FwFFD', '...w.F.', '..Dw...', '...w...'], stick: 'w' },
  medium: undefined, // the star wand as drawn
  high: { art: ['...k...', '..kCk..', '.kCHCk.', '.kCCCk.', '.GkCkG.', '..GwG..'], stick: 'w' },
  xhigh: { art: ['...k...', 'A.kVk.A', 'ABkvkBA', '.BkVkB.', '..GGG..', '...G...'], stick: 'G' },
  max: { art: ['S..Y..S', '..kYk..', 'YkYyYkY', '..kYk..', 'S.YGY.S', '...G...'], stick: 'G' },
}
// Fable's crown, 12 columns centred on the head; drawn as its left half and mirrored, so it is symmetric.
const CROWN = ['.k...k', 'kNk.kN', 'kNNkNN', 'kNNNNT', 'kNtNNN', 'kJJJJJ'].map(h => h + [...h].reverse().join(''))
const dressed = new WeakMap<string[], Map<string, string[]>>()
// Any pose: the wand's star (a vertical kYk / kYyYk / kYk) becomes the effort's head, its stick recoloured;
// a star seen side-on (the swing) takes the head's colours. Fable's crown replaces the hat over its band.
const STAR_TINT: Record<Outfit['wand'], Record<string, string>> = {
  low: { Y: 'F', y: 'D' }, medium: {}, high: { Y: 'C', y: 'H' }, xhigh: { Y: 'V', y: 'A' }, max: { Y: 'Y', y: 'S' },
}
function dress(frame: string[], o: Outfit): string[] {
  const key = `${o.hat}:${o.wand}`
  let byFrame = dressed.get(frame)
  if (!byFrame) dressed.set(frame, (byFrame = new Map()))
  const hit = byFrame.get(key)
  if (hit) return hit
  const width = Math.max(23, ...frame.map(r => r.length))
  const rows = frame.map(r => r.padEnd(width, '.'))
  const at = (r: number, c: number) => rows[r]?.[c] ?? '.'
  const put = (r: number, c: number, ch: string) => { if (r >= 0 && r < rows.length) rows[r] = rows[r]!.slice(0, c) + ch + rows[r]!.slice(c + 1) }
  const head = WAND_HEAD[o.wand]
  let placed = false
  for (let r = 1; r < rows.length - 1 && head && !placed; r++) for (let c = 1; c < width - 1; c++) {
    if (at(r, c) !== 'y' || at(r - 1, c) !== 'Y' || at(r + 1, c) !== 'Y') continue
    let r0 = r - 4 // the head's box, as the standing pose has it (star centre at its column 3, row 4)
    const c0 = c - 3
    if (r0 < 0) { rows.unshift(...Array.from({ length: -r0 }, () => '.'.repeat(width))); r0 = 0 } // a star near the top (the pat): room above for the head, the pose still on the ground
    for (let i = 0; i < rows.length; i++) rows[i] = rows[i]!.padEnd(c0 + 7, '.') // and room to its right
    for (let rr = r0; rr <= r0 + 5; rr++) for (let cc = c0; cc <= c0 + 6; cc++) if ('kYyw'.includes(at(rr, cc))) put(rr, cc, '.')
    head.art.forEach((line, i) => [...line].forEach((ch, j) => { if (ch !== '.') put(r0 + i, c0 + j, ch) }))
    for (let rr = r0 + 6; rr < rows.length; rr++) if (at(rr, c) === 'w') put(rr, c, head.stick)
    placed = true
    break
  }
  if (!placed) { // side-on: tint the star
    const tint = STAR_TINT[o.wand]
    for (let r = 0; r < rows.length; r++) rows[r] = [...rows[r]!].map(ch => tint[ch] ?? ch).join('')
  }
  if (o.hat === 'fable') {
    const band = rows.findIndex(r => r.includes('NNNNNNNNNN'))
    if (band >= 6) {
      const c0 = rows[band]!.indexOf('N') - 1
      for (let r = band - 6; r < band; r++) for (let c = c0; c < c0 + 12; c++) if ('kUuTtN'.includes(at(r, c))) put(r, c, '.')
      CROWN.forEach((line, i) => [...line].forEach((ch, j) => { if (ch !== '.') put(band - 6 + i, c0 + j, ch) }))
    }
  }
  byFrame.set(key, rows)
  return rows
}

// The black cat, drawn from a guide to small pixel cats: a three-quarter sit facing out (gold 1 × 2 eyes, a
// 1-pixel nose), a curled loaf asleep, a side-on crouch and spring. Outline, body and a lit rim; every frame of a
// pose the same size, the bottom row on the ground.
const CAT_PAL: Record<string, number> = {
  k: 0x0c0814, K: 0x2a2040, h: 0x4a3d66, d: 0x1c1530, L: 0x8a7fb0, Y: 0xffd75f, P: 0xffb3c1, Q: 0xd0708a,
}
const CAT_ART: Record<'sleep' | 'sit' | 'leap' | 'blink', string[][]> = {
  sleep: [
    [
      '..................',
      '....kkkk..k....k..',
      '..kkhhhhkkhk..khk.',
      '.khkhKKKhkKhkkhKk.',
      'kKKkKKKKKKKKKKKKKk',
      'kKKkkkkkkKLLKKLLKk',
      '.khhhhhhhkKKKKKKKk',
      '..kKKKKKKhkKKKKKKk',
      '...kkkkkkkkkkkkkk.',
    ],
    [
      '....kkkk..........',
      '...khhhhk.k....k..',
      '..kkKKKKkkhk..khk.',
      '.khkhKKKhkKhkkhKk.',
      'kKKkKKKKKKKKKKKKKk',
      'kKKkkkkkkKLLKKLLKk',
      '.khhhhhhhkKKKKKKKk',
      '..kKKKKKKhkKKKKKKk',
      '...kkkkkkkkkkkkkk.',
    ],
  ],
  sit: [
    [
      '.k.......k........',
      'khk.....khk.......',
      'kKhkkkkkhKk.......',
      'kKKKhhhKKKk...kkk.',
      'kKKYKKKYKKk..khhhk',
      'kKKYKPKYKKk.kKKkhk',
      '.kdddddddk..kKKkk.',
      '..kKhKKKKk..kKKk..',
      '..kKhKKKKhk.kKKk..',
      '..kKhKKKKKhkkKKk..',
      '..kKKKKKKKKhkKKk..',
      '..kKKKKKKKKKkKKk..',
      '..kKKkKKkKKKKKKk..',
      '...kkkkkkkkkkkk...',
    ],
    [
      '.k.......k........',
      'khk.....khk.......',
      'kKhkkkkkhKk.....k.',
      'kKKKhhhKKKk...kkhk',
      'kKKYKKKYKKk..khhKk',
      'kKKYKPKYKKk.kKKkk.',
      '.kdddddddk..kKKk..',
      '..kKhKKKKk..kKKk..',
      '..kKhKKKKhk.kKKk..',
      '..kKhKKKKKhkkKKk..',
      '..kKKKKKKKKhkKKk..',
      '..kKKKKKKKKKkKKk..',
      '..kKKkKKkKKKKKKk..',
      '...kkkkkkkkkkkk...',
    ],
    [
      '.k.......k........',
      'khk.....khk.......',
      'kKhkkkkkhKk.......',
      'kKKKhhhKKKk...kkk.',
      'kKKYKKKYKKk..khhhk',
      'kKKYKPKYKKk.kKKkKk',
      '.kdddddddk..kKKkhk',
      '..kKhKKKKk..kKKkk.',
      '..kKhKKKKhk.kKKk..',
      '..kKhKKKKKhkkKKk..',
      '..kKKKKKKKKhkKKk..',
      '..kKKKKKKKKKkKKk..',
      '..kKKkKKkKKKKKKk..',
      '...kkkkkkkkkkkk...',
    ],
  ],
  leap: [
    [
      '..................',
      '...k..............',
      '..khk.............',
      '.kKKk.....k.....k.',
      'kKKk.....khk...khk',
      'kKKk.....khKkkkKhk',
      'kKKkkkk..kKKhhhKKk',
      '.kKKhhhkkkKYKKKYKk',
      '..kKKKKhhhKYKPKYKk',
      '..kKKKKKKKKdddddk.',
      '..kKKKKKKKkKKkKKk.',
      '...kkkkkkkkkkkkk..',
    ],
    [
      '...k......k.....k.',
      '..khk....khk...khk',
      '.kKKk....khKkkkKhk',
      '.kKKk....kKKhhhKKk',
      '..kKKk.kkkKYKKKYKk',
      '...kKKkhhhKYKPKYKk',
      '..kkKKKKKKKdddddk.',
      '.kKKKKKKKKKKkkkk..',
      'kKKKKkkkkkkKKkk...',
      'kKKkk......kkKKkk.',
      '.kk..........kkKKk',
      '...............kk.',
    ],
  ],
  blink: [
    [
      '.k.......k........',
      'khk.....khk.......',
      'kKhkkkkkhKk.......',
      'kKKKhhhKKKk...kkk.',
      'kKKKKKKKKKk..khhhk',
      'kKLLKPKLLKk.kKKkhk',
      '.kdddddddk..kKKkk.',
      '..kKhKKKKk..kKKk..',
      '..kKhKKKKhk.kKKk..',
      '..kKhKKKKKhkkKKk..',
      '..kKKKKKKKKhkKKk..',
      '..kKKKKKKKKKkKKk..',
      '..kKKkKKkKKKKKKk..',
      '...kkkkkkkkkkkk...',
    ],
  ],
}

const CLAWD_PAL: Record<string, number> = {
  k: 0x3a1c14, O: 0xd97757, o: 0xb5603f, E: 0x1c1420, p: 0xf09a8a,
  U: 0x3d55c4, u: 0x2a3a8f, N: 0x1c2258, T: 0xffd84d, t: 0xfff3b0, w: 0x8a5a2e, Y: 0xffd84d, y: 0xfff3b0,
}
const CLAWD_A = [
  '.........kkkUUk',
  '.......kkUUUUkUk',
  '......kUUUUtukk....k',
  '......kUUTUUuk....kYk',
  '.....kUUTtTUTuk..kYyYk',
  '.....kUtUTUUUuk...kYk',
  '..kkkNNNNNNNNNNkkkkwk',
  '.kUUUUUUUUUUUUUUUUkwk',
  '..kuuuuuuuuuuuuuukkwk',
  '..kOOOOOOOOOOOOOOkkwk',
  '.kkOOOOEOOOOEOOOOkkwk',
  'kOOOOOOEOOOOEOOOOOOwk',
  'kOOOOOOEOOOOEOOOOOOwk',
  'kooOOpOOOOOOOOpOOoowk',
  '.kkOOOOOOOOOOOOOOkkk',
  '..kooooooooooooook',
  '...kokkokkkokkokk',
  '...kokkok.kokkok',
  '...kokkok.kokkok',
]
const CLAWD_B = [
  '.........kkkUUk',
  '.......kkUUUUkUk',
  '......kUUUUtukk....k',
  '......kUUTUUuk....kYk',
  '.....kUUTtTUTuk..kYyYk',
  '.....kUtUTUUUuk...kYk',
  '..kkkNNNNNNNNNNkkkkwk',
  '.kUUUUUUUUUUUUUUUUkwk',
  '..kuuuuuuuuuuuuuukkwk',
  '..kOOOOOOOOOOOOOOkkwk',
  '.kkOOOOEOOOOEOOOOkkwk',
  'kOOOOOOEOOOOEOOOOOOwk',
  'kOOOOOOEOOOOEOOOOOOwk',
  'kooOOpOOOOOOOOpOOoowk',
  '.kkOOOOOOOOOOOOOOkkk',
  '..kooooooooooooook',
  '...kkokkokokkokkk',
  '....kokkokokkok',
  '....kokkokokkok',
]
const CLAWD_BLINK = [
  '.........kkkUUk',
  '.......kkUUUUkUk',
  '......kUUUUtukk....k',
  '......kUUTUUuk....kYk',
  '.....kUUTtTUTuk..kYyYk',
  '.....kUtUTUUUuk...kYk',
  '..kkkNNNNNNNNNNkkkkwk',
  '.kUUUUUUUUUUUUUUUUkwk',
  '..kuuuuuuuuuuuuuukkwk',
  '..kOOOOOOOOOOOOOOkkwk',
  '.kkOOOOOOOOOOOOOOkkwk',
  'kOOOOOOOOOOOOOOOOOOwk',
  'kOOOOOEEEOOEEEOOOOOwk',
  'kooOOpOOOOOOOOpOOoowk',
  '.kkOOOOOOOOOOOOOOkkk',
  '..kooooooooooooook',
  '...kokkokkkokkokk',
  '...kokkok.kokkok',
  '...kokkok.kokkok',
]
const CLAWD_SLEEP = [
  '.........kkkUUk',
  '.......kkUUUUkUk',
  '......kUUUUtukk',
  '......kUUTUUuk',
  '.....kUUTtTUTuk',
  '.....kUtUTUUUuk',
  '..kkkNNNNNNNNNNkkk',
  '.kUUUUUUUUUUUUUUUUk',
  '..kuuuuuuuuuuuuuuk',
  '..kOOOOOOOOOOOOOOk',
  '.kkOOOOOOOOOOOOOOkk',
  'kOOOOOOOOOOOOOOOOOOk',
  'kOOOOOEEEOOEEEOOOOOk',
  'kooOOpOOOOOOOOpOOook',
  '.kkOOOOOOOOOOOOOOkk',
  '..kooooooooooooook',
  '...kokkokkkokkokk',
  '...kokkok.kokkok',
  '...kokkok.kokkok',
]
const CLAWD_SWING = [
  '.........kkkUUk',
  '.......kkUUUUkUk',
  '......kUUUUtukk',
  '......kUUTUUuk',
  '.....kUUTtTUTuk',
  '.....kUtUTUUUuk',
  '..kkkNNNNNNNNNNkkk',
  '.kUUUUUUUUUUUUUUUUk',
  '..kuuuuuuuuuuuuuuk',
  '..kOOOOOOOOOOOOOOk',
  '.kkOOOOEOOOOEOOOOkk......k.k',
  'kOOOOOOEOOOOEOOOOOOkkkkkkkYk',
  'kOOOOOOEOOOOEOOOOOOwwwwwwYyYk',
  'kooOOpOOOOOOOOpOOookkkkkkkYk',
  '.kkOOOOOOOOOOOOOOkk......k.k',
  '..kooooooooooooook',
  '...kokkokkkokkokk',
  '...kokkok.kokkok',
  '...kokkok.kokkok',
]

// The monsters, two frames each, at the fine grid's own pixels (drawn for k = 2).
// k outline, E eyes, W shine or teeth, p blush; G/g slime, V/v bat, R/r M/m F mushroom, H/h ghost, P/q B boss.
const MOB_PAL: Record<string, number> = {
  k: 0x3a1c14, E: 0x1c1420, W: 0xffffff, p: 0xf09a8a,
  G: 0x6cc04a, g: 0x3f8f30, V: 0x7d6a9e, v: 0xb48ee0, R: 0xe0413a, r: 0xa82a24, M: 0xf3e3c3, m: 0xd8c49e, F: 0x7a4a22,
  H: 0xf4f6ff, h: 0xc4cbe8, P: 0x9c4dcc, q: 0x6e3a9a, B: 0xf3e6c4,
}
const MOB_SPRITES: Record<string, [string[], string[]]> = {
  slime: [
    [
      '.',
      '......kkkk',
      '....kkGGGGkk',
      '...kGGGGGGGGk',
      '..kGGWWGGGGGGk',
      '..kGGWGGGGGGGk',
      '.kGGGGGGGGGgggk',
      '.kGGGGEGGGEgggk',
      '.kGGGGEGGGEgggk',
      'kGGGpGGGEGGgpggk',
      'kGGGGGGGGGGggggk',
      'kGGGGGGGGGGggggk',
    ],
    [
      '.',
      '.',
      '.......kk',
      '....kkkGGkkk',
      '...kGGGGGGGGk',
      '..kGGWWGGGGGGk',
      '.kGGGWGGGGGgggk',
      'kGGGGGGGGGGggggk',
      'kGGGGGEGGGEggggk',
      'kGGGGGEGGGEggggk',
      'kGGGpGGGGGGgpggk',
      'kGGGGGGGGGGggggk',
    ],
  ],
  bat: [
    [
      '...kk...k....k...kk',
      '..kvvk.kVkkkkVk.kvvk',
      '.kvvvvkkVkVVkVkkvvvvk',
      'kvvvvvvkVVVVVVkvvvvvvk',
      'kvvvvvvvVVVVVVvvvvvvvk',
      'kvkvvvvvVEVVEVvvvvvkvk',
      '.k.kvkvvVVVVVVvvkvk.k',
      '....k.kkkkWWkkkk.k',
      '..........kk',
    ],
    [
      '........k....k',
      '.......kVkkkkVk',
      '.......kVkVVkVk',
      '.....kkkVVVVVVkkk',
      '...kkvvvVVVVVVvvvkk',
      '..kvvvvvVEVVEVvvvvvk',
      '.kvvvvvvVVVVVVvvvvvvk',
      'kvvvvvvkkkWWkkkvvvvvvk',
      'kvvvkvk...kk...kvkvvvk',
    ],
  ],
  mushroom: [
    [
      '.....kkkkkk',
      '...kkRRRRRRkk',
      '..kRRRRRRRWWRk',
      '.kRRWWRRRRRRRRk',
      'kRRRWRRRRRRrrrrk',
      'kRRRRRRWWRRrWrrk',
      'kRRRRRRRRRRrrrrk',
      'kRRRMMMMMMMMMrrk',
      '.kkkMMMMMMmmmkk',
      '...kMMEMMMEmmk',
      '...kMMEMMMEmmk',
      '...kMpMMMMmpmk',
      '...kMMMMMMmmmk',
      '...kFFFkkkFFFk',
      '....kkk...kkk',
    ],
    [
      '.....kkkkkk',
      '...kkRRRRRRkk',
      '..kRRRRRRRWWRk',
      '.kRRWWRRRRRRRRk',
      'kRRRWRRRRRRrrrrk',
      'kRRRRRRWWRRrWrrk',
      'kRRRRRRRRRRrrrrk',
      'kRRRMMMMMMMMMrrk',
      '.kkkMMMMMMmmmkk',
      '...kMMEMMMEmmk',
      '...kMMEMMMEmmk',
      '...kMpMMMMmpmk',
      '...kMMMMMMmmmk',
      '....kFFFkFFFk',
      '.....kkk.kkk',
    ],
  ],
  ghost: [
    [
      '....kkkkk',
      '...kHHHHHk',
      '..kHHHHHHhk',
      '.kHHHHHHHhhk',
      '.kHHHHHHHhhk',
      '.kHHEHHHEhhk',
      '.kHHEHHHEhhk',
      '.kHpHHHHHphk',
      '.kHHHHEHHhhk',
      '.kHHHHHHHhhk',
      '.kHHHHHHHhhk',
      '.kHHHkHHHkhk',
      '..kHk.kHk.k',
    ],
    [
      '....kkkkk',
      '...kHHHHHk',
      '..kHHHHHHhk',
      '.kHHHHHHHhhk',
      '.kHHHHHHHhhk',
      '.kHHEHHHEhhk',
      '.kHHEHHHEhhk',
      '.kHpHHHHHphk',
      '.kHHHHEHHhhk',
      '.kHHHHHHHhhk',
      '.kHHHHHHHhhk',
      '..kHHHkHHhk',
      '...kHk.kHk',
    ],
  ],
  boss: [
    [
      '..kBk......kBk',
      '..kBk......kBk',
      '...kBkkkkkkBk',
      '...kPPPPPPPPk',
      '..kPPPPPPPPPPk',
      '.kPPPPPPPPPPPPk',
      '.kPPWWWPPWWWqqk',
      'kPPPWEEPPWEEqqqk',
      'kPPPPPPPPPPqqqqk',
      '.kPpPPPPPPPqpqk',
      '.kPPPPWEEEWqqqk',
      '.kPPPPPPPPPqqqk',
      '..kqqqqqqqqqqk',
      '...kkqqqqqqkk',
      '...kqqkkkkqqk',
    ],
    [
      '..kBk......kBk',
      '..kBk......kBk',
      '...kBkkkkkkBk',
      '...kPPPPPPPPk',
      '..kPPPPPPPPPPk',
      '.kPPPPPPPPPPPPk',
      '.kPPWWWPPWWWqqk',
      'kPPPWEEPPWEEqqqk',
      'kPPPPPPPPPPqqqqk',
      '.kPpPPPPPPPqpqk',
      '.kPPPPWEEEWqqqk',
      '.kPPPPPPPPPqqqk',
      '..kqqqqqqqqqqk',
      '...kkqqqqqqkk',
      '....kqqkkqqk',
    ],
  ],
}

type Dot = (cx: number, cy: number, rad: number, c: number) => void
type Fill = (x0: number, y0: number, x1: number, y1: number, f: (u: number, v: number) => number) => void

// One frame of a spell flying from (sx, sy) to (tx, ty), t from 0 (cast) to 1 (landing).
// Each is drawn bold, a white core in a colored glow, to read at a glance at this size.
// A refused call: seven glowing hexagons, one in the middle and six around it, spring up before Clawd, the
// middle first. Bright lines, the cells see-through. It holds, then thins away pixel by pixel over its last quarter.
function drawWard(t: number, hx: number, G: number, tick: number, fill: Fill) {
  const fade = t > 0.75 ? (1 - t) / 0.25 : 1
  const shown = (seed: number) => fade >= 1 || ((seed * 7919) % 100) / 100 < fade
  const r = 2.4, ox = hx + 21, oy = G - 6.5 // a cell's corner radius; the middle cell's centre
  const cells = [[0, 0], ...[0, 60, 120, 180, 240, 300].map(a => [Math.cos((a * Math.PI) / 180) * r * Math.sqrt(3), Math.sin((a * Math.PI) / 180) * r * Math.sqrt(3)])]
  cells.forEach(([dx, dy], i) => {
    if (t < (i === 0 ? 0 : 0.03 + i * 0.012)) return // the middle, then the ring, all within about two ticks
    const cx = ox + dx!, cy = oy + dy!
    fill(cx - r - 0.5, cy - r - 0.5, cx + r + 0.5, cy + r + 0.5, (u, v) => {
      const ax = Math.abs(u - cx), ay = Math.abs(v - cy)
      const hex = Math.max(ax, ax * 0.5 + ay * 0.866) / (r * 0.866) // 1 on a pointy-top hexagon's edge
      if (hex > 1.04 || !shown(Math.round(u * 13 + v * 7))) return -1
      if (hex > 0.9) return 0xd8f8ff // the glowing line
      if (hex > 0.8) return 0x6fd0ff // its glow, inward
      return (Math.round(u * 2) + Math.round(v * 2) + tick) % 5 === 0 ? 0x4aa8ff : -1 // a sparse see-through sheen
    })
  })
}

function castSpell(kind: string, sx: number, sy: number, tx: number, ty: number, t: number, tick: number, dot: Dot, fill: Fill) {
  const at = (u: number) => ({ x: sx + (tx - sx) * u, y: sy + (ty - sy) * u })
  const glow = (x: number, y: number, r: number, outer: number, inner: number) => { dot(x, y, r, outer); dot(x, y, r * 0.55, inner) }
  if (kind === 'bat') {
    // Lightning: a thick zigzag bolt from the wand to the foe, a flash where it strikes.
    let px = sx, py = sy
    for (let i = 1; i <= 6; i++) {
      const p = at(i / 6)
      const ny = p.y + (i < 6 ? (i % 2 ? -1 : 1) * (0.9 + ((tick + i) % 2) * 0.3) : 0)
      for (let j = 0; j <= 8; j++) {
        const u = j / 8
        dot(px + (p.x - px) * u, py + (ny - py) * u, 0.55, 0xffe040)
        dot(px + (p.x - px) * u, py + (ny - py) * u, 0.25, 0xffffff)
      }
      px = p.x; py = ny
    }
    if (t > 0.3) glow(tx, ty, 1.8 + (tick % 2) * 0.4, 0xffe040, 0xffffff)
    return
  }
  if (kind === 'mushroom') {
    // Frost: an ice orb trailing crystals, a snowflake where it lands.
    const p = at(t)
    for (let i = 1; i <= 3; i++) {
      const q = at(Math.max(0, t - i * 0.08))
      dot(q.x, q.y + ((i % 2) ? -0.5 : 0.5), 0.45, 0x9fe0ff)
    }
    glow(p.x, p.y, 1.1, 0x5ab8ff, 0xffffff)
    if (t > 0.8) for (let a = 0; a < 6; a++) {
      const an = (a * Math.PI) / 3
      for (let r = 0.6; r <= 2.2; r += 0.5) dot(tx + Math.cos(an) * r, ty + Math.sin(an) * r, 0.3, 0xe8f8ff)
    }
    return
  }
  if (kind === 'ghost') {
    // Holy light: a broad golden beam, white at its core, a halo where it lands.
    const p = at(Math.min(1, t * 1.3))
    fill(Math.min(sx, p.x), Math.min(sy, p.y) - 1.5, Math.max(sx, p.x), Math.max(sy, p.y) + 1.5, (u, v) => {
      const k = (u - sx) / (p.x - sx || 1)
      const d = Math.abs(v - (sy + (p.y - sy) * k))
      return d < 0.45 ? 0xffffff : d < 1.1 ? 0xffd84d : -1
    })
    if (t > 0.5) for (let a = 0; a < 8; a++) {
      const an = (a * Math.PI) / 4 + tick * 0.3
      dot(tx + Math.cos(an) * 2.6, ty + Math.sin(an) * 2.0, 0.4, 0xfff3b0)
    }
    return
  }
  if (kind === 'boss') {
    // A star burst: a big spinning star trailed by smaller ones.
    for (let i = 0; i < 4; i++) {
      const p = at(Math.max(0, t - i * 0.12))
      const r = i === 0 ? 1.5 : 0.8 - i * 0.1
      for (let a = 0; a < 5; a++) {
        const an = (a * 2 * Math.PI) / 5 + tick * 0.5 - Math.PI / 2
        for (let s = 0.3; s <= r; s += 0.3) dot(p.x + Math.cos(an) * s, p.y + Math.sin(an) * s, i === 0 ? 0.42 : 0.3, 0xffd84d)
      }
      dot(p.x, p.y, i === 0 ? 0.7 : 0.35, 0xfff6c0)
    }
    return
  }
  // Fire (slimes): a big fireball with a tail of embers.
  const p = at(t)
  for (let i = 4; i >= 1; i--) {
    const q = at(Math.max(0, t - i * 0.07))
    dot(q.x, q.y + Math.sin(tick + i) * 0.3, 1.0 - i * 0.18, i < 2 ? 0xff8a20 : 0xe0412a)
  }
  glow(p.x, p.y, 1.3, 0xff8a20, 0xfff0a0)
  dot(p.x + 0.3, p.y - 0.3, 0.3, 0xffffff)
}
