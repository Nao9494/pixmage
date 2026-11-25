// Pure game logic: no $, so it is testable on its own.
import { drawHires, type Outfit } from './hires'
import { glyph, GLYPH_H } from './font'
import { ICON, type IconName } from './icons'
import { encodePng, pngCache } from './png'

export const TEXT_PX = 7 // font pixels per scene pixel: a 12-pixel glyph in a 2-pixel text row, a pixel to spare each side
const CLEAR = 0x010203 // the text layer's see-through color: no glyph is drawn in it
const textCache = pngCache()
export const ROWS = 6 // terminal rows
export const PX_ROWS = ROWS * 2 // two pixels per cell via '▀'
const HI_SKY = 2 // the finer mode's extra rows of sky above the scene, room for a castle and a high sun
const HERO_X = 3
const FEET = 9 // sprites stand with their bottom pixel on this row
const CONTACT = HERO_X + 21 // where a monster meets the sword
const CAST_RANGE = 14 // the wizard (finer modes) casts from range: a doomed monster stops this far past CONTACT
const CAST_TICKS = 6 // how long a spell takes to land

const PAL: Record<string, number> = {
  K: 0x1c1420, // outline, eyes
  O: 0xd97757, // Clawd
  S: 0xc9cfdc, s: 0x8a92a6, R: 0xe0413a, // helmet, rim, plume
  W: 0xf4f8ff, // blade, shine
  Y: 0xffc83d, y: 0xb07a12, // hilt
  L: 0xbfe9ff, // slash trail
  G: 0x6cc04a, g: 0xa8e77f, d: 0x3a7d26, // slime
  P: 0x9c4dcc, p: 0x6e3a9a, B: 0xf3e6c4, // boss
  b: 0x7d6a9e, v: 0xb48ee0, E: 0xff5a5a, // bat
  r: 0xe0413a, m: 0xf3e3c3, // mushroom cap, stem
  w: 0xe8ecff, q: 0xa9b2e0, // ghost
  C: 0x6b6fa8, c: 0x8b8fc8, // cloud
}

// Clawd, Claude Code's mascot (a flat orange block, two tall eyes, nub arms, four legs),
// in a knight's helmet, sword in the right nub.
const HERO_A = [
  '.....RRR.....W.',
  '....SSSSs....W.',
  '...SSSSSSs...W.',
  '..sssssssss..W.',
  '..OOKOOOKOO.YYY',
  'OOOOKOOOKOOOOy.',
  'OOOOOOOOOOOOOy.',
  '..OOOOOOOOO....',
  '...O.O..O.O....',
  '...O.O..O.O....',
]
const HERO_B = [...HERO_A.slice(0, 8), '..O.O....O.O...', '..O.O....O.O...']
const HERO_BLINK = HERO_A.map((r, i) => (i === 4 ? r.replace(/K/g, 'O') : r))
const HERO_SLEEP = HERO_BLINK.map(r => r.replace(/[WYy]/g, '.')) // sword put down
const HERO_SWING = [
  '.....RRR',
  '....SSSSs',
  '...SSSSSSs',
  '..sssssssss',
  '..OOKOOOKOO.Y',
  'OOOOKOOOKOOOOyWWWWWWW',
  'OOOOOOOOOOOOOyLLLLLL',
  '..OOOOOOOOO.Y',
  '...O.O..O.O',
  '...O.O..O.O',
]
const SLASH = ['.L', '..L', '..L', '..L', '.L']

const SLIME_A = [
  '..KKKK..',
  '.KgGGGK.',
  'KgWGGGGK',
  'KGKGGKGK',
  'KdGGGGdK',
  '.KKKKKK.',
]
const SLIME_B = [
  '.KKKKKK.',
  'KgWGGGGK',
  'KGKGGKGK',
  'KdGGGGdK',
  'KKKKKKKK',
]
const BAT_A = ['v..b.b..v', 'vvvbbbvvv', '..bEbEb..', '...bbb...']
const BAT_B = ['...b.b...', '.vvbbbvv.', 'vvbEbEbvv', 'v..bbb..v']
const MUSH_TOP = [
  '..rrrr..',
  '.rWrrrr.',
  'rrrrrWWr',
  'rWWrrrrr',
  '.KKKKKK.',
  '.mKmmKm.',
  '.mmmmmm.',
]
const MUSH_A = [...MUSH_TOP, '.K....K.']
const MUSH_B = [...MUSH_TOP, '..K..K..']
const GHOST_TOP = [
  '..wwww..',
  '.wwwwww.',
  'wwKwwKww',
  'wwKwwKww',
  'wwwwwwww',
  'wwwqqwww',
  'wwwwwwww',
]
const GHOST_A = [...GHOST_TOP, 'w.ww.ww.']
const GHOST_B = [...GHOST_TOP, '.ww.ww.w']
// A round purple imp: little horns, big eyes, a grin. Cute, not scary.
const BOSS_TOP = [
  '.B........B.',
  '.BB.PPPP.BB.',
  '..BPPPPPPB..',
  '.PPPPPPPPPP.',
  'PPWKPPPPWKPP',
  'PPKKPPPPKKPP',
  'PPPPPPPPPPPP',
  'PpPPKPPKPPpP',
  '.pPPPKKPPPp.',
]
const BOSS_A = [...BOSS_TOP, '..pp....pp..']
const BOSS_B = [...BOSS_TOP, '...pp..pp...']
const CLOUD = ['..ccc....', '.cCCCcc..', 'CCCCCCCCC']
// Dusk sky, top to bottom, one color per pixel row down to the feet.
const SKY = [0x141433, 0x191a40, 0x1f214c, 0x262a58, 0x2f3465, 0x3a3f73, 0x474b80, 0x55578a, 0x646393, 0x746e9a]

