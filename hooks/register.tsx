import type { EngineInterface, Register } from 'claude-code'

import { ACTION_TICKS, createGame, pokeSpans, TEXT_PX, wide, type Kind, withButtons, kindFor, need, toSvg, withStatusBar, withStrip, type Save } from './game'
import type { Outfit } from './hires'
import { ICON, type IconName } from './icons'
import { type Lang, nextLang, t } from './i18n'
import { type Card, cardAt, sliderAt, type Span, withScroll } from './settings'
import { BLOW, CAST, FALL, gate, GAIN, MUSIC_GAIN, nextTrack, type Sfx } from './sound'
import { infoLines, parseKeyInfo, wrapRows, scribeSystem, scribePrompt, scribeText, statusSegs, POMO_MS, toolIcon, parseToday, ymd, type Budget, type Info, type MonStyle, type TodayStyle, type Limit, type Todo, type WorkLog } from './hud'

const DESKTOP_COLS = 88 // the picture fills the slot: fewer columns draw it bigger, more leave the HUD room to breathe
const BUDGET_EVERY = 60_000 // LiteLLM figures also refresh on their own, once a minute
const BUDGET_SETTLE = 3_000 // LiteLLM books a request a moment after it answers
const SCRIBE_TIMEOUT = 20_000
const SYNC_EVERY = 5_000 // open sessions share one store: pick up each other's kills and readings
const IDLE_MOON = 10 * 60_000 // idle this long, the row's icon is the moon
const IDLE_SLOW = 2 * 60_000 // idle this long, the desktop picture slows to ~1.7 fps
const IDLE_FREEZE = 10 * 60_000 // and this long (away from the desk), it holds still: a frame a minute
const IDLE_STOP = 30 * 60_000 // and this long, no frames at all until the next turn
const STRIP_ROWS = 2 // the message window's rows, always: a window that grew and shrank with its line shook the chat

// The window's lines, wrapped and padded to STRIP_ROWS so the picture's height never changes.
function stripRows(info: Info, now: Date, width: number, lang: Lang) {
  const rows = wrapRows(infoLines(info, now, true, { none: t(lang, 'todoNone'), next: t(lang, 'todoNext'), done: t(lang, 'todoDone'), writing: t(lang, 'scribeWriting'), idle: t(lang, 'scribeIdle') }), width, STRIP_ROWS)
  while (rows.length < STRIP_ROWS) rows.push([{ text: '', color: 0 }])
  return rows
}

// Through a LiteLLM proxy there are no rate-limit windows: ask the proxy what this key has spent.
// Null when the session talks to Anthropic directly or the proxy cannot answer.
async function fetchBudget($: EngineInterface): Promise<Budget | null> {
  const [base, token] = await Promise.all([$.env.get('ANTHROPIC_BASE_URL'), $.env.get('ANTHROPIC_AUTH_TOKEN')])
  if (!base || !token || base.includes('anthropic.com')) return null
  const headers = { Authorization: `Bearer ${token}` }
  try {
    const day = ymd(new Date(await $.clock.now()))
    const [info, daily] = await Promise.all([
      $.http.fetch(`${base}/key/info`, { headers }),
      $.http.fetch(`${base}/user/daily/activity?start_date=${day}&end_date=${day}`, { headers }),
    ])
    const month = info.ok ? parseKeyInfo(info.text) : null
    return month && { ...month, today: daily.ok ? parseToday(daily.text) : undefined }
  } catch {
    return null
  }
}

// Desktop has no status line, so the strip carries work-log's state: read the file log.py keeps per session.
async function readWorkLog($: EngineInterface): Promise<WorkLog> {
  const [home, id] = await Promise.all([$.env.get('HOME'), $.session.id()])
  try {
    return JSON.parse(await $.fs.read(`${home}/.claude/.work-log/${id}.json`)) as WorkLog
  } catch {
    return null // no file yet: this session has neither begun nor skipped a log
  }
}

// The scribe: one cheap call after each turn; the row keeps the last line until the new one arrives.
// True when a new line came.
async function writeScribe($: EngineInterface, info: Info, prompt: string, answer: string, lang: Lang) {
  const scribe = info.scribe
  if (!scribe) return false
  info.scribe = { ...scribe, writing: true }
  const r = await $.model.complete({
    model: 'haiku',
    system: scribeSystem(lang),
    prompt: scribePrompt(scribe.text, prompt, answer),
    maxTokens: 200,
    effort: 'low',
    timeoutMs: SCRIBE_TIMEOUT,
  })
  const text = r.isAnswered ? scribeText(r.text) : ''
  info.scribe = { text: text || scribe.text, writing: false }
  if (text) await $.store.set(`scribe:${await $.session.id()}`, text)
  return Boolean(text)
}

// Usage figures any session saw, stamped, so every open session shows the newest one.
type Stamped<T> = { at: number; value: T }
type Seen = { limitsAt: number; budgetAt: number; proxy: boolean } // the stamps this session shows; through LiteLLM?
// The newest save and readings from the store. The save is the one tally all sessions add to.
async function sync($: EngineInterface, save: Save, info: Info, seen: Seen) {
  const [shared, limits, budget] = await Promise.all([$.store.get('save'), $.store.get('usage:limits'), $.store.get('usage:budget')]) as [Save | undefined, Stamped<Limit[]> | undefined, Stamped<Budget> | undefined]
  if (shared) Object.assign(save, shared)
  if (limits && limits.at > seen.limitsAt) {
    seen.limitsAt = limits.at
    info.limits = limits.value.filter(l => !l.resetsAt || Date.parse(l.resetsAt) > Date.now())
  }
  // A subscription session leaves the proxy's spend alone: its gauges are the windows.
  if (seen.proxy && budget && budget.at > seen.budgetAt) { seen.budgetAt = budget.at; info.budget = budget.value }
}

// Ask the proxy, unless another session asked a moment ago; share what it says.
async function refreshBudget($: EngineInterface, save: Save, info: Info, seen: Seen, force = false) {
  await sync($, save, info, seen)
  if (!seen.proxy) return
  if (!force && Date.now() - seen.budgetAt < BUDGET_EVERY - SYNC_EVERY) return
  const b = await fetchBudget($)
  if (!b) return
  seen.budgetAt = Date.now()
  info.budget = b
  await $.store.set('usage:budget', { at: seen.budgetAt, value: b } satisfies Stamped<Budget>)
}

// A debug log (/pixmage debug on): clicks, how long they and the frames took, and failures, kept in memory and
// written to debug.log in the mod's folder every few seconds, to find what goes wrong on another machine.
let debugOn = false, debugDirty = false
const debugLines: string[] = []
function dlog(line: string) {
  if (!debugOn) return
  debugLines.push(`${new Date().toISOString().slice(11, 23)} ${line}`)
  if (debugLines.length > 400) debugLines.splice(0, debugLines.length - 400)
  debugDirty = true
}
async function flushDebug($: EngineInterface) {
  if (!debugOn || !debugDirty) return
  debugDirty = false
  await $.fs.write(`${$.plugin.root}/debug.log`, `${debugLines.join('\n')}\n`).catch(() => $.store.set('debug:log', debugLines.slice(-150))) // no write there: the store keeps the last lines
}

// Settings a click changed: the picture answers at once, and the store is written a moment after the clicks stop,
// one write per setting (a drag of a slider makes dozens of changes). A write the store refuses (a Windows lock
// another session holds) is tried again. Until it lands, reads here see the new value.
const pending = new Map<string, unknown>()
let flushing = false
function keep($: EngineInterface, key: string, value: unknown) {
  pending.set(key, value)
  if (!flushing) { flushing = true; $.clock.after(400, () => void flushKept($, 0)) }
}
async function flushKept($: EngineInterface, tries: number) {
  for (const [key, value] of [...pending]) {
    try {
      await $.store.set(key, value)
      if (pending.get(key) === value) pending.delete(key) // unless it changed again meanwhile
    } catch (err) { dlog(`store.set ${key} failed (try ${tries + 1}): ${String(err)}`) }
  }
  if (pending.size && tries < 8) $.clock.after(300 * (tries + 1), () => void flushKept($, tries + 1))
  else flushing = false
}
// A setting as this session has it: its own change not yet written, else the store's.
const getKept = ($: EngineInterface, key: string) => (pending.has(key) ? Promise.resolve(pending.get(key)) : $.store.get(key))

