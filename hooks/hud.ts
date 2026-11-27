// Pure formatting: no $, so it is testable on its own.

import { type StatusSeg, wide } from './game'
import { AM, PM } from './font'
import { ICON, type IconName } from './icons'
import { t, type Lang } from './i18n'

export type Limit = { kind: string; percentUsed: number; resetsAt?: string }
export type WorkLog = { skip?: boolean; calendar?: string; title?: string; start?: string } | null

const NAMES: Record<string, string> = { five_hour: '5 小時', seven_day: '7 天', spend_limit: '額度' }
export const limitName = (kind: string) => NAMES[kind] ?? kind

// Green, then yellow past 80%, red past 95%.
export const levelColor = (percent: number) => (percent >= 95 ? '#ff5f5f' : percent >= 80 ? '#ffd75f' : '#5fd787')

export function bar(percent: number, width: number) {
  const filled = Math.round((Math.min(Math.max(percent, 0), 100) / 100) * width)
  return { filled: '█'.repeat(filled), empty: '░'.repeat(width - filled) }
}

const pad = (n: number) => String(n).padStart(2, '0')

// Reset time: today as "14:00", another day as "10/8 09:00".
// How the reset times read: a 24- or 12-hour clock (the 12-hour one leads with an AM/PM mark), or the time left.
export type ClockStyle = { h12?: boolean; countdown?: boolean }
export type WeekStyle = { date?: boolean; countdown?: boolean } // its weekday, else its date, or the time left

export function resetLabel(iso: string | undefined, now: Date, style: ClockStyle = {}) {
  if (!iso) return ''
  const at = new Date(iso)
  if (Number.isNaN(at.getTime())) return ''
  if (style.countdown) return duration(at.getTime() - now.getTime())
  const h = at.getHours()
  const time = style.h12 ? `${h < 12 ? AM : PM}${h % 12 || 12}:${pad(at.getMinutes())}` : `${pad(h)}:${pad(at.getMinutes())}`
  return at.toDateString() === now.toDateString() ? time : `${at.getMonth() + 1}/${at.getDate()} ${time}`
}

export function duration(ms: number) {
  const m = Math.max(0, Math.floor(ms / 60000))
  return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h${pad(m % 60)}m`
}

export const money = (usd: number | undefined) => (usd === undefined ? '' : `$${usd.toFixed(2)}`)

// Emoji (a calendar named "📈 Side Project") drawn smooth among the pixel font: dropped.
const noEmoji = (s: string) => s.replace(/[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}\uFE0F\u200D]/gu, '').replace(/\s{2,}/g, ' ').trim()

// One of Claude's tasks, from its task tools.
export type Todo = { text: string; active?: string; status: 'todo' | 'doing' | 'done' }
// The task under way (its "-ing" form when it has one), else the next; done of all; a word when there are none.
export function todoLine(todo: Todo[], words: { none: string; next: string; done: string }): { text: string; color: string } {
  const done = todo.filter(x => x.status === 'done').length
  const count = todo.length ? `（${done}/${todo.length}）` : ''
  const doing = todo.find(x => x.status === 'doing'), next = todo.find(x => x.status === 'todo')
  if (doing) return { text: `${ICON.memo} ${noEmoji(doing.active || doing.text)}${count}`, color: '#ffffff' }
  if (next) return { text: `${ICON.memo} ${words.next}${noEmoji(next.text)}${count}`, color: '#d6dcff' }
  if (todo.length) return { text: `${ICON.star} ${words.done}${count}`, color: '#ffd75f' }
  return { text: `${ICON.memo} ${words.none}`, color: '#d6dcff' }
}

// The same three states as work-log's own status line (log.py --status).
export function workLogLine(st: WorkLog) {
  // Pixel icons, not emoji: a smooth emoji looks out of place among the pixel font.
  if (st?.skip) return { text: `${ICON.no} 本對話不記錄`, color: '#8a8a8a' }
  if (st?.title) return { text: `${ICON.calendar} ${noEmoji(st.calendar ?? '')}｜${noEmoji(st.title)}（${(st.start ?? '').slice(11)} 起）`, color: '#87afff' }
  return { text: `${ICON.memo} 本對話未記錄`, color: '#ffd75f' }
}

// Scribe, the desktop row's other mode (userConfig infoRow: scribe): Clawd says in one line where the
// work stands and what it waits on, so a session picked up again needs no scrolling back.
export const SCRIBE_MAX = 70 // the window holds two rows

// What the scribe writes in, and the words that mark a line waiting on you (the row's icon becomes a "!").
const SCRIBE_LANG = { zh: '繁體中文', en: 'English', ja: '日本語' } as const
export const SCRIBE_WAIT = { zh: '等你', en: 'Waiting on you', ja: 'あなた待ち' } as const
export const scribeSystem = (lang: keyof typeof SCRIBE_LANG) => [
  'You are the scribe in a pixel RPG, noting where this conversation stands for the user.',
  `Write exactly one sentence in ${SCRIBE_LANG[lang]}, at most 60 characters: no quotes, no line breaks, no prefix.`,
  `If the assistant ended waiting on the user's answer or decision, start with "${SCRIBE_WAIT[lang]}" and say what it waits on; otherwise say how far it got and what comes next.`,
].join('\n')