export type Kind = 'slime' | 'bat' | 'mushroom' | 'ghost' | 'boss'
// Two animation frames each, how high it floats, its hit points and its xp.
const KINDS: Record<Kind, { frames: [string[], string[]]; lift: number; hp: number; xp: number }> = {
  slime: { frames: [SLIME_A, SLIME_B], lift: 0, hp: 1, xp: 1 },
  bat: { frames: [BAT_A, BAT_B], lift: 3, hp: 1, xp: 1 },
  mushroom: { frames: [MUSH_A, MUSH_B], lift: 0, hp: 1, xp: 1 },
  ghost: { frames: [GHOST_A, GHOST_B], lift: 0.5, hp: 1, xp: 2 },
  boss: { frames: [BOSS_A, BOSS_B], lift: 0, hp: 3, xp: 5 },
}

// Which monster a tool call is.
export function kindFor(tool: string): Kind {
  if (tool === 'Agent') return 'boss'
  if (tool === 'Read' || tool === 'Grep' || tool === 'Glob') return 'bat'
  if (tool === 'Edit' || tool === 'Write' || tool === 'NotebookEdit') return 'mushroom'
  if (tool === 'WebFetch' || tool === 'WebSearch' || tool.startsWith('mcp__')) return 'ghost'
  return 'slime'
}

export type Save = { kills: number; xp: number; level: number }
// alive: walks up and waits; doomed: its call finished, it charges the hero; dying: the hit animation;
// fleeing: its call failed, it got away.
// cast: ticks left on the spell flying at it, 0 when none.
type Mob = { id: number; x: number; kind: Kind; state: 'alive' | 'doomed' | 'dying' | 'fleeing'; fade: number; hp: number; hurt: number; cast: number }

export const need = (level: number) => level * 5
const widthOf = (kind: Kind) => Math.max(...KINDS[kind].frames[0].map(r => r.length))

const hourNow = () => { const d = new Date(); return d.getHours() + d.getMinutes() / 60 }

// Event actions in the finer mode, by priority.
export type CatState = { state: 'sleep' | 'sit' | 'arch' | 'leap' | 'return' | 'carry' | 'pat' | 'gift'; t: number } // t: how far through it, 0..1
// A click on Clawd or the cat: which little reaction (`n`, taking turns) and how far through it (`t`, 0..1).
export type Poke = { who: 'clawd' | 'cat' | 'castle'; n: number; t: number }
export const POKE_TICKS = 25
// Where Clawd and the cat sit across the picture (shares of its width, fine mode), for the click pad.
export const pokeSpans = (cols: number) => ({ clawd: [(HERO_X * 2) / (cols * 2), (HERO_X * 2 + 21) / (cols * 2)] as const, cat: [(HERO_X * 2 + 22) / (cols * 2), (HERO_X * 2 + 44) / (cols * 2)] as const, castle: [(Math.round(cols * 0.32) - 1.6) / cols, (Math.round(cols * 0.32) + 7.6) / cols] as const }) // the castle: as hires.ts draws it
export type Action = 'stretch' | 'scroll' | 'level' | 'pack' | 'ask'
const ACTION_RANK: Record<Action, number> = { stretch: 0, scroll: 1, level: 2, pack: 3, ask: 4 }
export const ACTION_TICKS = 54 // one pass of 18 frames, a frame every 3 ticks (the desktop redraws at ~3 fps)

