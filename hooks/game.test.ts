import { expect, test } from 'claude-code/testing'

import { glyph } from './font'
import { ICON, iconGlyph } from './icons'
import { wrapRows } from './hud'
import { createGame, kindFor, ROWS, toCells, toSvg, withStrip } from './game'

test('a kill gives xp and levels up at 5 xp', async () => {
  const game = createGame({ kills: 0, xp: 0, level: 1 })
  let leveled = false
  for (let i = 0; i < 5; i++) leveled = game.kill(game.spawn('slime', 40))
  expect(leveled).toBe(true)
  expect(game.save).toEqual({ kills: 5, xp: 0, level: 2 })
  expect(game.kill(999)).toBe(false)
})

test('a monster falls only once the blow lands, not when its call succeeds', async () => {
  const game = createGame({ kills: 0, xp: 0, level: 1 })
  const id = game.spawn('boss', 40)
  game.kill(id)
  expect(game.step().fell).toEqual([]) // still charging in
  let at = 0, casts = 0, hits = 0
  for (let i = 1; i < 100 && !at; i++) {
    const ev = game.step()
    casts += ev.cast.length
    hits += ev.hit.length
    if (ev.fell.includes(id)) at = i
  }
  expect(at).toBeGreaterThan(5)
  expect(hits).toBe(2) // a boss takes three blows: two it survives, the third fells it
  expect(casts).toBe(3)
})

test('a boss gives 5 xp and charges the hero before it fades out', async () => {
  const game = createGame({ kills: 0, xp: 0, level: 1 })
  game.kill(game.spawn('boss', 40))
  expect(game.save.level).toBe(2)
  game.step()
  expect(game.mobs.length).toBe(1) // still on screen, charging
  for (let i = 0; i < 100; i++) game.step()
  expect(game.mobs.length).toBe(0)
})

test('frame encodes cols * rows cells', async () => {
  const game = createGame({ kills: 0, xp: 0, level: 1 })
  game.spawn('boss', 80)
  expect(atob(game.frame(80)).length).toBe(80 * ROWS * 3 * 4)
})

test('a boss takes three hits before it dies', async () => {
  const game = createGame({ kills: 0, xp: 0, level: 1 })
  game.kill(game.spawn('boss', 80))
  const hits: number[] = []
  for (let i = 0; i < 200 && game.mobs.length; i++) {
    game.step()
    const hp = game.mobs[0]?.hp
    if (hp !== undefined && hp !== hits.at(-1)) hits.push(hp)
  }
  expect(hits).toEqual([3, 2, 1, 0])
  expect(game.mobs.length).toBe(0)
})

test('the desktop svg fits the element limit', async () => {
  const game = createGame({ kills: 12, xp: 3, level: 4 })
  game.spawn('boss', 80); game.spawn('slime', 80)
  const svg = toSvg(game.scene(80))
  expect(svg.startsWith('<svg')).toBe(true)
  expect(svg.length < 131072).toBe(true)
})

test('each kind of tool call gets its own monster', async () => {
  expect([kindFor('Bash'), kindFor('Read'), kindFor('Edit'), kindFor('WebSearch'), kindFor('mcp__x__y'), kindFor('Agent')])
    .toEqual(['slime', 'bat', 'mushroom', 'ghost', 'ghost', 'boss'])
})

test('a failed call scores nothing and its monster runs off', async () => {
  const game = createGame({ kills: 0, xp: 0, level: 1 })
  game.kill(game.spawn('bat', 80), false)
  expect(game.save).toEqual({ kills: 0, xp: 0, level: 1 })
  for (let i = 0; i < 30; i++) game.step()
  expect(game.mobs.length).toBe(0)
})

test('an info strip adds rows under the scene in both encoders', async () => {
  const game = createGame({ kills: 0, xp: 0, level: 1 })
  const scene = withStrip(game.scene(60), [[{ text: '本月 $10.11', color: 0xffffff }, { gauge: 50, width: 8, color: 0x5fd787 }], [{ text: 'x', color: 0xffffff }]])
  expect(scene.px.length).toBe(60 * (ROWS + 3) * 2) // two text rows and a border row
  expect(atob(toCells(scene)).length).toBe(60 * (ROWS + 3) * 3 * 4)
  expect(toSvg(scene).includes('>本<')).toBe(false) // drawn in the pixel font, on the text layer
})