const tail = (s: string, n: number) => (s.length > n ? `…${s.slice(-n)}` : s)

export function scribePrompt(previous: string | undefined, prompt: string, answer: string) {
  return [
    previous ? `Where it stood last time: ${previous}` : '',
    `The user said this turn: ${tail(prompt, 1500) || '(no text)'}`,
    `The assistant's last reply this turn: ${tail(answer, 3000) || '(no text)'}`,
  ].filter(Boolean).join('\n\n')
}

// The model's reply as one row: first line, no quotes, clipped.
export function scribeText(reply: string) {
  const line = noEmoji(reply.split('\n').find(l => l.trim()) ?? '').replace(/^[「『"']+|[」』"']+$/g, '')
  return line.length > SCRIBE_MAX ? `${line.slice(0, SCRIBE_MAX - 1)}…` : line
}

// The row's icon says what is happening now; `live` (a tool running, a moment like a level-up) wins.
// Otherwise: an hourglass while the scribe writes, a "!" when the line waits on you, the quill.
export function scribeIcon(text: string | undefined, writing: boolean, live?: IconName): IconName {
  if (live) return live
  if (writing) return 'hourglass'
  if (!text) return 'campfire'
  return Object.values(SCRIBE_WAIT).some(w => text.startsWith(w) || text.includes('等你')) ? 'bubble' : 'quill'
}

// While a new line is being written the last one dims.
export function scribeLine(text: string | undefined, writing: boolean, live?: IconName, words = { writing: '書記官正在記錄這回合…', idle: '冒險即將開始，有什麼任務要交給我？' }): { text: string; color: string } {
  const icon = `${ICON[scribeIcon(text, writing, live)]} `
  if (text) return { text: icon + text, color: writing ? '#8a93c8' : '#ffffff' }
  return writing ? { text: `${icon}${words.writing}`, color: '#8a93c8' } : { text: `${icon}${words.idle}`, color: '#d6dcff' }
}

// What Claude is doing, as the row's icon while a tool runs.
export function toolIcon(tool: string): IconName {
  if (tool === 'Read' || tool === 'Grep' || tool === 'Glob') return 'book'
  if (tool === 'Edit' || tool === 'Write' || tool === 'NotebookEdit') return 'quill'
  if (tool === 'Agent' || tool === 'Task') return 'ghost'
  if (tool === 'WebFetch' || tool === 'WebSearch' || tool.startsWith('mcp__')) return 'envelope'
  return 'slime'
}

// LiteLLM budget, from its /key/info (month) and /user/daily/activity (today).
export type Budget = { spend: number; max: number | null; resetsAt?: string; today?: number }

export function parseKeyInfo(text: string): Omit<Budget, 'today'> | null {
  try {
    const d = JSON.parse(text) as { info?: { spend?: number; max_budget?: number | null; budget_reset_at?: string } }
    const i = d.info
    if (!i || typeof i.spend !== 'number') return null
    return { spend: i.spend, max: i.max_budget ?? null, resetsAt: i.budget_reset_at ?? undefined }
  } catch {
    return null
  }
}

export function parseToday(text: string): number | undefined {
  try {
    const d = JSON.parse(text) as { metadata?: { total_spend?: number } }
    return d.metadata?.total_spend
  } catch {
    return undefined
  }
}

export const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

// The rows of the RPG window under the knight: only what that surface does not already show.
// ASCII labels, since a terminal cell holds one narrow glyph.
//   terminal: context fill and spend (work-log and the model are on its status line and header)
//   desktop:  work-log or the scribe; usage rides the status bar under the window instead (statusSegs)
export type MonStyle = 'spent' | 'left'
export type TodayStyle = 'daily' | 'reset'
export type Info = {
  ctx?: number
  limits: Limit[]
  budget: Budget | null
  workLog?: WorkLog
  todo?: Todo[] // set: the desktop row is Claude's task list
  scribe?: { text?: string; writing: boolean; live?: IconName } // set: the desktop row is the scribe instead of work-log
  clock?: ClockStyle // how the 5-hour reset reads (/pixmage clock, a click on it)
  week?: WeekStyle // how the 7-day reset reads, on its own (a click on it)
  money?: MonStyle // how the proxy's month reads: a share (absent), spent of the budget, or what is left (a click on MON)
  today?: TodayStyle // what TODAY reads: today's spend (absent), what each day left may spend, or the budget's reset day
}
type Seg = { text: string; color: number } | { gauge: number; width: number; color: number }
const C = { label: 0xffe08a, dim: 0xd6dcff, text: 0xffffff, money: 0xffd75f } // dim stays readable on the bright day sky
const num = (hexColor: string) => parseInt(hexColor.slice(1), 16)
const LABELS: Record<string, string> = { five_hour: '5H', seven_day: '7D', spend_limit: 'LIMIT' }
const GAP = { text: '   ', color: C.dim }

function meter(label: string, percent: number, note?: string): Seg[] {
  const color = num(levelColor(percent))
  return [
    { text: `${label} `, color: C.label },
    { gauge: percent, width: 8, color },
    { text: ` ${Math.round(percent)}%`, color: C.text },
    ...(note ? [{ text: ` ${note}`, color: C.dim }] : []),
    GAP,
  ]
}

export function infoLines(info: Info, now: Date, desktop: boolean, words = { none: '還沒有待辦事項', next: '下一步：', done: '待辦全部完成！', writing: '書記官正在記錄這回合…', idle: '冒險即將開始，有什麼任務要交給我？' }): Seg[][] {
  const usage: Seg[] = []
  if (info.ctx !== undefined && !desktop) usage.push(...meter('CTX', info.ctx))
  const b = info.budget
  if (b) {
    if (b.max) usage.push(...meter('MON', (b.spend / b.max) * 100, `${money(b.max - b.spend)} left`))
    else usage.push({ text: 'MON ', color: C.label }, { text: money(b.spend), color: C.text }, GAP)
    if (b.today !== undefined) usage.push({ text: 'TODAY ', color: C.label }, { text: money(b.today), color: C.money })
  } else {
    for (const l of info.limits) usage.push(...meter(LABELS[l.kind] ?? l.kind, l.percentUsed, l.resetsAt ? `~${resetLabel(l.resetsAt, now)}` : undefined))
  }
  if (!desktop) return [usage]

  const log = info.todo ? todoLine(info.todo, words) : info.scribe ? scribeLine(info.scribe.text, info.scribe.writing, info.scribe.live, words) : workLogLine(info.workLog ?? null)
  return [[{ text: log.text, color: num(log.color) }]]
}

// The phone's window is narrow: a row of plain text wraps onto as many rows as it needs, up to `max`,
// the last one clipped. Rows holding a gauge are left as they are.
export function wrapRows(rows: Seg[][], width: number, max = 2): Seg[][] {
  const out: Seg[][] = []
  for (const row of rows) {
    if (row.some(s => 'gauge' in s)) { out.push(row); continue }
    const color = (row[0] as { color: number } | undefined)?.color ?? C.text
    const text = row.map(s => ('text' in s ? s.text : '')).join('')
    let line = '', used = 0
    const lines: string[] = []
    for (const ch of text) {
      const w = wide(ch) ? 2 : 1
      if (used + w > width) { lines.push(line); line = ''; used = 0 }
      line += ch
      used += w
    }
    if (line) lines.push(line)
    if (lines.length > max) lines.splice(max - 1, lines.length, `${lines[max - 1]!.slice(0, -1)}…`)
    for (const l of lines) out.push([{ text: l, color }])
  }
  return out
}


// The desktop's status bar, left to right: the level and its xp, the usage windows (or, through a proxy, the
// month's budget and today's spend), the conversation's fill, the subagents running (by the black cat), and
// the hourglass. Bars are a fixed
// length so nothing shifts as the numbers move; a figure not known yet shows as an empty bar and "--", never
// a gap. The gauges warn as they fill: green, then yellow, then red; the conversation's a little earlier, as
// it nears the point where it is compacted.
const SB_BAR = 5
const XP_COLOR = 0xb07cff // the level's own colour: not a gauge that warns
const ctxColor = (pct: number) => (pct >= 85 ? 0xff5f5f : pct >= 70 ? 0xffd75f : 0x5fd787)
const pctBar = (pct: number | undefined, color: number): StatusSeg => ({ cells: SB_BAR, fill: pct === undefined ? 0 : Math.ceil((Math.min(Math.max(pct, 0), 100) / 100) * SB_BAR), color }) // any use lights a cell
// The black cat's face, as the status bar counts the subagents running by it.
const CAT_FACE = ['............', '.K........K.', '.KP......PK.', '.KKKKKKKKKK.', 'KKKKKKKKKKKK', 'KKYKKKKKKYKK', 'KKYKKKKKKYKK', 'KKKKKPPKKKKK', '.KKKKKKKKKK.', '..KKKKKKKK..', '............', '............']
const CAT_FACE_PAL = { K: 0x9a8ad0, Y: 0xffd75f, P: 0xffb3c1 } // a lighter black: the bar's face is dark
// The seven-day window's reset, short: its weekday, its date (month/day), or the days and hours left.
const WEEKDAY: Record<string, string[]> = {
  zh: ['週日', '週一', '週二', '週三', '週四', '週五', '週六'],
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  ja: ['日曜', '月曜', '火曜', '水曜', '木曜', '金曜', '土曜'],
}
export function weekReset(iso: string | undefined, now: Date, style: WeekStyle = {}, lang = 'zh') {
  const at = iso ? new Date(iso) : undefined
  if (!at || Number.isNaN(at.getTime())) return '--'
  if (style.date) return `${at.getMonth() + 1}/${at.getDate()}`
  if (!style.countdown) return (WEEKDAY[lang] ?? WEEKDAY.zh!)[at.getDay()]!
  const h = Math.max(0, Math.floor((at.getTime() - now.getTime()) / 3_600_000))
  return h < 24 ? `${h}h` : `${Math.floor(h / 24)}d${h % 24}h`
}
// `s` padded with spaces to `n` columns (a wide character takes two): on the left when `right`, else after.
// A string too long by its leading space loses that space (a 12-hour reset at 10–12 o'clock), so the width holds.
const fit = (s: string, n: number, right = false) => {
  const cols = (t: string) => [...t].reduce((w, ch) => w + (wide(ch) ? 2 : 1), 0)
  if (cols(s) > n && s.startsWith(' ')) s = s.trimStart()
  const pad = ' '.repeat(Math.max(0, n - cols(s)))
  return right ? pad + s : s + pad
}
// `pomoMs`: the focus timer's time left, absent while it waits for a click (then it shows the full 25:00, dim).
export const POMO_MS = 25 * 60_000
export function statusSegs(info: Info, save: { level: number; xp: number }, needXp: number, now: Date, agents = 0, pomoMs?: number, lang = 'zh'): StatusSeg[] {
  const SEP: StatusSeg = { sep: true }
  const gauge = (icon: string, label: string, pct: number | undefined, color: (p: number) => number, note = '', noteId?: string): StatusSeg[] => {
    const c = pct === undefined ? C.dim : color(pct)
    // Fixed widths (the percent in 4 columns, a reset in 7), so a new number or another clock style never shifts what follows.
    return [{ text: `${icon}${label} `, color: C.label }, pctBar(pct, c), { text: fit(pct === undefined ? '--%' : `${Math.round(pct)}%`, 4, true), color: pct === undefined ? C.dim : c }, ...(note ? [{ text: fit(note, 7), color: C.text, id: noteId }] : [])]
  }
  const warn = (p: number) => num(levelColor(p))
  const out: StatusSeg[] = [{ text: fit(`Lv${save.level}`, 4), color: 0xffd75f }, { cells: 4, fill: Math.floor((save.xp / needXp) * 4), color: XP_COLOR }]
  const b = info.budget
  if (b) {
    // A click on MON shows what was spent of the month's budget instead of the share (the proxy's own figures).
    const pct = b.max ? (b.spend / b.max) * 100 : undefined
    const mon = gauge(ICON.coin, 'MON', pct, warn).map((x, i) => (i === 0 ? { ...x, id: 'money' } : x))
    if (info.money === 'left' && b.max) mon[2] = { text: fit(`${money(b.max - b.spend)} ${t(lang as Lang, 'left')}`, 15, true), color: warn(pct!), id: 'money' }
    else if (info.money) mon[2] = { text: fit(b.max ? `${money(b.spend)}/${money(b.max)}` : money(b.spend), 15, true), color: pct === undefined ? C.text : warn(pct), id: 'money' }
    else mon[2] = { ...mon[2]!, id: 'money' }
    out.push(SEP, ...mon)
    // TODAY: today's spend, what each day to the reset may spend, or the reset's day; a fixed width, so the bar holds still.
    const resets = b.resetsAt ? new Date(b.resetsAt) : undefined, ok = resets && !Number.isNaN(resets.getTime())
    const days = ok ? Math.max(1, Math.ceil((resets!.getTime() - now.getTime()) / 86_400_000)) : undefined
    const [word, value] = info.today === 'daily' ? ['DAILY', b.max && days ? money(Math.max(0, b.max - b.spend) / days) : undefined]
      : info.today === 'reset' ? ['RESET', ok ? `${resets!.getMonth() + 1}/${resets!.getDate()}` : undefined]
      : ['TODAY', b.today === undefined ? undefined : money(b.today)]
    out.push(SEP, { text: `${ICON.coin}${word} `, color: C.label, id: 'today' }, { text: fit(value ?? '--', 8, true), color: value === undefined ? C.dim : C.money, id: 'today' })
  } else {
    // The two windows always hold their places; one not reported yet waits there empty.
    // A window whose reset has passed is empty again, though no reply has said so yet: 0%, its next reset unknown.
    const fresh = (l?: Limit) => (l?.resetsAt && Date.parse(l.resetsAt) <= now.getTime() ? { ...l, percentUsed: 0, resetsAt: undefined } : l)
    const five = fresh(info.limits.find(l => l.kind === 'five_hour')), seven = fresh(info.limits.find(l => l.kind === 'seven_day'))
    // The reset time alone: the five-hour window never runs past tomorrow morning, so no date.
    // The 12-hour clock leads with its AM/PM mark, which says as much as the "~".
    const at = ` ${info.clock?.h12 && five?.resetsAt ? '' : '~'}${five?.resetsAt ? resetLabel(five.resetsAt, now, info.clock).split(' ').pop() : '--:--'}`
    out.push(SEP, ...gauge(ICON.heart, '5H', five?.percentUsed, warn, at, 'clock'), SEP, ...gauge(ICON.potion, '7D', seven?.percentUsed, warn, ` ${info.week?.countdown ? '' : '~'}${weekReset(seven?.resetsAt, now, info.week, lang)}`, 'week'))
  }
  out.push(SEP, ...gauge(ICON.scroll, 'CTX', info.ctx, ctxColor))
  // The subagents running, by the black cat's face: dim at none.
  out.push(SEP, { art: CAT_FACE, palette: agents ? CAT_FACE_PAL : { K: 0x7c76a0, Y: 0xb0aacc, P: 0xb0aacc } }, { text: fit(`${agents}`, 2), color: agents ? C.text : C.dim })
  // The focus timer (a click starts or stops it): 25 minutes counting down by the hourglass.
  const sec = Math.ceil((pomoMs ?? POMO_MS) / 1000)
  out.push(SEP, { text: `${ICON.hourglass}${fit(`${Math.floor(sec / 60)}:${pad(sec % 60)}`, 6, true)}`, color: pomoMs === undefined ? C.dim : C.text, id: 'pomo' })
  return out
}
