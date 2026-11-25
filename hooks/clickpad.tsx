// A see-through region over the picture: it reports where a click lands, in its cells and its size.
import type { ClientModule } from 'claude-code'

const ClickPad: ClientModule<null, true> = (_props, surface) => {
  if (surface.state === undefined) {
    let held = false, sent = -1 // the column a drag last reported
    let last: { x: number; y: number; dy: number; low: number } | undefined // the pointer's last hover, and which way it went
    surface.onPointer(e => {
      const at = { x: e.fine?.x ?? e.x + 0.5, y: e.fine?.y ?? e.y + 0.5, cols: surface.columns, rows: surface.rows }
      // Where the picture ends: the pad is taller and clipped there, so a hovering pointer that leaves going down,
      // away from the sides, left through the picture's bottom. (A held pointer reports past the edges: not used.)
      if (e.type === 'move' && !held) last = { x: at.x, y: at.y, dy: last ? at.y - last.y : 0, low: Math.max(last?.low ?? 0, e.fine?.y ?? e.y + 1) }
      if (e.type === 'leave' && !held && last && last.dy > 0 && last.x > 1 && last.x < surface.columns - 1) surface.post({ bottom: last.low }) // the lowest it hovered (a row's bottom without fine y)
      if (e.type === 'down' && e.button !== undefined && e.button !== 'left') return // a right or middle click does nothing
      if (e.type === 'down') { held = true; sent = at.x; surface.post(at) }
      else if (e.type === 'up') { // the pointer is held till here, wherever it went
        if (held && Math.abs(at.x - sent) > 0.01) surface.post({ ...at, drag: true }) // where the drag ended
        held = false
      } else if (e.type === 'move' && held && Math.abs(at.x - sent) >= 0.5) { sent = at.x; surface.post({ ...at, drag: true }) } // dragging: the slider follows (every half column, not every pixel)
    })
    surface.setState(true)
  }
  return surface.elements.Box({ width: '100%', height: '100%' })
}
export default ClickPad
