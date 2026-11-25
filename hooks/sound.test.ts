import { expect, test } from 'claude-code/testing'

import { BLOW, CAST, FALL, GAIN, gate, nextTrack } from './sound'

test('the same sound plays at most once every half second, others are not held up', async () => {
  const last = new Map<string, number>()
  expect(gate(last, 'spawn', 1000)).toBe(true)
  expect(gate(last, 'spawn', 1200)).toBe(false) // three calls at once: one chirp
  expect(gate(last, 'defeat', 1200)).toBe(true)
  expect(gate(last, 'spawn', 1500)).toBe(true)
})

test('the next track is never the one just played, unless it is the only one', async () => {
  for (let i = 0; i < 20; i++) expect(nextTrack(['a.mp3', 'b.mp3', 'c.mp3'], 'b.mp3')).not.toBe('b.mp3')
  expect(nextTrack(['a.mp3'], 'a.mp3')).toBe('a.mp3')
  expect(nextTrack([], undefined)).toBe(undefined)
})

test('every monster falls with a sound of its own, and every sound named has a gain', async () => {
  for (const kind of ['slime', 'bat', 'mushroom', 'ghost', 'boss'] as const) expect(FALL[kind].length).toBeGreaterThan(0)
  for (const s of [...Object.values(CAST), ...Object.values(BLOW), ...Object.values(FALL).flat()]) expect(GAIN[s!]).toBeGreaterThan(0)
})