export function createGame(save: Save) {
  const mobs: Mob[] = []
  let range = 0 // CAST_RANGE while the wizard draws, 0 for the original knight's sword
  let tick = 0
  let swing = 0
  // An action Clawd is doing for an event: shown until `until` (a tick), or until ended. Higher
  // priority wins: asking you something and packing the memory outrank the rest, and both show
  // even mid-spell; the others wait for the spell to land.
  let action: { name: Action; start: number; until: number } | undefined
  const shownAction = () => {
    if (!action || action.until <= tick) return undefined
    if (swing > 0 && ACTION_RANK[action.name] < ACTION_RANK.pack) return undefined
    return { name: action.name, frame: Math.floor((tick - action.start) / 3) }
  }
  let nextId = 1
  let ward: { from: number; until: number } | undefined // a refused call warded off
  let agents = 0 // subagents running: the black cat is up while any are
  let leapUntil = 0 // a subagent just finished: the cat springs at the foe until this tick
  let gifts = 0 // springs so far: every other one, the cat comes back with a fish instead of a pat
  let queued = 0 // finished subagents the cat has yet to spring for
  let poke: { who: Poke['who']; n: number; from: number } | undefined // the last click on one of them
  const pokes = { clawd: 0, cat: 0, castle: 0 } // clicks so far, so the reactions take turns

  // What the cat does: after a subagent ends, a spring at the foe (15 ticks), the walk back (20; with a fish
  // every other time) and a pat or the fish laid down (30); else up beside Clawd while any run, asleep if none.
  // A monster close by while it is up: it arches its back between them.
  const catNow = (): CatState => {
    const t = tick - (leapUntil - 15)
    const fish = gifts % 2 === 0
    if (leapUntil > 0 && t < 15) return { state: 'leap', t: t / 15 }
    if (leapUntil > 0 && t < 35) return { state: fish ? 'carry' : 'return', t: (t - 15) / 20 }
    if (leapUntil > 0 && t < 65) return { state: fish ? 'gift' : 'pat', t: (t - 35) / 30 }
    if (agents > 0 && mobs.some(m => m.state === 'alive' && m.x < CONTACT + 12)) return { state: 'arch', t: 0 }
    return { state: agents > 0 ? 'sit' : 'sleep', t: 0 }
  }

  return {
    save,
    mobs,
    spawn(kind: Kind, cols: number) {
      const id = nextId++
      const last = mobs.findLast(m => m.state === 'alive')
      const queue = last ? last.x + widthOf(last.kind) + 4 : 0 // line up behind, off screen if need be
      const x = Math.max(CONTACT + 4, cols - widthOf(kind) - 2, queue)
      mobs.push({ id, x, kind, state: 'alive', fade: 0, hp: KINDS[kind].hp, hurt: 0, cast: 0 })
      return id
    },
    // ok: scores the kill now, and the mob dies on screen once it reaches the sword. True on level up.
    // Not ok (the call failed): no xp, the mob runs off.
    kill(id: number, ok = true) {
      const mob = mobs.find(m => m.id === id && m.state === 'alive')
      if (!mob) return false
      if (!ok) { mob.state = 'fleeing'; mob.fade = 25; return false }
      mob.state = 'doomed'
      save.kills += 1
      save.xp += KINDS[mob.kind].xp
      let leveled = false
      while (save.xp >= need(save.level)) {
        save.xp -= need(save.level)
        save.level += 1
        leveled = true
      }
      return leveled
    },
    // The turn ended: a monster still waiting on its call (stopped, or never answered) runs off.
    // Start an action for `ticks` (Infinity until ended), unless a higher one is running.
    perform(name: Action, ticks: number) {
      if (action && action.until > tick && ACTION_RANK[action.name] > ACTION_RANK[name]) return
      action = { name, start: tick, until: tick + ticks }
    },
    // End an action now (its event finished); a little tail lets the last frames play.
    endAction(name: Action, tail = 0) {
      if (action?.name === name) action.until = Math.min(action.until, tick + tail)
    },
    acting() {
      return (action !== undefined && action.until > tick) || (poke !== undefined && tick < poke.from + POKE_TICKS) // a reaction to a click plays smoothly too
    },
    // A subagent starts: the black cat wakes. It finishes: the cat springs, and a success is worth a boss's xp.
    // True on level up.
    agentStart() { agents += 1 },
    agentEnd(ok: boolean) {
      agents = Math.max(0, agents - 1)
      queued += 1 // the cat springs for each, one after another
      return ok ? this.reward(KINDS.boss.xp) : false
    },
    agentsRunning: () => agents,
    // Xp from elsewhere (a finished subagent); true on level up.
    reward(xp: number) {
      save.kills += 1
      save.xp += xp
      let leveled = false
      while (save.xp >= need(save.level)) { save.xp -= need(save.level); save.level += 1; leveled = true }
      return leveled
    },
    // A refused call: the hexagon ward rises before Clawd for `ticks`.
    // A click on Clawd or the cat: a short reaction, a different one each time.
    poke(who: Poke['who']) { poke = { who, n: pokes[who]++ % 3, from: tick } },
    ward(ticks = 20) {
      ward = { from: tick, until: tick + ticks }
    },
    fleeAll() {
      for (const m of mobs) if (m.state === 'alive') { m.state = 'fleeing'; m.fade = 25 }
    },
    // One tick; returns what happened in it, for the sounds: spells leaving the wand (by the foe's kind),
    // blows a monster took and survived (a boss), and the monsters that fell (by id: a level-up waits for one).
    step(): { cast: Kind[]; hit: Kind[]; fell: number[] } {
      const cast: Kind[] = [], hit: Kind[] = [], fell: number[] = []
      tick += 1
      if (swing > 0) swing -= 1
      if (queued > 0 && (leapUntil === 0 || tick >= leapUntil + 50)) { queued -= 1; leapUntil = tick + 15; gifts += 1 } // the last spring, its walk back and its pat or fish done
      let wall = CONTACT
      for (const m of mobs) {
        if (m.hurt > 0) m.hurt -= 1
        if (m.state === 'dying') { m.fade -= 1; continue }
        if (m.state === 'fleeing') { m.fade -= 1; m.x += 3; continue }
        if (m.state === 'doomed') {
          if (m.hurt > 0) continue // stunned for a moment after a hit
          // Charge into range, then wait while the spell flies; it lands when the cast runs out.
          const stop = CONTACT + range
          if (m.x > stop) { m.x = Math.max(stop, m.x - 2); continue }
          if (m.cast === 0) { m.cast = CAST_TICKS; swing = CAST_TICKS; cast.push(m.kind); continue }
          m.cast -= 1
          if (m.cast > 0) continue
          m.hp -= 1
          if (m.hp <= 0) { m.state = 'dying'; m.fade = 8; fell.push(m.id) } else { m.hurt = 5; m.x += 8; hit.push(m.kind) } // knocked back, charges again
          continue
        }
        if (tick % 2 === 0 && m.x > wall) m.x -= 1
        wall = m.x + widthOf(m.kind) + 4 // room enough for the finer sprites, which run a little wider
      }
      for (let i = mobs.length - 1; i >= 0; i--) {
        const m = mobs[i]!
        if ((m.state === 'dying' || m.state === 'fleeing') && m.fade <= 0) mobs.splice(i, 1)
      }
      return { cast, hit, fell }
    },
    // sleeping: no turn running, Clawd naps.
    // extra: more HUD runs laid out after the level and KO on the top row.
    // fine: draw at fine × the grid from shapes (desktop's finer modes); 1 is the hand-drawn sprites.
    // icons: the HUD's labels as pixel icons, for the Svg surfaces; the terminal keeps plain text.
    // hud: the level and usage along the top (the desktop moves them into its status bar); outfit: Clawd's hat and wand.
    scene(cols: number, sleeping = false, extra: readonly { text: string; color: number }[] = [], fine = 1, icons = false, opts: { hud?: boolean; outfit?: Outfit } = {}): Scene {
      // The HUD's first column: past Clawd; the finer modes' Clawd stands lower, so there it may start past the close key.
      const hudFrom = fine > 1 ? 5 : HERO_X + 17
      range = fine > 1 ? CAST_RANGE : 0
      const px = new Int32Array(cols * PX_ROWS)
      const put = (x: number, y: number, c: number) => {
        x = Math.round(x); y = Math.round(y)
        if (x >= 0 && x < cols && y >= 0 && y < PX_ROWS) px[y * cols + x] = c
      }
      const sprite = (rows: string[], x: number, bottom: number, tint?: number) =>
        rows.forEach((row, r) => [...row].forEach((ch, c) => {
          if (ch !== '.') put(x + c, bottom - rows.length + 1 + r, tint ?? PAL[ch] ?? 0xff00ff)
        }))

      const floats: { col: number; row: number; text: string; color?: number }[] = []
      const hiPx = fine > 1
        ? drawHires({
          cols, rows: PX_ROWS + HI_SKY * 2, k: fine, tick, swing, sleeping, hour: hourNow(), action: shownAction(), ward: ward && tick < ward.until ? (tick - ward.from) / (ward.until - ward.from) : undefined, outfit: opts.outfit, cat: catNow(), poke: poke && tick < poke.from + POKE_TICKS ? { who: poke.who, n: poke.n, t: (tick - poke.from) / POKE_TICKS } : undefined, heroX: HERO_X, feet: FEET + HI_SKY * 2, hudFrom, sky: SKY,
          mobs: mobs.map(m => ({ id: m.id, x: m.x, w: widthOf(m.kind), kind: m.kind, state: m.state, fade: m.fade, hp: m.hp, maxHp: KINDS[m.kind].hp, hurt: m.hurt, lift: KINDS[m.kind].lift })),
        })
        : undefined

      // Scenery: sky, stars, clouds, mountains, grass, dirt.
      if (!hiPx) for (let y = 0; y <= FEET; y++) for (let x = 0; x < cols; x++) put(x, y, SKY[y] ?? 0)
      if (!hiPx) for (let x = 0; x < cols; x++) {
        const seed = (x * 7919) % 101
        if (seed < 6 && (tick + seed * 3) % 24 < 20) put(x, seed % 5, seed % 2 ? 0xfff3c4 : 0xc8d4ff)
      }
      if (!hiPx) for (const [speed, y, offset] of [[5, 1, 0], [8, 3, 37]] as const) {
        const span = cols + 12
        sprite(CLOUD, cols - ((Math.floor(tick / speed) + offset) % span), y + 2)
      }
      if (!hiPx) for (let x = 0; x < cols; x++) {
        const far = Math.round(3 + 1.5 * Math.sin(x / 7) + 1 * Math.sin(x / 3.1))
        for (let y = FEET - far; y <= FEET; y++) put(x, y, 0x3a3d6b)
        const near = Math.round(1 + 1 * Math.sin(x / 5 + 2))
        for (let y = FEET - near; y <= FEET; y++) put(x, y, 0x2c5238)
        put(x, FEET + 1, x % 5 === 0 ? 0x4a9a4a : 0x5cb85c)
        put(x, FEET + 2, x % 7 === 3 ? 0x5e3b1f : 0x7a4f2a)
      }

      // Clawd.
      if (swing > 0) {
        if (!hiPx) sprite(HERO_SWING, HERO_X, FEET)
        if (!hiPx && swing >= 3) sprite(SLASH, HERO_X + 21, FEET - 2)
      } else if (sleeping && mobs.length === 0) {
        if (!hiPx) sprite(HERO_SLEEP, HERO_X, FEET)
        const t = Math.floor(tick / 6) % 3
        // The finer mode draws its own z's in the nap frames, and other idle actions take turns there.
        if (!hiPx && t >= 1) floats.push({ col: HERO_X + 12, row: 1, text: 'z', color: 0xc8d4ff })
        if (!hiPx && t >= 2) floats.push({ col: HERO_X + 14, row: 0, text: 'Z', color: 0xc8d4ff })
      } else {
        const blink = tick % 40 < 2
        if (!hiPx) sprite(blink ? HERO_BLINK : tick % 8 < 4 ? HERO_A : HERO_B, HERO_X, FEET)
      }

      // Monsters.
      for (const m of mobs) {
        const k = KINDS[m.kind]
        const w = widthOf(m.kind)
        const frame = k.frames[(tick + m.id) % 6 < 3 ? 0 : 1]
        const bob = m.kind === 'ghost' ? Math.round(Math.sin((tick + m.id) / 3)) : 0
        const bottom = FEET - k.lift + bob
        if (m.state === 'dying') {
          if (!hiPx && m.fade >= 6) sprite(frame, m.x, bottom, 0xffffff)
          const r = (9 - m.fade) * 0.7
          const cx = m.x + w / 2, cy = bottom - 3
          if (!hiPx) for (let a = 0; a < 8; a++) {
            const t = (a * Math.PI) / 4
            put(cx + r * Math.cos(t), cy + r * 0.6 * Math.sin(t), a % 2 ? 0xffe066 : 0xffffff)
          }
          floats.push({ col: m.x + 3, row: m.fade > 4 ? 1 : 0, text: `+${k.xp}` })
          continue
        }
        if (!hiPx) sprite(frame, m.x, bottom, m.hurt > 2 ? 0xffffff : undefined)
        if (m.hurt > 0) floats.push({ col: m.x + 4, row: 1, text: 'HIT!' })
        if (!hiPx && m.kind === 'boss') for (let i = 0; i < k.hp; i++) put(m.x + 4 + i * 3, 0, i < m.hp ? 0xff3b3b : 0x3a2030) // hp pips
      }

      const labels: Label[] = floats.map(f => ({ ...f, row: f.row + (hiPx ? HI_SKY : 0), colors: [...f.text].map(() => f.color ?? 0xffe066) }))

      // The cat asleep breathes its z's.
      if (hiPx && catNow().state === 'sleep' && !(sleeping && mobs.length === 0) && !(poke?.who === 'cat' && tick < poke.from + POKE_TICKS)) { // (and not while a click has it up) // napping, Clawd's own frames have the z's
        const t = Math.floor(tick / 6) % 3
        if (t >= 1) labels.push({ col: 22, row: 2 + HI_SKY, text: 'z', colors: [0xd6dcff] })
        if (t >= 2) labels.push({ col: 23, row: 1 + HI_SKY, text: 'Z', colors: [0xd6dcff] })
      }
      if (opts.hud === false) return hiPx ? { cols, px: hiPx, labels, fine } : { cols, px, labels }
      // HUD: level, an XP bar, kills.
      const BAR = fine > 1 ? 6 : 10
      const filled = Math.floor((save.xp / need(save.level)) * BAR)
      const lv = icons ? `${ICON.star}Lv ${save.level} ` : ` Lv ${save.level} `
      const ko = icons ? ` ${ICON.sword}${save.kills} ` : ` KO ${save.kills} `
      const hud = lv + '█'.repeat(filled) + '░'.repeat(BAR - filled) + ko
      const textWidth = (s: string) => [...s].reduce((n, ch) => n + (wide(ch) ? 2 : 1), 0)
      const gap = fine > 1 ? 2 : 1 // between the kills and the usage
      // The finer modes centre the row between the close key and the four keys at the right (about 14 columns).
      const total = textWidth(hud) + gap + textWidth(extra.map(r => r.text).join('').trimEnd())
      const hudCol = fine > 1 ? Math.max(hudFrom, Math.floor((hudFrom + cols - 14 - total) / 2)) : hudFrom
      labels.push({
        col: hudCol, row: 0, // the top row: clear of Clawd and the monsters' heads
        text: hud,
        colors: [...lv].map(() => 0xffd75f)
          .concat(Array.from({ length: BAR }, (_, k) => (k < filled ? 0x7fd1ff : 0x5a6390)))
          .concat([...ko].map(() => 0xffffff)),
      })
      let col = hudCol + textWidth(hud) + gap
      // Keep stars from twinkling through the HUD: the top row behind it is plain night sky.
      if (!hiPx) for (let x = hudFrom; x < cols; x++) { put(x, 0, SKY[0]!); put(x, 1, SKY[1]!) }
      for (const run of extra) {
        const chars = [...run.text]
        labels.push({ col, row: 0, text: run.text, colors: chars.map(() => run.color) })
        col += chars.reduce((n, ch) => n + (wide(ch) ? 2 : 1), 0)
      }
      return hiPx ? { cols, px: hiPx, labels, fine } : { cols, px, labels }
    },
    frame(cols: number, sleeping = false) {
      return toCells(this.scene(cols, sleeping))
    },
  }
}