// /pixmage off and the hide button: kept under this session's id, so reopening the chat keeps it off.
async function storeHidden($: EngineInterface, hidden: boolean) {
  const key = `hidden:${await $.session.id()}`
  await (hidden ? $.store.set(key, true) : $.store.delete(key))
}

// The row this session shows, set by the book button; kept per session like hidden, else the config's.
type RowMode = 'todo' | 'scribe' | 'work-log'
async function storeRow($: EngineInterface, mode: RowMode) {
  await $.store.set(`row:${await $.session.id()}`, mode)
}
// work-log's per-session files: only machines that run it get the work-log mode.
async function hasWorkLog($: EngineInterface) {
  try { await $.fs.list(`${await $.env.get('HOME')}/.claude/.work-log`); return true } catch { return false }
}

// Fills the row: Claude's task list as it stands, the scribe's last line, or work-log's state.
async function loadRow($: EngineInterface, info: Info, mode: RowMode, tasks: Tasks) {
  info.scribe = mode === 'scribe' ? { text: (await $.store.get(`scribe:${await $.session.id()}`)) as string | undefined, writing: false } : undefined
  info.workLog = mode === 'work-log' ? await readWorkLog($) : undefined
  info.todo = mode === 'todo' ? [...tasks.values()] : undefined
}
// Claude's task list in this session, as its tools set it (TodoWrite, or TaskCreate / TaskUpdate), in order.
type Tasks = Map<string, Todo>

// Desktop draws Buttons as its own native buttons: so the keys are pixels in the picture, and a see-through
// click pad (a Client) over it says where a click lands.
const CONTROLS = [['gear', 'gear']] as const // top right: the settings page holds the rest

// Sounds: on unless /pixmage sound off (kept for every session); the music buttons play regardless.
const lastSound = new Map<string, number>()
export const VOLUMES = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1] // the settings page's volume slider: silent to full (100%, the default)
const volumeStep = (v: number) => VOLUMES.reduce((best, x, i) => (Math.abs(x - v) < Math.abs(VOLUMES[best]! - v) ? i : best), 0) // the nearest step (older saves held 0.5, 1, 1.6)
const volume = { music: 1, sfx: 1 } // the ones picked: the music's, the sound effects'
// No sound where Claude Code has no player (Windows, Linux): the sound settings are greyed out there, nothing plays.
let soundless = false
function sfx($: EngineInterface, on: boolean, name: Sfx) {
  if (soundless || !on || !gate(lastSound, name, Date.now())) return
  void $.audio.play({ asset: `sounds/${name}.wav` }, { gain: GAIN[name] * volume.sfx }).catch(() => {})
}

// Background music: one track of the mod's music folder on repeat, or shuffled. One session plays it for all
// of them (the owner, named in the store with a heartbeat), so moving between sessions never starts it over; the
// others stay quiet (`away`) and take over only when the owner is gone.
// A track's name on the settings page: music/titles.json's, else its file name less the extension and any number.
let titles: Record<string, string> = {}
const trackTitle = (file?: string) => (file ? titles[file] ?? file.replace(/\.[^.]+$/, '').replace(/^\d+[\s._-]*/, '') : '--')
// At most `n` columns (a wide character takes two), cut with an ellipsis: a long name fits its bar.
const clip = (s: string, n: number) => {
  let w = 0, out = ''
  for (const ch of s) { const cw = wide(ch) ? 2 : 1; if (w + cw > n - 1 && [...s].length > [...out].length + 1) return `${out}…`; w += cw; out += ch }
  return out
}
let uiLang: Lang = 'zh' // the language picked, for the few words said outside the hooks (the music's toasts)
type Music = { on: boolean; away: boolean; shuffle: boolean; failed?: boolean; track?: string; stop?: AbortController; pos?: { t0: number; byte: number; rate: number } } // pos: where in the file it plays (an MP3's bytes and their rate), to start again from there
const OWNER_STALE = 15_000 // an owner not heard from this long is gone
type Owner = { id: string; beat: number }
async function musicTracks($: EngineInterface) {
  try {
    return (await $.fs.list(`${$.plugin.root}/music`)).filter(f => f.kind === 'file' && /\.(mp3|m4a|wav|aac)$/i.test(f.name)).map(f => f.name).sort()
  } catch {
    return []
  }
}
// MP3s only: the player has no seek and no gain to change while it plays, so a new volume starts the track again
// at once from the byte it had reached, read from the file in pieces the reader allows (4 MiB, about two minutes).
const PIECE = 4 * 1024 * 1024
const bytesOf = (s: string) => (Uint8Array as unknown as { fromBase64(s: string): Uint8Array }).fromBase64(s) // the engine has them; TypeScript's lib not yet
const base64Of = (b: Uint8Array) => (b as unknown as { toBase64(): string }).toBase64()
const KBPS = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320] // MPEG-1 layer III
const mp3At = (b: Uint8Array, from = 0) => { // the first frame's start at or after `from`, -1 if none
  for (let i = from; i < b.length - 3; i++) if (b[i] === 0xff && (b[i + 1]! & 0xfe) === 0xfa && b[i + 2]! >> 4 > 0 && b[i + 2]! >> 4 < 15 && ((b[i + 2]! >> 2) & 3) !== 3) return i
  return -1
}
const mp3s = new Map<string, { first: number; rate: number } | null>()
async function mp3Of($: EngineInterface, path: string) { // the first frame's byte and the bytes a second, past any ID3 tag
  if (!mp3s.has(path)) {
    try {
      const head = bytesOf((await $.fs.read(path, { as: 'bytes', length: 10 })).base64)
      const tag = head[0] === 0x49 && head[1] === 0x44 && head[2] === 0x33 ? 10 + (((head[6]! & 127) << 21) | ((head[7]! & 127) << 14) | ((head[8]! & 127) << 7) | (head[9]! & 127)) : 0
      const b = bytesOf((await $.fs.read(path, { as: 'bytes', offset: tag, length: 8192 })).base64), i = mp3At(b)
      mp3s.set(path, i < 0 ? null : { first: tag + i, rate: (KBPS[b[i + 2]! >> 4]! * 1000) / 8 })
    } catch { mp3s.set(path, null) }
  }
  return mp3s.get(path) ?? undefined
}
// One track on repeat, or (shuffle) the next at random as each ends; `change` moves to another now; `from`: the
// same track again from that byte (a new volume). The track playing is remembered for every session.
// `resume`: a session taking the music over (a new one, or after /clear) picks up where the last one was, from the
// place every player writes down (`music:pos`), so the song carries on instead of starting over.
async function playMusic($: EngineInterface, m: Music, change = false, from?: number, resume = false) {
  m.stop?.abort()
  m.stop = undefined
  m.pos = undefined
  if (soundless || !m.on || m.away || m.failed) return
  const tracks = await musicTracks($)
  const track = !change && m.track && tracks.includes(m.track) ? m.track : nextTrack(tracks, m.track)
  if (!track) { m.failed = true; $.ui.toast(t(uiLang, 'noMusic')); return } // said once: no retrying until the music is switched again
  if (track !== m.track) void $.store.set('music:track', track)
  if (track !== m.track) from = undefined
  m.track = track
  const stop = (m.stop = new AbortController())
  const path = `${$.plugin.root}/music/${track}`
  const levels = await $.fs.read(`${$.plugin.root}/music/levels.json`).then(t => JSON.parse(t) as Record<string, number>, () => ({}) as Record<string, number>)
  const gain = (levels[track] ?? MUSIC_GAIN) * volume.music
  const mp3 = /\.mp3$/i.test(track) ? await mp3Of($, path) : undefined
  if (m.stop !== stop) return
  if (resume && from === undefined && mp3) {
    const saved = (await $.store.get('music:pos')) as { track: string; byte: number; t0: number } | undefined
    if (saved?.track === track && Date.now() - saved.t0 < 10 * 60_000) from = Math.round(saved.byte + ((Date.now() - saved.t0) / 1000) * mp3.rate)
    if (m.stop !== stop) return
  }
  // Played once each time, never looped by the player: its end picks what comes next, so a change of play mode
  // takes hold there without cutting the track short.
  let played: boolean
  const began = Date.now()
  if (from === undefined || !mp3) {
    if (mp3) { m.pos = { t0: Date.now(), byte: mp3.first, rate: mp3.rate }; void $.store.set('music:pos', { track, byte: m.pos.byte, t0: m.pos.t0 }) }
    played = await $.audio.play({ asset: `music/${track}` }, { gain, signal: stop.signal }).then(() => true, () => false)
  } else {
    played = true
    for (let at = from; ;) { // piece by piece to the end
      const b = await $.fs.read(path, { as: 'bytes', offset: at, length: PIECE }).then(r => bytesOf(r.base64), () => new Uint8Array())
      const i = mp3At(b)
      if (m.stop !== stop || i < 0) break
      m.pos = { t0: Date.now(), byte: at + i, rate: mp3.rate }
      void $.store.set('music:pos', { track, byte: m.pos.byte, t0: m.pos.t0 })
      played = await $.audio.play({ base64: base64Of(b.subarray(i)), mime: 'audio/mpeg' }, { gain, signal: stop.signal }).then(() => true, () => false)
      if (m.stop !== stop || !played || b.length < PIECE) break
      at += b.length
    }
  }
  if (m.stop !== stop) return // stopped or skipped meanwhile
  m.stop = undefined
  m.pos = undefined
  // A track "over" at once: no player here (Windows and Linux have none), so a play is skipped. Without this
  // the next track would start, end and start again without a pause, writing the store each time.
  if (played && from === undefined && Date.now() - began < 1500) { m.failed = true; dlog('music: no player here'); $.ui.toast(t(uiLang, 'noPlayer')); return }
  if (played) void playMusic($, m, m.shuffle) // the track ended: the same again, or (shuffle) the next
  else { m.failed = true; $.ui.toast(t(uiLang, 'musicFailed')) }
}
// Stop the music here for good (this session ends): nothing left to pick up where it stopped.
function stopMusic(m: Music) {
  const s = m.stop
  m.stop = undefined
  m.pos = undefined
  m.away = true
  s?.abort() // an aborted play resolves, as if it ended: cleared first, so it does not start the next
}
// The music playing here at the volume now picked, from where it is (an MP3; anything else, from its next track).
function retune($: EngineInterface, m: Music) {
  if (!m.stop || !m.pos || m.away) return
  void playMusic($, m, false, Math.round(m.pos.byte + ((Date.now() - m.pos.t0) / 1000) * m.pos.rate))
}
// What Clawd wears for a request: the hat by the model's family, the wand by the effort it asks for.
function outfitOf(model: string, effort: string | number | undefined): Outfit {
  const m = model.toLowerCase()
  const hat = m.includes('haiku') ? 'haiku' : m.includes('opus') ? 'opus' : m.includes('fable') ? 'fable' : 'sonnet'
  const wand = effort === 'low' || effort === 'high' || effort === 'xhigh' || effort === 'max' ? effort : 'medium'
  return { hat, wand }
}
// The settings scroll rolls on a clock of its own, quicker than the picture's: ten steps 40 ms apart (the
// drawing eases them out), `step` after each. Returns the clock, so the next roll can stop it.
function rollScroll($: EngineInterface, scroll: { p: number; target: number }, prev: { cancel: () => void } | undefined, step: () => void) {
  prev?.cancel()
  const clock = $.clock.every(40, () => {
    scroll.p = scroll.target > scroll.p ? Math.min(scroll.target, scroll.p + 0.1) : Math.max(scroll.target, scroll.p - 0.1)
    if (Math.abs(scroll.p - scroll.target) < 1e-6) { scroll.p = scroll.target; clock.cancel() }
    step()
  })
  return clock
}

