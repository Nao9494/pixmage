import { expect, test } from 'claude-code/testing'

import { createGame, withStrip } from './game'
import { nextLang, t } from './i18n'
import { cardAt, withScroll } from './settings'

test('the scroll lays out its cards only once all the way over, and a click finds its card in either layout', async () => {
  const scene = withStrip(createGame({ kills: 0, xp: 0, level: 1 }).scene(88, false, [], 2, true), [[{ text: 'x', color: 0 }], [{ text: '', color: 0 }]])
  const cards = [
    { id: 'musicVol', mute: 'music', muted: false, icon: 'setVolume', label: '音樂', value: '60%', slider: 0.6 },
    { id: 'lang', icon: 'setLang', label: '語言', value: '中文' },
  ] as const
  expect(withScroll(scene, 0.5, 'T', cards).cards).toEqual([])
  for (const layout of ['A', 'B'] as const) {
    const open = withScroll(scene, 1, 'T', cards, layout, [], true)
    const bar = open.cards.find(s => s.id === 'lang')!, vol = open.cards.find(s => s.id === 'musicVol')!
    expect(cardAt(open.cards, bar.from + 0.01, bar.y[0] + 2)).toBe('lang')
    expect(cardAt(open.cards, bar.from + 0.01, bar.y[1] + 3)).not.toBe('lang') // the paper below it
    expect(cardAt(open.cards, vol.from - 0.01, vol.y[0] + 2)).toBe('music') // the mute key before the slider
    expect(cardAt(open.cards, 0.01, bar.y[0] + 2)).toBe(undefined) // the margin
    expect(open.cards.some(s => s.id === 'layout')).toBe(true)
  }
})

test('three languages, cycled in order, with numbers filled in', async () => {
  expect(nextLang('zh')).toBe('en')
  expect(nextLang('ja')).toBe('zh')
  expect(t('en', 'levelUp', 7)).toBe('Level up! Lv 7')
})
