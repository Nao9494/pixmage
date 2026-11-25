// How hard one desktop frame works: run after every change and compare with the last numbers.
// usage: npx -y tsx ~/.claude/skills/pixmage/tools/bench.mts
import { createGame, need, withButtons, withStatusBar, withStrip, toSvg } from '../hooks/game.ts'
import { infoLines, statusSegs, wrapRows } from '../hooks/hud.ts'

const g = createGame({ kills: 1302, xp: 13, level: 24 })
const info: any = { limits: [{ kind: 'five_hour', percentUsed: 35, resetsAt: new Date(Date.now() + 3e6).toISOString() }, { kind: 'seven_day', percentUsed: 62 }], budget: null, workLog: null, ctx: 58 }
const frame = (busy: boolean) => {
  const now = new Date()
  const scene = withStatusBar(withStrip(g.scene(88, !busy, [], 2, true, { hud: false, outfit: { hat: 'opus', wand: 'high' } }), wrapRows(infoLines(info, now, true), 78, 2)), statusSegs(info, g.save, need(g.save.level), now, busy ? 90_000 : undefined), now.getTime())
  withButtons(scene, ['close'], 'left'); withButtons(scene, ['book', 'slime', 'note', 'next'], 'right')
  return toSvg(scene, 12, now.getTime())
}
for (let i = 0; i < 20; i++) frame(false) // warm up
const run = (label: string, busy: boolean, fps: number) => {
  const N = 200; let bytes = 0; const t0 = performance.now()
  for (let i = 0; i < N; i++) { if (busy && i % 15 === 0) g.kill(g.spawn('slime', 88)); g.step(); bytes += frame(busy).length }
  const ms = (performance.now() - t0) / N
  console.log(`${label}: ${ms.toFixed(1)} ms/frame, ${(bytes / N / 1024).toFixed(0)} KB/frame, at ${fps} fps ≈ ${(ms * fps / 10).toFixed(1)}% of one CPU core, ${(bytes / N / 1024 * fps * 60 / 1024).toFixed(1)} MB/min sent`)
}
run('idle  ', false, 1.7)
run('battle', true, 5)
run('smooth', true, 10) // 顯示效果：流暢