export type Label = { col: number; row: number; text: string; colors: number[]; top?: true; dy?: number } // top: drawn over a cover; dy: text pixels lower (Svg only)
// fine: fine pixels per scene pixel (desktop's finer modes); absent is 1.
// stamps: pictures laid on the text layer, at its finer grid (TEXT_PX to a scene pixel): the desktop's buttons.
export type Stamp = { x: number; y: number; w: number; h: number; px: Int32Array; top?: true; under?: true } // under: beneath the words
// cover: the scene column from which a page lies over the picture: the words and stamps under it are cut off there
// (only those marked `top` are drawn over it).
export type Scene = { cols: number; px: Int32Array; labels: Label[]; fine?: number; stamps?: Stamp[]; cover?: number }
// A run of text, or a pixel gauge `width` cells wide filled to `percent` in `color`.
export type Seg = { text: string; color: number } | { gauge: number; width: number; color: number }

// Columns a character takes: CJK, full-width forms and emoji take two.
export const wide = (ch: string) => {
  const c = ch.codePointAt(0) ?? 0
  return c >= 0x2e80 || (c >= 0x2600 && c <= 0x27bf)
}
const esc = (ch: string) => (ch === '<' ? '&lt;' : ch === '>' ? '&gt;' : ch === '&' ? '&amp;' : ch)

