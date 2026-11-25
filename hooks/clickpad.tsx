// A see-through region over the picture: it reports where a click lands, in its cells and its size.
import type { ClientModule } from 'claude-code'

const ClickPad: ClientModule<null, true> = (_props, surface) => {
  if (surface.state === undefined) {
    let held = false, sent = -1 // the column a drag last reported
    let bottom = -1, size = '' // the lowest the hovering pointer has been, in rows; the pad's size it holds for
    surface.onPointer(e => {
      const at = { x: e.fine?.x ?? e.x + 0.5, y: e.fine?.y ?? e.y + 0.5, cols: surface.columns, rows: surface.rows }
      // Where the picture ends, learnt as the pointer hovers: the lowest it is seen (the pad is taller, and clipped
      // there). Never from a held pointer, which reports past the edges.
      if (`${surface.columns}x${surface.rows}` !== size) { size = `${surface.columns}x${surface.rows}`; bottom = -1 } // resized: learn it again
      if (e.type === 'move' && !held && e.y < surface.rows) {
        const low = e.fine?.y ?? e.y + 1 // a row's bottom without fine y
        if (low > bottom + 0.05) { bottom = low; surface.post({ bottom }) }
      }
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