// The picture's pace: eco redraws half as often (the battery), smooth twice (10 fps while working, about 3% of a core).
type Fx = 'eco' | 'normal' | 'smooth'
const FXS: readonly Fx[] = ['normal', 'smooth', 'eco']
const FX_PACE: Record<Fx, number> = { eco: 2, normal: 1, smooth: 0.5 }
const FX_WORD = { eco: 'fxEco', normal: 'fxNormal', smooth: 'fxSmooth' } as const
// What a click at `f` (a share of the picture's width) lands on: Clawd, the cat or the castle, if any.
function pokeAt(cols: number, f: number): 'clawd' | 'cat' | 'castle' | undefined {
  const { clawd, cat, castle } = pokeSpans(cols)
  return f >= clawd[0] && f <= clawd[1] ? 'clawd' : f >= cat[0] && f <= cat[1] ? 'cat' : f >= castle[0] && f <= castle[1] ? 'castle' : undefined
}
const COMPACT_STEPS = [0, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95] // off, or the conversation's fill to compact at (the settings page's slider)
const CLOSE = [['hide', 'close']] as const // top left

export const register: Register = (on, options) => {
  // The desktop row: Claude's current task (the default), the scribe, or work-log's state (machines that run it;
  // `auto` picks it there).
  let rowMode: RowMode = options.infoRow === 'scribe' ? 'scribe' : options.infoRow === 'work-log' ? 'work-log' : 'todo'
  let workLogHere = false
  const tasks: Tasks = new Map()
  const showTasks = () => { if (rowMode === 'todo') info.todo = [...tasks.values()] } // the hook that changed them redraws
  let game = createGame({ kills: 0, xp: 0, level: 1 })
  // Kept under this session's own id, so reopening the chat keeps it off and no other session writes it.
  let hidden = false
  let keyAt: { id: string; from: number; to: number }[] = [] // each key's span, as a share of the picture's width
  let statusAt: { id: string; from: number; to: number }[] = [] // what in the status bar a click can change
  let textRows = 12, guessRows = 9, padBottom = -1, padRow = -1, padSize = '' // the picture's text rows; its height in the pad's rows, guessed and seen
  let cardSpans: Span[] = [] // the settings cards', while the page is open
  let lang: Lang = 'zh' // the picture's and the toasts' words; kept for every session
  const scroll = { p: 0, target: 0 } // the settings scroll: 0 rolled away, 1 over the whole picture
  let outfit: Outfit = { hat: 'sonnet', wand: 'medium' } // as the last request on the main loop asked
  let pomoUntil: number | undefined // the focus timer's end, while it runs (kept in the store: every session sees it)
  let fx: Fx = 'normal' // how often the picture redraws: eco half as often (battery), smooth twice
  let held: string | undefined // what the pointer pressed last: a drag moves that
  let draggedAt = 0 // when a slider last moved under a drag here
  let retuning = 0 // the music slider's latest move: the music follows it once it rests
  let compactAt = 0, compacting = false, compactArmed = true // 0 off, else compact the conversation once it is this full
  let soundOn = true // the moments' chirps, on unless /pixmage sound off (kept for every session)
  const music: Music = { on: true, away: true, shuffle: false } // on unless turned off (remembered for every session); quiet until it owns the music
  let readSettings = async () => {} // see session.start
  let tendMusic = async () => {} // see that one session, and only one, plays (every few seconds, and on any change)
  let musicKicked = false // started on the first desktop draw
  let seenPick = 0 // the last track pick (store music:pick) acted on here
  let claimed: string | undefined // the id this process last claimed the music under (a /clear gives it a new one)
  let cols = 60
  let onDesktop = false // the desktop band's Svg, redrawn each tick
  let working = false // a turn is running; idle, Clawd sleeps
  let timer: { cancel: () => void } | undefined
  let rolling: { cancel: () => void } | undefined // the settings scroll's own clock, while it rolls
  // What a press just changed, said in the picture for a moment (on the settings page's title line, else in the
  // message window) rather than in a toast, which the app heads with the mod's name.
  let notice: { text: string; until: number } | undefined
  const say = (text: string) => { notice = { text, until: Date.now() + 2500 } }
  // The focus timer lives in the shared store, so whichever session started it, each shows the same time left.
  let readPomo = async () => {}
  let budgetTimer: { cancel: () => void } | undefined
  const fine = 2 // the wizard's detailed world (the knight's, the first drawing, is put away until it is as fine)
  const info: Info = { limits: [], budget: null, scribe: rowMode === 'scribe' ? { writing: false } : undefined }
  let prompt = '' // this turn's words from the person, for the scribe
  let answer = '' // the last turn's reply: the scribe writes from it when switched on mid-chat
  const seen: Seen = { limitsAt: 0, budgetAt: 0, proxy: false }
  let syncTimer: { cancel: () => void } | undefined

  // The scribe row's icon: a moment (a level-up, a new line) for a few seconds, else what the turn is doing.
  let moment: { icon: IconName; until: number } | undefined
  let doing: IconName | undefined // a permission asked, a compaction
  const running = new Map<string, IconName>() // tools in flight, by call: several can run at once
  let lastActive = Date.now()
  const levelOn = new Set<number>() // monsters whose fall is a level-up
  const flash = (icon: IconName, ms: number) => { moment = { icon, until: Date.now() + ms } }
  const liveIcon = (): IconName | undefined => {
    const now = Date.now()
    if (moment && now < moment.until) return moment.icon
    if (doing) return doing
    if (running.size) return [...running.values()].pop() // the latest call still going
    if (working) return 'crystal'
    return now - lastActive > IDLE_MOON ? 'moon' : undefined
  }
  const withLive = () => { if (info.scribe) info.scribe = { ...info.scribe, live: liveIcon() } }

  on('session.start', async ($, e, next) => {
    const save = (await $.store.get('save')) as Save | undefined
    if (save) game = createGame(save)
    hidden = Boolean(await $.store.get(`hidden:${await $.session.id()}`))
    // As this chat was last dressed (a new chat, or a reload, is no longer the default blue hat till it asks).
    outfit = ((await $.store.get(`outfit:${await $.session.id()}`)) ?? (await $.store.get('outfit:last')) ?? outfit) as Outfit
    // The settings any session may change, read again with each sync so a change in one reaches them all
    // (the slider being dragged here is left alone).
    readSettings = async () => {
      soundOn = (await getKept($, 'sound')) !== false
      lang = ((await getKept($, 'lang')) as Lang | undefined) ?? 'zh'
      uiLang = lang
      info.clock = ((await getKept($, 'clock')) as Info['clock']) ?? {}
      info.week = ((await getKept($, 'week')) as Info['week']) ?? {}
      const mon = await getKept($, 'money') // true: an older save's spent-of-budget
      info.money = mon === true ? 'spent' : mon === 'spent' || mon === 'left' ? mon : undefined
      const today = await getKept($, 'today')
      info.today = today === 'daily' || today === 'reset' ? today : undefined
      const kept = await getKept($, 'compact') // a percent; true from before the percents meant 80
      if (!(held === 'compact' && Date.now() - draggedAt < 2000)) compactAt = kept === true ? 80 : typeof kept === 'number' ? kept : 0
      fx = ((await getKept($, 'fx')) as Fx | undefined) ?? ((await $.store.get('calm')) === true ? 'eco' : 'normal') // calm was eco, before there were three
      if (!(fx in FX_PACE)) fx = 'normal'
      const sfxVol = (await getKept($, 'volume:sfx')) as number | undefined
      if (sfxVol !== undefined && !(held === 'sfxVol' && Date.now() - draggedAt < 2000)) volume.sfx = sfxVol
    }
    await readSettings()
    debugOn = (await $.store.get('debug')) === true
    readPomo = async () => { const v = await getKept($, 'pomo'); pomoUntil = typeof v === 'number' && v > Date.now() ? v : undefined }
    await readPomo()
    music.on = (await getKept($, 'music')) !== false
    music.shuffle = (await getKept($, 'music:shuffle')) === true
    const old = Math.min(1, ((await $.store.get('volume')) as number | undefined) ?? 1) // one volume for both, before they split (older saves went up to 1.6)
    volume.music = ((await getKept($, 'volume:music')) as number | undefined) ?? old
    volume.sfx = ((await getKept($, 'volume:sfx')) as number | undefined) ?? old
    // macOS plays sound (afplay); Windows and Linux have no player in Claude Code.
    soundless = (await $.env.get('OS')) === 'Windows_NT' || !((await $.env.get('HOME')) ?? '').startsWith('/Users/')
    tendMusic = async () => {
      if (soundless) return // never claims the music, never writes its keys
      const sid = await $.session.id()
      // The settings, as any session last set them: the player picks them up here (volume and mode from its next track).
      const [wanted, shuffle, vol, owner, track, pick] = await Promise.all([getKept($, 'music'), getKept($, 'music:shuffle'), getKept($, 'volume:music'), $.store.get('music:owner'), getKept($, 'music:track'), getKept($, 'music:pick')]) as [unknown, unknown, number | undefined, Owner | null | undefined, string | undefined, number | undefined]
      music.on = wanted !== false
      music.shuffle = shuffle === true
      if (track && (music.away || !music.stop)) music.track = track // shown on the settings page
      const louder = vol !== undefined && vol !== volume.music // another session moved the music's slider
      if (vol !== undefined) volume.music = vol
      const mine = !!owner && (owner.id === sid || owner.id === claimed), alive = !!owner && Date.now() - owner.beat < OWNER_STALE
      if (!music.on || music.failed || (alive && !mine)) { // off, failed here, or another session plays: quiet here (and let another play)
        if (mine) await $.store.set('music:owner', null)
        if (!music.away || music.stop) { music.away = true; void playMusic($, music) }
        return
      }
      if (!onDesktop && !musicKicked) return // only a session drawn on the desktop plays (not a terminal or -p run)
      claimed = sid
      await $.store.set('music:owner', { id: sid, beat: Date.now() } satisfies Owner) // ours: claimed, or still ours
      const picked = typeof pick === 'number' && pick > seenPick // another session picked a track: play it now
      if (typeof pick === 'number') seenPick = Math.max(seenPick, pick)
      if (picked && track) { music.track = track; music.away = false; void playMusic($, music) }
      else if (music.away || !music.stop) { music.away = false; void playMusic($, music, false, undefined, true) } // taking over: from where it was
      else if (louder) retune($, music)
    }
    music.track = (await getKept($, 'music:track')) as string | undefined // the same track as last time
    titles = await $.fs.read(`${$.plugin.root}/music/titles.json`).then(t => JSON.parse(t) as Record<string, string>, () => ({}))
    seenPick = ((await getKept($, 'music:pick')) as number | undefined) ?? 0
    await $.command.register({ name: 'pixmage', description: t(lang, 'cmdDesc'), argumentHint: '[off | sound on|off | clock 24|12|left | compact on|off]', immediate: true })

    const usage = await $.session.usage()
    info.ctx = usage.context.percent
    // Rate limits arrive with a reply, so a new session has none yet: the newest any session saw stands in.
    info.limits = usage.rateLimits
    const base = await $.env.get('ANTHROPIC_BASE_URL')
    seen.proxy = Boolean(base && !base.includes('anthropic.com'))
    await refreshBudget($, game.save, info, seen) // syncs the save and the limits too
    workLogHere = await hasWorkLog($)
    if (options.infoRow === 'auto' && workLogHere) rowMode = 'work-log'
    const row = (await $.store.get(`row:${await $.session.id()}`)) as RowMode | undefined
    if (row === 'todo' || row === 'scribe' || (row === 'work-log' && workLogHere)) rowMode = row
    if (rowMode === 'work-log' && !workLogHere) rowMode = 'todo'
    await loadRow($, info, rowMode, tasks)

    game.perform('stretch', ACTION_TICKS)

    timer?.cancel()
    let frame = 0
    let shown = '' // what the picture's numbers said when last drawn
    timer = $.clock.every(100, () => {
      const ev = game.step(), loud = soundOn && !hidden
      for (const kind of ev.cast) { const s = CAST[kind]; if (s) sfx($, loud, s) }
      for (const kind of ev.hit) { const s = BLOW[kind]; if (s) sfx($, loud, s) }
      for (const id of ev.fell) {
        const kind = game.mobs.find(m => m.id === id)?.kind // still on screen, dying
        if (kind) {
          const blow = BLOW[kind]
          if (blow) sfx($, loud, blow) // the last blow lands as it falls
          sfx($, loud, FALL[kind][Math.floor(Math.random() * FALL[kind].length)]!)
        }
        if (!levelOn.delete(id)) continue
        sfx($, soundOn && !hidden, 'levelup')
        $.ui.toast(t(lang, 'levelUp', game.save.level))
        game.perform('level', ACTION_TICKS)
        flash('chest', 3500)
      }
      frame += 1
      if (pomoUntil !== undefined && Date.now() >= pomoUntil) { // the focus timer ran out: a chime, and a word
        pomoUntil = undefined
        void $.store.set('pomo', null)
        if (onDesktop && !hidden) { // the word and the flame in every session; the chime from the one last looked at only
          say(t(lang, 'pomoDone')); flash('campfire', 4000)
          void Promise.all([$.store.get('focus:last'), $.session.id()]).then(([last, id]) => { if (!last || last === id) sfx($, soundOn, 'pomodoro') }).catch(() => {})
        }
      }
      if (notice && Date.now() > notice.until) { notice = undefined; if (!hidden && onDesktop) $.ui.invalidate('ui.render') }
      if (hidden) return
      // Desktop redraws a whole image per frame, and each costs the app memory: 5 fps while working, ~3 just
      // after, ~1.7 idle a while, then once a minute (the sky and the moon icon still turn), then none.
      const busy = working || game.acting() || game.mobs.length > 0
      const idleFor = busy ? 0 : Date.now() - lastActive
      const every = Math.max(1, Math.round((busy ? 2 : idleFor > IDLE_FREEZE ? 600 : idleFor > IDLE_SLOW ? 6 : 3) * FX_PACE[fx]))
      // Held still or stopped, it still redraws once its numbers move (usage, kills, the work log).
      const numbers = frame % 10 === 0 ? JSON.stringify([info.limits, info.budget, info.ctx, game.save, info.workLog, pomoUntil && Math.ceil((pomoUntil - Date.now()) / 1000)]) : shown
      const moved = numbers !== shown
      if (onDesktop && (moved || (idleFor <= IDLE_STOP && frame % every === 0))) {
        shown = numbers
        $.ui.invalidate('ui.render')
      }
    })
    budgetTimer?.cancel()
    syncTimer?.cancel()
    // Every few seconds: the other sessions' kills and readings, and the focus timer one of them may have started or stopped.
    syncTimer = $.clock.every(SYNC_EVERY, () => { void sync($, game.save, info, seen); void readPomo(); void readSettings(); void tendMusic(); void flushDebug($) })
    budgetTimer = $.clock.every(BUDGET_EVERY, () => {
      void refreshBudget($, game.save, info, seen)
      if (rowMode === 'work-log') void readWorkLog($).then(w => { info.workLog = w })
    })
    return next(e)
  })

  // After each turn: the window's fill, the rate limits, and (a moment later, once booked) the proxy's spend.
  on('session.measure', async ($, e, next) => {
    info.ctx = e.context.percent
    if (e.rateLimits.length) {
      info.limits = e.rateLimits
      seen.limitsAt = Date.now()
      await $.store.set('usage:limits', { at: seen.limitsAt, value: e.rateLimits } satisfies Stamped<Limit[]>)
    }
    if (rowMode === 'work-log') info.workLog = await readWorkLog($)
    if ((info.ctx ?? 0) < compactAt - 5) compactArmed = true // well under again: the next fill may compact
    if (compactAt && !compacting && compactArmed && (info.ctx ?? 0) >= compactAt) {
      compacting = true
      compactArmed = false // once per fill, even if it stays over (a failed or small compaction)
      $.ui.toast(t(lang, 'compacting', Math.round(info.ctx!)))
      void $.session.compact().finally(() => { compacting = false })
    }
    if (e.changed.includes('cost')) {
      $.clock.after(BUDGET_SETTLE, () => void refreshBudget($, game.save, info, seen, true))
    }
    return next(e)
  })

  // Subagents, as they start and stop (in the foreground or the background): the black cat wakes to help while
  // any runs, springs as each finishes, and each finished is worth a boss's xp.
  const helpers = new Set<string>()
  on('classic.SubagentStart', async ($, e, next) => {
    if (!helpers.has(e.agent_id)) { helpers.add(e.agent_id); game.agentStart(); lastActive = Date.now() }
    return next(e)
  })
  on('classic.SubagentStop', async ($, e, next) => {
    if (helpers.delete(e.agent_id)) {
      lastActive = Date.now()
      const shared = (await $.store.get('save')) as Save | undefined
      if (shared) Object.assign(game.save, shared)
      if (game.agentEnd(true)) { $.ui.toast(t(lang, 'levelUp', game.save.level)); game.perform('level', ACTION_TICKS); flash('chest', 3500); sfx($, soundOn && !hidden, 'levelup') }
      sfx($, soundOn && !hidden, 'star_hit')
      await $.store.set('save', { ...game.save })
      if (!hidden && onDesktop) $.ui.invalidate('ui.render')
    }
    return next(e)
  })

  // Every tool call spawns a monster of its kind; it dies when the call succeeds and runs off when it fails.
  // Claude's task list, as its tools set it: TodoWrite gives the whole list; TaskUpdate one task's state.
  const readTasks = (a: Record<string, unknown>) => {
    if (a.tool === 'TodoWrite' && Array.isArray(a.todos)) {
      tasks.clear()
      ;(a.todos as { content?: string; activeForm?: string; status?: string }[]).forEach((x, i) => tasks.set(`w${i}`, { text: String(x.content ?? ''), active: x.activeForm, status: x.status === 'completed' ? 'done' : x.status === 'in_progress' ? 'doing' : 'todo' }))
      showTasks()
      return true
    } else if (a.tool === 'TaskUpdate' && typeof a.taskId === 'string') {
      const t0 = tasks.get(a.taskId) ?? { text: String(a.subject ?? ''), status: 'todo' as const }
      if (a.status === 'deleted') tasks.delete(a.taskId)
      else tasks.set(a.taskId, { ...t0, text: typeof a.subject === 'string' ? a.subject : t0.text, active: typeof a.activeForm === 'string' ? a.activeForm : t0.active, status: a.status === 'completed' ? 'done' : a.status === 'in_progress' ? 'doing' : t0.status })
      showTasks()
      return true
    }
    return false
  }
  on('classic.TaskCreated', async ($, e, next) => {
    if (!tasks.has(e.task_id)) tasks.set(e.task_id, { text: e.task_subject, status: 'todo' })
    showTasks()
    if (rowMode === 'todo' && onDesktop && !hidden) $.ui.invalidate('ui.render')
    return next(e)
  })
  on('classic.TaskCompleted', async ($, e, next) => {
    const t0 = tasks.get(e.task_id)
    tasks.set(e.task_id, { ...(t0 ?? { text: e.task_subject }), status: 'done' })
    showTasks()
    if (rowMode === 'todo' && onDesktop && !hidden) $.ui.invalidate('ui.render')
    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    // A subagent: no monster. The cat counts it from SubagentStart to SubagentStop (below), which also covers
    // one sent to the background, whose Agent call returns at once.
    if (e.tool === 'Agent') { lastActive = Date.now(); return next(e) }
    if (readTasks(e as unknown as Record<string, unknown>) && rowMode === 'todo' && onDesktop && !hidden) $.ui.invalidate('ui.render')
    const id = game.spawn(kindFor(e.tool), cols)
    sfx($, soundOn && !hidden, 'spawn')
    running.set(e.tool_use_id, toolIcon(String(e.tool)))
    let asked = false // the dialog put this call to the person
    const result = await next(e).finally(() => {
      running.delete(e.tool_use_id)
      if (doing === 'key') { asked = true; doing = undefined } // the permission was answered
    })
    const ok = result.deny === undefined && result.isError !== true
    game.endAction('ask') // the call went ahead (or was refused): no longer waiting on you
    // Refused: by a plugin or a rule (deny), or by the person in the dialog (it comes back as an error).
    if (result.deny !== undefined || (asked && result.isError === true)) { flash('shield', 2500); game.ward(); sfx($, soundOn && !hidden, 'refused') }
    const shared = (await $.store.get('save')) as Save | undefined
    if (shared) Object.assign(game.save, shared) // add this kill to the one tally, not over another session's
    const leveled = game.kill(id, ok)
    const tally = { ...game.save } // as it stands now: a sync landing meanwhile must not change what is written
    if (leveled) levelOn.add(id) // the fanfare waits for this monster to fall
    else if (ok && kindFor(e.tool) === 'boss') flash('gem', 3000)
    await $.store.set('save', tally)
    return result
  })

  // A switch of model (/model, the picker) dresses Clawd at once, before anything is sent: the hat follows the
  // model, the wand stays until the next request says what effort it asks for.
  on('classic.PostModelSwitch', async ($, e, next) => {
    const hat = outfitOf(e.to_model, undefined).hat
    if (hat !== outfit.hat) {
      outfit = { ...outfit, hat }
      void $.store.set(`outfit:${await $.session.id()}`, outfit); void $.store.set('outfit:last', outfit)
      if (!hidden && onDesktop) $.ui.invalidate('ui.render')
    }
    return next(e)
  })

  // Each request on the main loop dresses Clawd for its model and effort.
  on('turn.step', async function* ($, e, next) {
    if (e.agentId === undefined) {
      const worn = outfitOf(e.model, e.effort)
      if (worn.hat !== outfit.hat || worn.wand !== outfit.wand) { outfit = worn; void $.store.set(`outfit:${await $.session.id()}`, worn); void $.store.set('outfit:last', worn) }
    }
    return yield* next(e)
  })

  on('turn.start', ($, e, next) => {
    prompt = e.text
    lastActive = Date.now()
    if (e.text.trim()) game.perform('scroll', ACTION_TICKS)
    // Your words unroll a scroll; a turn nobody typed (a task's notice) arrives as a letter.
    flash(e.text.trim() ? 'scroll' : 'envelope', 1500)
    return next(e)
  })

  // A turn that ends, answered or stopped, leaves no call running: clear any monster still waiting.
  on('turn.complete', ($, e, next) => {
    if (e.agentId === undefined) {
      // Still asking when the turn ended: the person refused and stopped it there.
      if (doing === 'key') { flash('shield', 2500); game.ward(); sfx($, soundOn && !hidden, 'refused') }
      game.fleeAll()
      game.endAction('ask')
      doing = undefined
      running.clear()
      lastActive = Date.now()
      if (!e.isAborted) answer = e.answer
      if (!e.isAborted) sfx($, soundOn && !hidden, 'done')
      if (info.scribe && !e.isAborted) void writeScribe($, info, prompt, e.answer, lang).then(fresh => { if (fresh) flash('bulb', 2500) })
    }
    return next(e)
  })


  // A tool call put to the person: Clawd raises a "!" until it goes ahead or the turn ends.
  on('tool.check', async ($, e, next) => {
    const verdict = await next(e)
    if (verdict.decision === 'ask') {
      game.perform('ask', Infinity)
      doing = 'key'
    }
    return verdict
  })

  // Compaction (/compact or automatic): Clawd packs memories into a box while it runs.
  on('session.compact', async ($, e, next) => {
    game.perform('pack', Infinity)
    doing = 'hourglass'
    try {
      return await next(e)
    } finally {
      doing = undefined
      game.endAction('pack', ACTION_TICKS / 3) // let the box close
    }
  })

  // Moving between sessions leaves the music playing where it is; a session come back to catches up on the focus timer.
  on('session.attach', async ($, e, next) => {
    if (e.surface === 'desktop') { void readPomo(); void tendMusic(); void $.session.id().then(id => $.store.set('focus:last', id)).catch(() => {}) } // the session looked at last rings the focus chime
    return next(e)
  })
  on('session.end', async ($, e, next) => {
    const focus = await $.store.get('focus:last')
    if (e.reason === 'clear' || e.reason === 'resume') { // the process goes on under a new id: the music plays on, the chime follows
      if (focus === (await $.session.id())) $.clock.after(1000, () => void $.session.id().then(id => $.store.set('focus:last', id)).catch(() => {}))
      const owner = (await $.store.get('music:owner')) as Owner | null | undefined
      if (owner && (owner.id === (await $.session.id()) || owner.id === claimed)) await $.store.set('music:owner', { ...owner, beat: 0 }) // if this process is replaced, the new one takes over at once (from the same place)
      return next(e)
    }
    if (focus === (await $.session.id())) await $.store.set('focus:last', null) // another session rings the chime
    stopMusic(music)
    const owner = (await $.store.get('music:owner')) as Owner | null | undefined
    if (owner && (owner.id === (await $.session.id()) || owner.id === claimed)) await $.store.set('music:owner', null) // another session takes over
    return next(e)
  })

  // A click on the pad: a key along the top row, else (the settings page open) a card, else the status bar's reset time.
  on('ui.message', async ($, e) => {
    const started = Date.now()
    try {
      const d = e.data as { x: number; y: number; cols: number; rows: number; drag?: true } | { bottom: number; whole?: true }
      if ('bottom' in d) { if (d.whole) { if (d.bottom > padRow) dlog(`hover row ${d.bottom - 1} size=${padSize} guess=${guessRows.toFixed(2)}`); padRow = Math.max(padRow, d.bottom) } else padBottom = Math.max(padBottom, d.bottom); return {} } // the lowest the pointer hovered (reset with the size)
      const f = d.x / d.cols
      // The guess from the picture's width, unless the pointer was seen lower: it may not have reached the bottom yet
      // (a narrower slot, as when the sidebar opens, forgets what was seen), so what it saw only ever makes the picture taller.
      const tall = Math.max(guessRows, padBottom, padRow - 0.95) // the picture's height, in the pad's rows (the pointer seen only near the top says nothing yet)
      const y = (d.y / tall) * textRows * 2 * TEXT_PX // how far down the picture, in the text layer's pixels
      const row = Math.floor(y / (2 * TEXT_PX)) // which text row of the picture
      // A drag keeps to the slider it started on, even off its bar.
      const what = d.drag ? held : (y < 28 ? keyAt.find(k => f >= k.from - 0.005 && f <= k.to + 0.005)?.id : undefined)
        ?? (scroll.target === 1 ? cardAt(cardSpans, f, y) : undefined)
        ?? (scroll.target !== 1 && row >= textRows - 2 ? statusAt.find(s => f >= s.from - 0.01 && f <= s.to + 0.01)?.id : undefined) // the status bar's reset time
        ?? (scroll.target !== 1 && row >= 2 && row < textRows - 3 ? pokeAt(cols, f) : undefined) // Clawd or the cat, for a little reaction
        dlog(`click ${what ?? '-'} f=${f.toFixed(3)} y=${y.toFixed(0)} row=${row}${d.drag ? ' drag' : ''} tall=${tall.toFixed(2)}/${guessRows.toFixed(2)} pad=${d.rows}`)
      if (soundless && ['music', 'sound', 'musicVol', 'sfxVol', 'track', 'shuffle'].includes(what ?? '')) { if (!d.drag) say(t(lang, 'noSound')); return {} } // nothing to set here
    if (!d.drag) held = what
      else draggedAt = Date.now()
      if (!what || (d.drag && what !== 'compact' && what !== 'musicVol' && what !== 'sfxVol')) return {} // a drag only moves a slider
      lastActive = Date.now() // a press wakes the picture, which may have stopped while idle
      if (what === 'gear') { scroll.target = scroll.target === 1 ? 0 : 1; rolling = rollScroll($, scroll, rolling, () => { lastActive = Date.now(); if (!hidden && onDesktop) $.ui.invalidate('ui.render') }) }
      if (what === 'hide' && scroll.target === 1) { scroll.target = 0; rolling = rollScroll($, scroll, rolling, () => { lastActive = Date.now(); if (!hidden && onDesktop) $.ui.invalidate('ui.render') }) } // on the settings page the cross closes the page
      else if (what === 'hide') { hidden = true; scroll.target = scroll.p = 0; void storeHidden($, true).catch(() => {}); $.ui.toast(t(lang, 'hidden')) }
      if (what === 'sound') { soundOn = !soundOn; keep($, 'sound', soundOn); say(t(lang, soundOn ? 'soundOn' : 'soundOff')) }
      if (what === 'music') { music.on = !music.on; music.failed = false; keep($, 'music', music.on); void tendMusic(); say(t(lang, music.on ? 'musicOn' : 'musicOff')) }
      if (what === 'track') { // the next track, by name, played at once so it can be heard
        const list = await musicTracks($)
        if (list.length) {
          const next = list[(list.indexOf(music.track ?? '') + 1) % list.length]!
          music.track = next
          keep($, 'music:track', next)
          const now = Date.now()
          seenPick = now
          keep($, 'music:pick', now)
          if (music.on && music.stop) void playMusic($, music) // ours: straight away; another's picks it up within its sync
          else if (music.on) void tendMusic()
          say(`${ICON.note} ${trackTitle(next)}`)
        }
      }
      if (what === 'shuffle') { music.shuffle = !music.shuffle; keep($, 'music:shuffle', music.shuffle); say(`${t(lang, 'playMode')}：${t(lang, music.shuffle ? 'shuffle' : 'repeat')}`) }
      if (what === 'clock') {
        info.clock = info.clock?.countdown ? {} : info.clock?.h12 ? { countdown: true } : { h12: true } // 24 → 12 → time left → 24
        keep($, 'clock', info.clock)
        say(`${t(lang, 'clockLabel')}：${t(lang, info.clock.countdown ? 'clockLeft' : info.clock.h12 ? 'clock12' : 'clock24')}`)
      }
      if (what === 'money') { // MON: the share → spent of the budget → what is left
        const ms: (MonStyle | undefined)[] = [undefined, 'spent', 'left']
        info.money = ms[(ms.indexOf(info.money) + 1) % ms.length]
        keep($, 'money', info.money ?? null)
        say(`MON：${t(lang, info.money === 'left' ? 'monLeft' : info.money ? 'monSpent' : 'monPct')}`)
      }
      if (what === 'today') { // TODAY: today's spend → each day's share of what is left → the reset day
        const ts: (TodayStyle | undefined)[] = [undefined, 'daily', 'reset']
        info.today = ts[(ts.indexOf(info.today) + 1) % ts.length]
        keep($, 'today', info.today ?? null)
        say(`TODAY：${t(lang, info.today === 'daily' ? 'todayDaily' : info.today === 'reset' ? 'todayReset' : 'todaySpent')}`)
      }
      if (what === 'pomo') { // the hourglass: start 25 minutes, or (running) stop
        pomoUntil = pomoUntil === undefined ? Date.now() + POMO_MS : undefined
        keep($, 'pomo', pomoUntil ?? null)
        say(t(lang, pomoUntil ? 'pomoStart' : 'pomoStop'))
      }
      if (what === 'week') { // the 7-day reset, on its own: weekday → date → time left → weekday
        info.week = info.week?.countdown ? {} : info.week?.date ? { countdown: true } : { date: true }
        keep($, 'week', info.week)
        say(`${t(lang, 'weekLabel')}：${t(lang, info.week.countdown ? 'clockLeft' : info.week.date ? 'weekDate' : 'weekDay')}`)
      }
      if (what === 'compact') { // along the slider: the step there; elsewhere on the bar: the next step
        const at = sliderAt(cardSpans, 'compact', f)
        const next = at !== undefined ? COMPACT_STEPS[Math.round(at * (COMPACT_STEPS.length - 1))]! : d.drag ? compactAt : COMPACT_STEPS[(COMPACT_STEPS.indexOf(compactAt) + 1) % COMPACT_STEPS.length]!
        if (next === compactAt) return {}
        compactAt = next
        keep($, 'compact', compactAt) // written once the drag stops
        say(`${t(lang, 'compact')}：${compactAt ? `${compactAt}%` : t(lang, 'off')}`)
      }
      if (what === 'clawd' || what === 'cat' || what === 'castle') game.poke(what)
      if (what === 'fx') { fx = FXS[(FXS.indexOf(fx) + 1) % FXS.length]!; keep($, 'fx', fx); say(`${t(lang, 'fx')}：${t(lang, FX_WORD[fx])}`) }
      if (what === 'musicVol' || what === 'sfxVol') { // along the slider: the step there; elsewhere on the bar: the next step
        const key = what === 'musicVol' ? 'music' : 'sfx'
        const at = sliderAt(cardSpans, what, f), now = volumeStep(volume[key])
        const step = at !== undefined ? Math.round(at * (VOLUMES.length - 1)) : d.drag ? now : (now + 1) % VOLUMES.length
        if (step === now) return {}
        volume[key] = VOLUMES[step]!
        keep($, `volume:${key}`, volume[key]) // written once the drag stops
        if (key === 'sfx') sfx($, soundOn, 'spawn') // a sound at the new loudness (at most every half second, dragged)
        else { const n = ++retuning; void $.clock.sleep(300).then(() => { if (n === retuning) retune($, music) }) } // the music, once the slider rests
        say(`${t(lang, key === 'music' ? 'music' : 'sound')}：${Math.round(volume[key] * 100)}%`)
      }
      if (what === 'lang') { lang = nextLang(lang); uiLang = lang; keep($, 'lang', lang); say(t(lang, 'langSet')) }
      if (what === 'row') {
        const modes: RowMode[] = workLogHere ? ['todo', 'scribe', 'work-log'] : ['todo', 'scribe']
        rowMode = modes[(modes.indexOf(rowMode) + 1) % modes.length]!
        void storeRow($, rowMode).catch(() => {})
        await loadRow($, info, rowMode, tasks)
        say(t(lang, rowMode === 'scribe' ? 'scribeOn' : rowMode === 'todo' ? 'todoOn' : 'scribeOff'))
        if (info.scribe && answer) void writeScribe($, info, prompt, answer, lang).then(fresh => { if (fresh) { flash('bulb', 2500); $.ui.invalidate('ui.render') } })
      }
      $.ui.invalidate('ui.render')
      return {}
    } catch (err) {
      dlog(`click failed: ${String(err)}`) // a click that throws must not stop the next ones
      return {}
    } finally {
      if (Date.now() - started > 50) dlog(`click took ${Date.now() - started} ms`)
    }
  })

  // /pixmage shows the band, /pixmage off hides it: no toggle to land on the wrong side of.
  on('command.run', { command: 'pixmage' }, async ($, e) => {
    const clock = /^clock\s*(24|12|left)?$/i.exec(e.args.trim())
    if (clock) {
      const want = clock[1]?.toLowerCase()
      info.clock = want === '12' ? { h12: true } : want === 'left' ? { countdown: true } : {}
      await $.store.set('clock', info.clock)
      $.ui.invalidate('ui.render')
      return { text: t(lang, want === '12' ? 'cmdClock12' : want === 'left' ? 'cmdClockLeft' : 'cmdClock24') }
    }
    const dbg = /^debug\s*(on|off)?$/i.exec(e.args.trim())
    if (dbg) {
      debugOn = dbg[1] ? dbg[1].toLowerCase() === 'on' : !debugOn
      await $.store.set('debug', debugOn)
      if (debugOn) { dlog(`debug on: cols=${cols} textRows=${textRows} guessRows=${guessRows.toFixed(2)} padBottom=${padBottom}`); await flushDebug($) }
      return { text: debugOn ? `Debug log on: ${$.plugin.root}/debug.log (refreshed every 5 s). /pixmage debug off stops it.` : 'Debug log off.' }
    }
    const compact = /^compact\s*(on|off)?$/i.exec(e.args.trim())
    if (compact) {
      compactAt = (compact[1] ? compact[1].toLowerCase() === 'on' : !compactAt) ? 80 : 0
      await $.store.set('compact', compactAt)
      return { text: compactAt ? t(lang, 'cmdCompactOn', compactAt) : t(lang, 'cmdCompactOff') }
    }
    const sound = /^sound\s*(on|off)?$/i.exec(e.args.trim())
    if (sound && soundless) return { text: t(lang, 'noSound') }
    if (sound) {
      soundOn = sound[1] ? sound[1].toLowerCase() === 'on' : !soundOn
      await $.store.set('sound', soundOn)
      if (!soundOn && music.on) { music.on = false; await $.store.set('music', false); void tendMusic() }
      $.ui.invalidate('ui.render')
      return { text: t(lang, soundOn ? 'cmdSoundOn' : 'cmdSoundOff') }
    }
    hidden = e.args.trim().toLowerCase() === 'off'
    await storeHidden($, hidden)
    $.ui.invalidate('ui.render')
    const s = game.save
    return { text: t(lang, hidden ? 'cmdHide' : 'cmdShow', s.level, s.xp, need(s.level), s.kills) }
  })


  on('ui.render', { component: 'AbovePrompt' }, ($, e, next) => {
    working = e.props.isWorking
    if (hidden || e.props.hasSurvey) {
      onDesktop = false
      return next(e)
    }


    if (e.surface === 'desktop') {
      const renderStart = Date.now()
      const { Box, Client, Svg } = $.ui.resolve(e)
      // Wider than the slot on purpose: the Svg shrinks to the slot's width, so it always fills it.
      cols = Math.min(Math.max(e.props.bodyColumns, DESKTOP_COLS), 100)
      onDesktop = true
      withLive()
      const now = new Date()
      // Like an RPG message window: a longer line wraps and the window grows to hold it.
      const base = game.scene(cols, !working, [], fine, true, { hud: false, outfit })
      statusAt = []
      const drawn = withStatusBar(withStrip(base, notice && scroll.target !== 1 ? [[{ text: `${ICON.star} ${notice.text}`, color: 0xffd75f }], [{ text: '', color: 0 }]] : stripRows(info, now, cols - 10, lang)), statusSegs(info, game.save, need(game.save.level), now, game.agentsRunning(), pomoUntil === undefined ? undefined : Math.max(0, pomoUntil - Date.now()), lang), now.getTime(), statusAt)
      // The settings page, unrolled over the picture (the keys stay on top of it).
      const clockWord = info.clock?.countdown ? 'clockLeft' : info.clock?.h12 ? 'clock12' : 'clock24'
      const clocks = (['clock24', 'clock12', 'clockLeft'] as const).map(w => t(lang, w)), weeks = (['weekDay', 'weekDate', 'clockLeft'] as const).map(w => t(lang, w))
      const weekWord = info.week?.countdown ? 'clockLeft' : info.week?.date ? 'weekDate' : 'weekDay'
      const pct = (v: number) => `${Math.round(v * 100)}%`
      const monWord = info.money === 'left' ? 'monLeft' : info.money ? 'monSpent' : 'monPct', mons = (['monPct', 'monSpent', 'monLeft'] as const).map(w => t(lang, w))
      const todayWord = info.today === 'daily' ? 'todayDaily' : info.today === 'reset' ? 'todayReset' : 'todaySpent', todays = (['todaySpent', 'todayDaily', 'todayReset'] as const).map(w => t(lang, w))
      const cards: Card[] = [
        ...(soundless ? [] : [ // no player here (Windows, Linux): no sound group at all
          { id: 'musicVol', mute: 'music', muted: !music.on, icon: 'setVolume', label: t(lang, 'music'), value: pct(volume.music), slider: volumeStep(volume.music) / (VOLUMES.length - 1) },
          { id: 'sfxVol', mute: 'sound', muted: !soundOn, icon: 'setVolume', label: t(lang, 'sound'), value: pct(volume.sfx), slider: volumeStep(volume.sfx) / (VOLUMES.length - 1) },
          { id: 'track', mute: 'shuffle', muted: false, icon: music.shuffle ? 'setShuffle' : 'setTracks', label: t(lang, 'playMode'), value: clip(trackTitle(music.track), 11) }, // the key: repeat or shuffle; the name: the next track
        ] satisfies Card[]),
        { id: 'row', icon: rowMode === 'scribe' ? 'quill' : rowMode === 'todo' ? 'memo' : 'calendar', label: t(lang, 'rowLabel'), value: t(lang, rowMode === 'scribe' ? 'scribe' : rowMode === 'todo' ? 'todo' : 'worklog') },
        ...(info.budget ? [ // through a gateway (LiteLLM): no 5H or 7D, but the month's budget and today, in their places
          { id: 'money', icon: 'coin', label: t(lang, 'monLabel'), value: t(lang, monWord), choices: mons },
          { id: 'today', icon: 'calendar', label: t(lang, 'todayLabel'), value: t(lang, todayWord), choices: todays },
        ] satisfies Card[] : [
          { id: 'clock', icon: 'hourglass', label: t(lang, 'clockLabel'), short: '5H', value: t(lang, clockWord), choices: clocks },
          { id: 'week', icon: 'calendar', label: t(lang, 'weekLabel'), short: '7D', value: t(lang, weekWord), choices: weeks },
        ] satisfies Card[]),
        { id: 'compact', icon: 'setCompact', label: t(lang, 'compact'), value: compactAt ? `${compactAt}%` : t(lang, 'off'), slider: Math.max(COMPACT_STEPS.indexOf(compactAt), 0) / (COMPACT_STEPS.length - 1) },
        { id: 'lang', icon: 'setLang', label: t(lang, 'lang'), value: t(lang, 'langName') },
        { id: 'fx', icon: 'setMotion', label: t(lang, 'fx'), value: t(lang, FX_WORD[fx]), choices: FXS.map(x => t(lang, FX_WORD[x])) },
      ]
      const heads = [...(soundless ? [] : [t(lang, 'secSound')]), t(lang, 'secShow'), t(lang, 'secGeneral')] // layout A (B is kept in settings.ts, unused)
      const paged = withScroll(drawn, scroll.p >= 1 ? 1 : 1 - (1 - scroll.p) ** 2, notice?.text ?? t(lang, 'title'), cards, 'A', heads) // eased out
      const scene = paged.scene
      cardSpans = paged.cards
      const spots = [
        ...withButtons(scene, CLOSE.map(([, icon]) => icon), 'left'),
        ...withButtons(scene, CONTROLS.map(([, icon]) => icon), 'right'),
      ]
      const ids = [...CLOSE, ...CONTROLS].map(([id]) => id)
      keyAt = spots.map((k, i) => ({ id: ids[i]!, from: k.col / cols, to: (k.col + k.w) / cols }))
      // The click pad covers the picture: rows enough for its height (a row about twice a column tall).
      // The click pad covers the picture. Its height in rows is a guess at first (a row about 2.4 columns tall),
      // and the lowest row the pointer is seen on corrects it (padBottom); the pad itself is made taller and clipped.
      const size = `${e.props.bodyColumns}x${cols}x${scene.px.length}`
      if (size !== padSize) { dlog(`resize ${padSize} -> ${size}`); padSize = size; padBottom = padRow = -1 } // a new size: the bottom seen before no longer holds
      textRows = scene.px.length / (cols * fine * fine) / 2
      guessRows = (e.props.bodyColumns * textRows * 2) / cols / (soundless ? 2.45 : 2.19) // a row's height in columns: 2.45 on Windows (measured to a fraction, 2026-11-26); 2.19 in the Mac app, which sends whole rows only (worked back from the clicks logged 2026-11-27: the picture 10.35–11 rows at 85 columns)
      const padRows = Math.ceil(guessRows * 1.3) + 1
      if (Date.now() - renderStart > 40) dlog(`frame took ${Date.now() - renderStart} ms${scroll.p > 0 ? ' (settings)' : ''}`)
      if (!musicKicked) { musicKicked = true; void tendMusic(); void $.session.id().then(id => $.store.set('focus:last', id)).catch(() => {}) } // the first session drawn plays, unless another already does; the one drawn last rings the chime
      return (
        // overflow hidden: the pad runs taller than the picture, and must not make the band scroll
        <Box overflow="hidden">
          <Svg source={toSvg(scene, 12, now.getTime())} alt={`Pixmage: Lv ${game.save.level}, ${game.save.kills} slain`} />
          {/* A see-through click pad over the whole picture: it says where a click lands, and the keys and the
              settings cards are found from that (ui.message). */}
          <Box key="pad-wrap" position="absolute" top={0} left={0} width="100%">
            <Client key="pad" module="./clickpad.tsx" props={{ rows: padRows }} width="100%" height={padRows} />
          </Box>
        </Box>
      )
    }

    // The terminal draws nothing of ours: the band is for the app's and the phone's pictures alone.
    return next(e)
  })
}