const WIN = { border: 0xe8ecff, fill: [0x2b3a8f, 0x24317d, 0x1e296c, 0x19225c, 0x141c4e, 0x101742], ground: [0x5e3b1f, 0x4a2e18] }
const GAUGE_EMPTY: [number, number] = [0x3b4278, 0x2a2f5c]
const shade = (c: number) => (((c >> 16) & 255) * 0.62) << 16 | (((c >> 8) & 255) * 0.62) << 8 | (c & 255) * 0.62

// An RPG message window standing on the ground under the scene: a white rounded border, a
// navy fill fading down, one text row per line. Its top edge overlays the scene's last pixel row.
export function withStrip(scene: Scene, lines: Seg[][]): Scene {
  const { cols } = scene
  const k = scene.fine ?? 1
  const sceneRows = scene.px.length / (cols * k * k) / 2
  const pxRows = sceneRows * 2 + lines.length * 2 + 2
  const W = cols * k
  const px = new Int32Array(W * pxRows * k)
  px.set(scene.px)
  // Drawn on the coarse grid, each pixel filling a k × k block.
  const put = (x: number, y: number, c: number) => {
    if (x < 0 || x >= cols || y < 0 || y >= pxRows) return
    for (let dy = 0; dy < k; dy++) px.fill(c, (y * k + dy) * W + x * k, (y * k + dy) * W + x * k + k)
  }

  const top = sceneRows * 2 - 1 // the border row
  const bottom = pxRows - 2
  for (let y = top + 1; y < pxRows; y++) for (let x = 0; x < cols; x++) put(x, y, WIN.ground[(x + y) % 7 === 0 ? 1 : 0]!)
  const x0 = 1, x1 = cols - 2
  for (let y = top; y <= bottom; y++) {
    const fill = WIN.fill[Math.min(WIN.fill.length - 1, Math.floor(((y - top) / (bottom - top)) * WIN.fill.length))]!
    for (let x = x0; x <= x1; x++) {
      const edgeY = y === top || y === bottom, edgeX = x === x0 || x === x1
      if (edgeY && edgeX) continue // rounded corner
      put(x, y, edgeY || edgeX ? WIN.border : fill)
    }
  }

  const labels = [...scene.labels]
  lines.forEach((segs, r) => {
    const row = sceneRows + r
    let col = 3 // one cell in from the frame, so a leading emoji clears it
    for (const seg of segs) {
      if ('gauge' in seg) {
        // An HP bar: lit top, shaded bottom, over a dark track.
        const filled = Math.round((Math.min(Math.max(seg.gauge, 0), 100) / 100) * seg.width)
        for (let k = 0; k < seg.width; k++) {
          const [hi, lo] = k < filled ? [seg.color, shade(seg.color)] : GAUGE_EMPTY
          put(col + k, row * 2, hi)
          put(col + k, row * 2 + 1, lo)
        }
        col += seg.width
        continue
      }
      const chars = [...seg.text]
      labels.push({ col, row, text: seg.text, colors: chars.map(() => seg.color) })
      col += chars.reduce((n, ch) => n + (wide(ch) ? 2 : 1), 0)
    }
  })
  if (k >= 2) dialogFrame(px, W, k, sceneRows * 2, pxRows)
  return { cols, px, labels, fine: scene.fine }
}