test('the finer desktop mode draws more pixels and stays under the Svg limit', async () => {
  for (const fine of [2]) {
    const game = createGame({ kills: 3, xp: 1, level: 2 })
    game.spawn('slime', 100); game.spawn('bat', 100); game.spawn('ghost', 100); game.spawn('boss', 100); game.spawn('mushroom', 100)
    for (let i = 0; i < 30; i++) game.step()
    const scene = withStrip(game.scene(100, false, [], fine), [[{ text: '📅 Side Project｜整理資料', color: 0xffffff }]])
    expect(scene.px.length).toBe(100 * fine * (ROWS + 2 + 2) * 2 * fine) // two strip rows, two extra sky rows
    const svg = toSvg(scene, 12)
    expect(svg.length < 131072).toBe(true)
    expect(svg.includes(`viewBox="0 0 100 ${(ROWS + 4) * 2}"`)).toBe(true) // no empty band under the drawing
  }
})

test('the wizard casts from range: the boss still takes three hits, then fades', async () => {
  const game = createGame({ kills: 0, xp: 0, level: 1 })
  game.kill(game.spawn('boss', 80))
  const hits: number[] = []
  for (let i = 0; i < 400 && game.mobs.length; i++) {
    game.scene(80, false, [], 2) // drawing in the finer mode sets the cast range
    game.step()
    const hp = game.mobs[0]?.hp
    if (hp !== undefined && hp !== hits.at(-1)) hits.push(hp)
  }
  expect(hits).toEqual([3, 2, 1, 0])
  expect(game.mobs.length).toBe(0)
})

test('monsters left waiting when a turn is stopped run off', async () => {
  const game = createGame({ kills: 0, xp: 0, level: 1 })
  game.spawn('ghost', 80); game.spawn('slime', 80)
  game.fleeAll()
  for (let i = 0; i < 30; i++) game.step()
  expect(game.mobs.length).toBe(0)
  expect(game.save.kills).toBe(0)
})

test('event actions: priority, a timed run, and ending one', async () => {
  const game = createGame({ kills: 0, xp: 0, level: 1 })
  game.perform('scroll', 10)
  expect(game.acting()).toBe(true)
  game.perform('stretch', 10) // lower: ignored while scroll runs
  game.perform('ask', Infinity) // higher: takes over
  for (let i = 0; i < 30; i++) game.step()
  expect(game.acting()).toBe(true) // ask lasts until ended
  game.endAction('ask')
  game.step()
  expect(game.acting()).toBe(false)
  game.perform('level', 5)
  for (let i = 0; i < 6; i++) game.step()
  expect(game.acting()).toBe(false)
})

test('text is drawn in the pixel font, emoji left as text', async () => {
  expect(glyph('冒')?.w).toBe(12)
  expect(glyph('A')?.w).toBe(6)
  expect(glyph('冒')!.rows.some(r => r !== 0)).toBe(true)
  expect(glyph('🧙')).toBe(undefined)
  const game = createGame({ kills: 3, xp: 1, level: 2 })
  const svg = toSvg(withStrip(game.scene(100, false, [], 2), [[{ text: '🧙 冒險開始', color: 0xffffff }]]), 12)
  expect(svg.includes('>冒<')).toBe(false) // the glyph is pixels now
  expect(svg.includes('>🧙<')).toBe(true)
  expect((svg.match(/<image /g) ?? []).length).toBe(2) // the scene, then the text layer over it
})

