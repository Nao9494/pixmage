import { expect, test } from 'claude-code/testing'

import { ICON } from './icons'
import { bar, duration, scribeIcon, toolIcon, wrapRows, scribeLine, scribePrompt, scribeText, infoLines, statusSegs, levelColor, parseKeyInfo, parseToday, resetLabel, workLogLine } from './hud'

test('bars fill by percent and clamp', async () => {
  expect(bar(50, 10)).toEqual({ filled: '█████', empty: '░░░░░' })
  expect(bar(130, 4).filled).toBe('████')
})

test('colors turn yellow past 80 and red past 95', async () => {
  expect([levelColor(10), levelColor(85), levelColor(99)]).toEqual(['#5fd787', '#ffd75f', '#ff5f5f'])
})

test('reset time shows the date only when not today', async () => {
  const now = new Date(2026, 9, 5, 10, 0)
  expect(resetLabel(new Date(2026, 9, 5, 14, 0).toISOString(), now)).toBe('14:00')
  expect(resetLabel(new Date(2026, 9, 8, 9, 5).toISOString(), now)).toBe('10/8 09:05')
  expect(resetLabel(new Date(2026, 9, 5, 14, 0).toISOString(), now, { h12: true })).toBe('\uE0F12:00') // PM lit
  expect(resetLabel(new Date(2026, 9, 5, 9, 5).toISOString(), now, { h12: true })).toBe('\uE0F09:05') // AM lit
  expect(resetLabel(new Date(now.getTime() + 133 * 60_000).toISOString(), now, { countdown: true })).toBe('2h13m')
})

test('durations and work-log states', async () => {
  expect([duration(5 * 60000), duration(72 * 60000)]).toEqual(['5m', '1h12m'])
  expect(workLogLine({ skip: true }).text).toBe(`${ICON.no} 本對話不記錄`)
  expect(workLogLine({ calendar: '📈 Side Project', title: '資料治理 ✅', start: '2026-10-14T11:12' }).text).toBe(`${ICON.calendar} Side Project｜資料治理（11:12 起）`)
  expect(workLogLine(null).text).toBe(`${ICON.memo} 本對話未記錄`)
  expect(workLogLine({ calendar: 'Garden', title: '種番茄', start: '2026-10-05T10:05' }).text).toBe(`${ICON.calendar} Garden｜種番茄（10:05 起）`)
})

test('reads the LiteLLM key budget and today spend', async () => {
  expect(parseKeyInfo('{"info":{"spend":9.41,"max_budget":100,"budget_reset_at":"2026-11-01T00:00:00+00:00"}}'))
    .toEqual({ spend: 9.41, max: 100, resetsAt: '2026-11-01T00:00:00+00:00' })
  expect(parseKeyInfo('{"error":"nope"}')).toBe(null)
  expect(parseToday('{"metadata":{"total_spend":7.93}}')).toBe(7.93)
  expect(parseToday('not json')).toBe(undefined)
})

test('each surface shows only what it lacks', async () => {
  const now = new Date(2026, 9, 5, 13, 0)
  const info = { ctx: 28, limits: [], budget: { spend: 10.11, max: 100, today: 8.43 }, workLog: { skip: true } }
  const text = (row: readonly ({ text: string } | object)[]) => row.map(s => ('text' in s ? s.text : '')).join('')
  const term = infoLines(info, now, false)
  expect(term.length).toBe(1)
  expect(text(term[0]!)).toContain('CTX')
  expect(text(term[0]!)).toContain('$89.89 left')
  const desk = infoLines(info, now, true)
  expect(desk.length).toBe(1)
  expect(text(desk[0]!)).toBe(`${ICON.no} 本對話不記錄`)
})