// Desktop's finer modes: redraw the window as an RPG dialog box on the fine grid, over the
// coarse one: a rounded double frame, a navy fill fading down, and a blinking ▼ at its corner.
function dialogFrame(px: Int32Array, W: number, k: number, topRow: number, pxRows: number) {
  const H = pxRows * k
  const y0 = (topRow - 1) * k, y1 = H - k - 1, x0 = k, x1 = W - k - 1
  const set = (X: number, Y: number, c: number) => { if (X >= 0 && X < W && Y >= 0 && Y < H) px[Y * W + X] = c }
  const r = k + 1 // corner radius
  for (let Y = y0; Y <= y1; Y++) for (let X = x0; X <= x1; X++) {
    const dx = Math.max(x0 + r - X, X - (x1 - r), 0), dy = Math.max(y0 + r - Y, Y - (y1 - r), 0)
    const out = Math.hypot(dx, dy) - r // >0 outside the rounded box
    if (out > 0.5) continue
    const t = (Y - y0) / (y1 - y0)
    const fill = t < 0.5 ? 0x24307a : 0x1b2462
    // A one-row window is only a few fine pixels tall: a thin frame leaves the text its room.
    if (out > -1) set(X, Y, 0xffffff) // white frame
    else if (out > -2) set(X, Y, 0x5a68b0) // bevel
    else set(X, Y, fill)
  }
  // The ▼ prompt, blinking with the second.
  if (Math.floor(Date.now() / 600) % 2 === 0) {
    const cx = x1 - 3 * k, cy = y1 - 2 * k
    for (let i = 0; i <= k; i++) for (let j = -(k - i); j <= k - i; j++) set(cx + j, cy - Math.ceil(k / 2) + i, 0xffffff)
  }
}
const hex = (c: number) => '#' + c.toString(16).padStart(6, '0')

// Terminal: '▀' cells, the top pixel as foreground and the bottom as background; labels overwrite glyphs.
export function toCells({ cols, px, labels }: Scene) {
  const rows = px.length / cols / 2
  const words = new Uint32Array(cols * rows * 3)
  for (let r = 0; r < rows; r++) for (let x = 0; x < cols; x++) {
    const i = (r * cols + x) * 3
    words[i] = 0x2580
    words[i + 1] = px[2 * r * cols + x] ?? 0
    words[i + 2] = px[(2 * r + 1) * cols + x] ?? 0
  }
  for (const l of labels) {
    let col = l.col
    ;[...l.text].forEach((ch, k) => {
      const w = wide(ch) ? 2 : 1
      if (col >= 0 && col + w <= cols && l.row < rows) {
        for (let j = 0; j < w; j++) {
          const i = (l.row * cols + col + j) * 3
          words[i] = w === 1 ? (ch.codePointAt(0) ?? 0x20) : 0x20 // a cell holds one narrow glyph: wide ones are left blank
          words[i + 1] = l.colors[k] ?? 0xffffff
        }
      }
      col += w
    })
  }
  const bytes = new Uint8Array(words.buffer)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin)
}

