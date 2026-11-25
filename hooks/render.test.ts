import { expect, test } from 'claude-code/testing'

// The desktop band must validate: a tree the surface refuses leaves the band empty (a fractional percent did).
test('the desktop band draws, keys and all', async $ => {
  const props = { hasSurvey: false, isWorking: false, maxRows: 30, bodyColumns: 90 } as never
  const ui = await $.ui.mount({ plugin: 'pixmage', surface: 'desktop', component: 'AbovePrompt', props })
  expect(await ui.drawn()).toMatchObject({ type: 'Box' })
  expect(await ui.find({ key: 'pad' })).toBeDefined()
})
