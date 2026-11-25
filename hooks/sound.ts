// Sounds: soft chirps for the game's moments, and the music folder played as a shuffled playlist.

import type { Kind } from './game'

// Every clip in sounds/ is levelled alike (tools: sounds/make.py, the CREDITS); these place each a little under
// or over the rest. At about 0.13 a clip sounds some 4 dB over the music (music/levels.json).
export const GAIN = {
  spawn: 0.1, levelup: 0.14, refused: 0.11, done: 0.1, pomodoro: 0.08,
  spell_fire: 0.17, spell_zap: 0.13, spell_frost: 0.13, frost_hit: 0.2, spell_holy: 0.14, spell_star: 0.13, star_hit: 0.13,
  fall_slime: 0.13, fall_bat: 0.13, fall_mushroom: 0.13, fall_ghost: 0.13, fall_boss_a: 0.13, fall_boss_b: 0.14,
} as const
export type Sfx = keyof typeof GAIN
export const MUSIC_GAIN = 0.15 // a track music/levels.json does not list (run tools/levels.py after adding one)

// Each foe's spell: a sound as it leaves the wand, one as each blow lands, and the foe's own as it falls.
export const CAST: Partial<Record<Kind, Sfx>> = { bat: 'spell_zap', mushroom: 'spell_frost', ghost: 'spell_holy', boss: 'spell_star' }
export const BLOW: Partial<Record<Kind, Sfx>> = { slime: 'spell_fire', mushroom: 'frost_hit', boss: 'star_hit' }
export const FALL: Record<Kind, readonly Sfx[]> = {
  slime: ['fall_slime'], bat: ['fall_bat'], mushroom: ['fall_mushroom'], ghost: ['fall_ghost'], boss: ['fall_boss_a', 'fall_boss_b'],
}
export const SOUND_GAP = 500 // the same sound at most once in this many ms: a burst of calls makes one chirp

// True (and noted) when `name` may play at `now`.
export function gate(last: Map<string, number>, name: string, now: number) {
  if (now - (last.get(name) ?? -Infinity) < SOUND_GAP) return false
  last.set(name, now)
  return true
}

// A track other than the current one, at random; the same one only when it is the only one.
export function nextTrack(tracks: readonly string[], current?: string, rand = Math.random) {
  const pool = tracks.length > 1 ? tracks.filter(t => t !== current) : tracks
  return pool[Math.floor(rand() * pool.length)]
}