// Desktop: one rect per run of same-colored pixels; a cell is 1 pixel wide and 2 tall, as in the terminal.
// t: the clock, in milliseconds, that picks each icon's frame.
export function toSvg({ cols, px, labels, fine = 1, stamps = [], cover = Infinity }: Scene, scale = 8, t = 0) {
  const W = cols * fine
  const pxRows = px.length / (cols * fine * fine) // in scene pixels
  const parts: string[] = []
  // Runs of same-colored pixels, one path per color (a rect each would be ~3x the text), in fine
  // units under a 1/fine scale. The Svg element takes at most 131072 characters.
  const byColor = new Map<number, string[]>()
  if (fine < 2) for (let y = 0; y < pxRows * fine; y++) {
    let x = 0
    while (x < W) {
      const c = px[y * W + x] ?? 0
      let run = 1
      while (x + run < W && px[y * W + x + run] === c) run++
      let d = byColor.get(c)
      if (!d) byColor.set(c, (d = []))
      d.push(`M${x} ${y}h${run}v1h-${run}z`)
      x += run
    }
  }
  const paths = [...byColor].map(([c, d]) => `<path fill="${hex(c)}" d="${d.join('')}"/>`).join('')
  if (fine >= 2) {
    // Too many runs for paths at the finer detail: one embedded palette PNG, scaled up with hard edges.
    const png = encodePng(px, W, pxRows * fine)
    parts.push(`<image width="${cols}" height="${pxRows}" preserveAspectRatio="none" style="image-rendering:pixelated" href="data:image/png;base64,${png}"/>`)
  } else parts.push(fine === 1 ? paths : `<g transform="scale(${1 / fine})">${paths}</g>`)
  // Text: pixel-font glyphs on a layer of their own, TEXT_PX font pixels to a scene pixel, laid over the
  // scene as one see-through image; a character the font lacks (an emoji) stays an SVG <text>.
  const TW = cols * TEXT_PX
  const textPx = new Int32Array(TW * pxRows * TEXT_PX).fill(CLEAR)
  let drawn = false
  const stamp = (st: Stamp) => {
    for (let y = 0; y < st.h; y++) for (let x = 0; x < st.w; x++) {
      const c = st.px[y * st.w + x]!, X = st.x + x, Y = st.y + y
      if (c !== CLEAR && X >= 0 && X < TW && (st.top || X < coverX) && Y >= 0 && Y < pxRows * TEXT_PX) textPx[Y * TW + X] = c
    }
    drawn = true
  }
  const coverX = cover * TEXT_PX
  for (const st of stamps) if (st.under) stamp(st) // a page, its words drawn over it
  for (const l of labels) {
    let x = l.col
    const edge = l.top ? Infinity : coverX // the words under a cover stop at its edge
    ;[...l.text].forEach((ch, k) => {
      const w = wide(ch) ? 2 : 1
      const color = l.colors[k] ?? 0xffffff
      const g = ch === ' ' || ch === '█' || ch === '░' ? undefined : glyph(ch, t)
      if ((x + w) * TEXT_PX > edge && !g) { x += w; return }
      if (ch === '█' || ch === '░') {
        parts.push(`<rect x="${x + 0.1}" y="${l.row * 2 + 0.5 + (l.dy ?? 0) / TEXT_PX}" width="0.8" height="1" fill="${hex(color)}"/>`)
      } else if (g) {
        // Centred in its cells; a row is 2 scene pixels, so the 12-pixel glyph leaves a pixel above and below.
        const left = x * TEXT_PX + Math.floor((w * TEXT_PX - g.w) / 2)
        const top = l.row * 2 * TEXT_PX + (l.dy ?? 0) + Math.floor((2 * TEXT_PX - GLYPH_H) / 2)
        g.rows.forEach((bits, r) => {
          for (let c = 0; c < g.w; c++) if (bits & (1 << (g.w - 1 - c))) {
            const px2 = left + c, py = top + r
            if (px2 >= 0 && px2 < TW && px2 < edge && py >= 0 && py < pxRows * TEXT_PX) textPx[py * TW + px2] = g.paint?.[r]?.[c] ?? color
          }
        })
        drawn = true
      } else if (ch !== ' ') {
        parts.push(`<text x="${x + w / 2}" y="${l.row * 2 + 1.6 + (l.dy ?? 0) / TEXT_PX}" fill="${hex(color)}">${esc(ch)}</text>`)
      }
      x += w
    })
  }
  for (const st of stamps) if (!st.under) stamp(st)
  if (drawn) {
    const png = encodePng(textPx, TW, pxRows * TEXT_PX, textCache, CLEAR)
    parts.push(`<image width="${cols}" height="${pxRows}" preserveAspectRatio="none" style="image-rendering:pixelated" href="data:image/png;base64,${png}"/>`)
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${cols} ${pxRows}" width="${cols * scale}" height="${pxRows * scale}" shape-rendering="crispEdges"><g font-family="monospace" font-size="1.6" font-weight="bold" text-anchor="middle">${parts.join('')}</g></svg>`
}

// The desktop's status bar: one line across the foot of the picture, under the message window, on a dark
// strip one text row high. Its runs: text, a bar of cells, or a thin line between groups. Every pixel it
// paints is checked to land on the bar's face; what would not fit is left off, never drawn over the rim.
export type StatusSeg = { text: string; color: number; id?: string } | { cells: number; fill: number; color: number } | { sep: true } | { art: string[]; palette: Record<string, number> }
const SB = { rim: 0x0c0e18, bevel: 0x8a93b8, faceA: 0x2a3048, faceB: 0x20253a, empty: 0x0c0e18, strip: 0x0c0e18 }
export const statusCells = (segs: readonly StatusSeg[]) =>
  segs.reduce((n, sg) => n + ('sep' in sg ? 2 : 'cells' in sg ? sg.cells : 'art' in sg ? 2 : textCells(sg.text)), 0)
const textCells = (s: string) => [...s].reduce((m, ch) => m + (wide(ch) ? 2 : 1), 0)
// `hits`, if given, gets where each text with an `id` sits, as shares of the picture's width (the bar is the last text row).
export function withStatusBar(scene: Scene, segs: readonly StatusSeg[], t = 0, hits?: { id: string; from: number; to: number }[]): Scene {
  const k = scene.fine ?? 1, W = scene.cols * k, rows = scene.px.length / W
  const px = new Int32Array(scene.px.length + W * 2 * k) // one text row: two scene pixels
  px.set(scene.px)
  px.fill(SB.strip, scene.px.length)
  const TW = scene.cols * TEXT_PX, h = 20, w = TW - 4
  const y = (rows / k) * TEXT_PX - TEXT_PX // from just under the window's lower rim (its last scene pixel) to the foot
  const bar = new Int32Array(w * h).fill(CLEAR), face = new Uint8Array(w * h)
  for (let yy = 0; yy < h; yy++) for (let X = 0; X < w; X++) {
    const r = 2, dx = Math.max(r - X, X - (w - 1 - r), 0), dy = Math.max(r - yy, yy - (h - 1 - r), 0)
    const o = dx > 0 && dy > 0 ? Math.hypot(dx, dy) - r : -Math.min(X, w - 1 - X, yy, h - 1 - yy) // inside the edge by
    if (o > 0.5) continue
    const c = o > -0.5 ? SB.rim : o > -1.5 ? SB.bevel : yy < h / 2 ? SB.faceA : SB.faceB
    bar[yy * w + X] = c
    if (c === SB.faceA || c === SB.faceB) face[yy * w + X] = 1
  }
  const paint = (X: number, Y: number, c: number) => { if (X >= 0 && X < w && Y >= 0 && Y < h && face[Y * w + X]) bar[Y * w + X] = c }
  // The dividers share out whatever room the bar has left, so the bar is filled end to end (its parts have fixed
  // widths, so they stay put as numbers change).
  const SEP_PX = 11
  const ART_PX = 2 * TEXT_PX + 4 // a picture's cell: its 12 pixels, a pixel before, a little room after
  const natural = segs.reduce((n, sg) => n + ('sep' in sg ? SEP_PX : 'art' in sg ? ART_PX : 'cells' in sg ? sg.cells * TEXT_PX : [...sg.text].reduce((a, ch) => a + (wide(ch) ? 2 : 1) * TEXT_PX, 0)), 0)
  const seps = segs.filter(sg => 'sep' in sg).length
  const spare = Math.max(0, w - 16 - natural)
  let cx = 8, gaps = 0
  const y0 = 4
  for (const sg of segs) {
    if ('sep' in sg) { // a thin divider, in the middle of its share of the room
      const span = SEP_PX + Math.floor((spare * (gaps + 1)) / seps) - Math.floor((spare * gaps) / seps)
      gaps++
      for (let yy = y0 + 1; yy < y0 + 12; yy++) paint(cx + Math.floor(span / 2), yy, SB.bevel)
      cx += span
      continue
    }
    if ('art' in sg) { // a 12-pixel picture in a wide cell: the black cat's face
      sg.art.forEach((line, r) => [...line].forEach((ch, c) => { const col = sg.palette[ch]; if (col !== undefined) paint(cx + 1 + c, y0 + r, col) }))
      cx += ART_PX
      continue
    }
    if ('cells' in sg) {
      for (let c = 0; c < sg.cells; c++) for (let yy = y0 + 2; yy < y0 + 10; yy++) for (let X = 1; X < 6; X++) paint(cx + c * TEXT_PX + X, yy, c < sg.fill ? sg.color : SB.empty)
      cx += sg.cells * TEXT_PX
      continue
    }
    const from = cx
    for (const ch of sg.text) {
      const cw = (wide(ch) ? 2 : 1) * TEXT_PX, g = ch === ' ' ? undefined : glyph(ch, t)
      if (g) {
        const gx = cx + Math.floor((cw - g.w) / 2)
        g.rows.forEach((bits, r) => { for (let c = 0; c < g.w; c++) if (bits & (1 << (g.w - 1 - c))) paint(gx + c, y0 + r, g.paint?.[r]?.[c] ?? sg.color) })
      }
      cx += cw
    }
    if (sg.id) hits?.push({ id: sg.id, from: (2 + from) / TW, to: (2 + cx) / TW })
  }
  return { ...scene, px, stamps: [...(scene.stamps ?? []), { x: 2, y, w, h, px: bar }] }
}

// Pixel buttons in the picture's top corners, on the text layer's finer grid: keys in the message window's
// own style (a white rim, a blue bevel, the deep blue fill) around an icon at its own size. The picture
// cannot be pressed, so the desktop lays a see-through link over each; this returns where each sits, in columns.
export const BUTTON_PX = 24 // a key's side, in text-layer pixels: the 12-pixel icon, 2 clear all round, inside the rim and bevel
const KEY_MARGIN = 2, KEY_GAP = 3
// A chunky box on a grid of squares, `w` × `h` of them: corners stepped in `round` squares (1: nearly square), a white
// rim one square thick, a blue bevel inside it, deep blue below. Drawn by `put(x, y, color)` per square.
export const KEY_COLORS = { rim: 0xffffff, bevel: 0x5a68b0, top: 0x24307a, foot: 0x1b2462 }
export function pixelBox(w: number, h: number, put: (x: number, y: number, c: number) => void, round = 2): void {
  const cut = (y: number) => (y === 0 || y === h - 1 ? round : (y === 1 || y === h - 2) && round > 1 ? 1 : 0)
  const inside = (x: number, y: number) => y >= 0 && y < h && x >= cut(y) && x < w - cut(y)
  const edge = (x: number, y: number, test: (x: number, y: number) => boolean) => {
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (test(x + dx, y + dy)) return true
    return false
  }
  const rim = (x: number, y: number) => inside(x, y) && edge(x, y, (a, b) => !inside(a, b))
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!inside(x, y)) continue
    put(x, y, rim(x, y) ? KEY_COLORS.rim : edge(x, y, rim) ? KEY_COLORS.bevel : y < h / 2 ? KEY_COLORS.top : KEY_COLORS.foot)
  }
}