test('the status bar: level, 5h with its reset, 7d, ctx, the subagents by the cat, the hourglass; nothing missing leaves a gap', async () => {
  const now = new Date(2026, 9, 6, 10, 0)
  const limits = [{ kind: 'five_hour', percentUsed: 11, resetsAt: new Date(2026, 9, 6, 15, 0).toISOString() }, { kind: 'seven_day', percentUsed: 97, resetsAt: new Date(2026, 9, 11, 6, 0).toISOString() }]
  const text = (segs: ReturnType<typeof statusSegs>) => segs.map(s => ('text' in s ? s.text : 'cells' in s ? `[${s.fill}/${s.cells}]` : 'art' in s ? '🐈' : '|')).join('')
  const segs = statusSegs({ limits, budget: null, ctx: 72 }, { level: 24, xp: 40 }, 80, now, 2, 151_000)
  expect(text(segs)).toBe(`Lv24[2/4]|${ICON.heart}5H [1/5] 11% ~15:00|${ICON.potion}7D [5/5] 97% ~週日 |${ICON.scroll}CTX [4/5] 72%|🐈2 |${ICON.hourglass}  2:31`)
  // the gauges warn: 11% green, 97% red, the conversation at 72% already yellow
  const colors = segs.filter(s => 'cells' in s).map(s => (s as { color: number }).color)
  expect(colors.slice(1)).toEqual([0x5fd787, 0xff5f5f, 0xffd75f])
  // the reset in the other styles: 12-hour led by its PM mark, and the time left
  expect(text(statusSegs({ limits, budget: null, clock: { h12: true } }, { level: 1, xp: 0 }, 5, now))).toContain('11% \uE0F13:00|')
  expect(text(statusSegs({ limits, budget: null, clock: { countdown: true } }, { level: 1, xp: 0 }, 5, now))).toContain('11% ~5h00m|')
  // the 7-day reset has its own style: the date, or the time left, whatever the 5-hour one is
  expect(text(statusSegs({ limits, budget: null, week: { date: true } }, { level: 1, xp: 0 }, 5, now))).toContain('97% ~10/11|')
  expect(text(statusSegs({ limits, budget: null, clock: { h12: true }, week: { countdown: true } }, { level: 1, xp: 0 }, 5, now))).toContain('97% 4d20h |')
  // nothing known yet: every place kept, empty and "--"
  expect(text(statusSegs({ limits: [], budget: null }, { level: 1, xp: 0 }, 5, now)))
    .toBe(`Lv1 [0/4]|${ICON.heart}5H [0/5] --% ~--:--|${ICON.potion}7D [0/5] --% ~--   |${ICON.scroll}CTX [0/5] --%|🐈0 |${ICON.hourglass} 25:00`)
  // through a proxy: the month's budget and today's spend in place of the windows
  expect(text(statusSegs({ limits: [], budget: { spend: 62, max: 100, today: 8.43 } }, { level: 24, xp: 0 }, 80, now)))
    .toBe(`Lv24[0/4]|${ICON.coin}MON [4/5] 62%|${ICON.coin}TODAY    $8.43|${ICON.scroll}CTX [0/5] --%|🐈0 |${ICON.hourglass} 25:00`)
})

test('the scribe keeps one clean line, and says when it is writing', async () => {
  expect(scribeText('\n「pixmage 已推上 GitHub，等你開新對話測試。」\n第二行')).toBe('pixmage 已推上 GitHub，等你開新對話測試。')
  expect(scribeText('字'.repeat(240)).length).toBe(70)
  expect(scribeLine('等你選要放哪個方案', true)).toEqual({ text: `${ICON.hourglass} 等你選要放哪個方案`, color: '#8a93c8' }) // dimmed while rewriting
  expect(scribeLine(undefined, false).text).toBe(`${ICON.campfire} 冒險即將開始，有什麼任務要交給我？`)
  expect(scribeLine(undefined, true).text).toBe(`${ICON.hourglass} 書記官正在記錄這回合…`)
})

test('the scribe reads the turn, and the line before it', async () => {
  const p = scribePrompt('改好設定', '可以試試看', 'x'.repeat(5000))
  expect(p.startsWith('Where it stood last time: 改好設定')).toBe(true)
  expect(p).toContain('The user said this turn: 可以試試看')
  expect(p.length < 3300).toBe(true)
  expect(scribePrompt(undefined, '', '')).not.toContain('last time')
})

test('the desktop row is the scribe when one is kept', async () => {
  const now = new Date(2026, 9, 7, 10, 0)
  const desk = infoLines({ limits: [], budget: null, scribe: { text: '等你決定要放什麼', writing: false } }, now, true)
  expect(desk[0]!.map(s => ('text' in s ? s.text : '')).join('')).toBe(`${ICON.bubble} 等你決定要放什麼`)
})

test('the phone wraps the info row onto two rows at most', async () => {
  const text = (rows: readonly (readonly ({ text: string } | object)[])[]) => rows.map(r => r.map(s => ('text' in s ? s.text : '')).join(''))
  const row = [{ text: '🧙 ' + '字'.repeat(30), color: 0xffffff }]
  const out = text(wrapRows([row], 20))
  expect(out.length).toBe(2)
  expect(out[0]).toBe('🧙 ' + '字'.repeat(8))
  expect(out[1]!.endsWith('…')).toBe(true)
  expect(text(wrapRows([[{ text: 'short', color: 1 }]], 20))).toEqual(['short'])
})

test('the row icon follows what is happening', async () => {
  expect(scribeIcon('改好了，可以推上去', false)).toBe('quill')
  expect(scribeIcon('改好了，等你確認', false)).toBe('bubble')
  expect(scribeIcon('改好了', true)).toBe('hourglass')
  expect(scribeIcon(undefined, false)).toBe('campfire')
  expect(scribeIcon('改好了', true, 'chest')).toBe('chest') // a moment wins over everything
  expect([toolIcon('Read'), toolIcon('Edit'), toolIcon('Agent'), toolIcon('WebSearch'), toolIcon('mcp__x__y'), toolIcon('Bash')])
    .toEqual(['book', 'quill', 'ghost', 'envelope', 'envelope', 'slime'])
})