test('a long line grows the window and still fits the Svg limit', async () => {
  const game = createGame({ kills: 3, xp: 1, level: 2 })
  game.spawn('boss', 120); game.spawn('slime', 120); game.spawn('bat', 120)
  for (let i = 0; i < 30; i++) game.step()
  const long = '🧙 ' + '書記官把這一回合的進度整理成一句比較長的話，讓你切回這個對話時不用往上捲就知道目前做到哪裡、下一步要做什麼。'.repeat(3)
  const rows = wrapRows([[{ text: long, color: 0xffffff }]], 120 - 6, 4)
  expect(rows.length).toBe(3) // wrapped, the window three rows tall
  expect(wrapRows([[{ text: long.repeat(3), color: 0xffffff }]], 114, 4).length).toBe(4) // and no taller
  const top = [{ text: 'Lv 2 ██████░░░░ KO 3   5H █░░░░ 17% ~02:00  7D ██░░░ 49%', color: 0xffd75f }]
  const svg = toSvg(withStrip(game.scene(120, false, top, 2), rows), 12)
  expect(svg.length < 131072).toBe(true)
})

test('the info row icons are colored pixel glyphs, two cells wide', async () => {
  for (const ch of Object.values(ICON)) {
    const g = glyph(ch)!
    expect(g.w).toBe(12)
    expect(g.paint!.length).toBe(12)
    expect(g.paint!.every(r => r.length === 12)).toBe(true)
  }
  const game = createGame({ kills: 3, xp: 1, level: 2 })
  const svg = toSvg(withStrip(game.scene(100, false, [], 2), [[{ text: `${ICON.quill} 冒險開始`, color: 0xffffff }]]), 12)
  expect(svg.includes('<text')).toBe(false) // nothing left to the system font
})

test('the HUD row wears icons on the Svg surfaces, plain text on the terminal', async () => {
  const game = createGame({ kills: 7, xp: 1, level: 3 })
  const hud = (icons: boolean) => game.scene(100, false, [], 2, icons).labels.find(l => l.row === 0 && l.text.includes('3'))!.text
  expect(hud(false).includes('KO 7')).toBe(true)
  expect(hud(true).includes(`${ICON.sword}7`)).toBe(true)
  expect(hud(true).startsWith(ICON.star)).toBe(true)
})

test('icons move: the clock picks the frame, and the cycle repeats', async () => {
  const heart = ICON.heart.codePointAt(0)!
  const at = (t: number) => JSON.stringify(iconGlyph(heart, t)!.rows)
  expect(at(0)).not.toBe(at(550)) // 500 ms resting, then the beat
  expect(at(0)).toBe(at(1530)) // one full cycle later
  for (const ch of Object.values(ICON)) expect(iconGlyph(ch.codePointAt(0)!, 123456)!.rows.length).toBe(12)
  const game = createGame({ kills: 3, xp: 1, level: 2 })
  const scene = withStrip(game.scene(100, false, [], 2, true), [[{ text: `${ICON.hourglass} 書記官正在記錄`, color: 0xffffff }]])
  expect(toSvg(scene, 12, 0)).not.toBe(toSvg(scene, 12, 400)) // the sand has moved
})

test('the "!" bubble bobs while Clawd waits on you', async () => {
  const game = createGame({ kills: 1, xp: 0, level: 1 })
  game.perform('ask', Infinity)
  // the bubble's "!" red, its highest row in Clawd's columns, tick by tick
  const top = () => {
    const s = game.scene(60, true, [], 2, true), W = 120
    for (let y = 0; y < s.px.length / W; y++) for (let x = 0; x < 40; x++) if (s.px[y * W + x] === 0xe8364a) return y
    return -1
  }
  const seen = new Set<number>()
  for (let t = 0; t < 30; t++) { seen.add(top()); game.step() }
  expect(seen.size).toBe(2) // two heights: resting and bobbed up
  expect(seen.has(-1)).toBe(false) // and always on screen
})

test('a subagent wakes the black cat; a finished one counts as a boss', async () => {
  const game = createGame({ kills: 0, xp: 0, level: 1 })
  game.agentStart(); game.agentStart()
  expect(game.agentsRunning()).toBe(2)
  expect(game.mobs.length).toBe(0) // no monster comes for a subagent
  expect(game.agentEnd(true)).toBe(true) // a boss's 5 xp: level 2
  expect(game.save).toEqual({ kills: 1, xp: 0, level: 2 })
  expect(game.agentEnd(false)).toBe(false) // a failed one counts for nothing
  expect(game.agentsRunning()).toBe(0)
})