export function withButtons(scene: Scene, icons: readonly IconName[], side: 'left' | 'right'): { col: number; w: number }[] {
  const TW = scene.cols * TEXT_PX
  const B = BUTTON_PX
  return icons.map((icon, i) => {
    const x = side === 'left' ? KEY_MARGIN + i * (B + KEY_GAP) : TW - KEY_MARGIN - (icons.length - i) * (B + KEY_GAP) + KEY_GAP
    const px = new Int32Array(B * B).fill(CLEAR)
    pixelBox(B / 2, B / 2, (X, Y, c) => { for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) px[(Y * 2 + a) * B + X * 2 + b] = c }, 1)
    const g = glyph(ICON[icon], 0)!
    const left = Math.floor((B - g.w) / 2), top = Math.floor((B - GLYPH_H) / 2)
    g.rows.forEach((bits, gy) => {
      for (let gx = 0; gx < g.w; gx++) if (bits & (1 << (g.w - 1 - gx))) px[(top + gy) * B + left + gx] = g.paint?.[gy]?.[gx] ?? 0xffffff
    })
    ;(scene.stamps ??= []).push({ x, y: KEY_MARGIN, w: B, h: B, px, top: true }) // the keys stay over a page
    return { col: x / TEXT_PX, w: B / TEXT_PX }
  })
}
