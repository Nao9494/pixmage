// A minimal PNG encoder (8-bit palette, fixed-Huffman deflate) with no Node or zlib: what lets desktop's
// 4x mode fit the Svg element's 131072 characters as one embedded image instead of thousands of paths.

const CRC = new Uint32Array(256).map((_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
const crc32 = (bytes: Uint8Array) => {
  let c = 0xffffffff
  for (const b of bytes) c = CRC[(c ^ b) & 255]! ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
const be32 = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]

function chunk(type: string, data: Uint8Array) {
  const out = new Uint8Array(12 + data.length)
  out.set(be32(data.length))
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i)
  out.set(data, 8)
  out.set(be32(crc32(out.subarray(4, 8 + data.length))), 8 + data.length)
  return out
}

// Up to 256 colors: round channels coarser until the image fits a palette.
function palettize(px: Int32Array) {
  for (const step of [1, 4, 8, 16, 32]) {
    const q = (c: number) => step === 1 ? c : [16, 8, 0].reduce((acc, s) => acc | (Math.min(255, Math.round(((c >> s) & 255) / step) * step) << s), 0)
    const index = new Map<number, number>()
    for (const c of px) {
      const v = q(c)
      if (!index.has(v)) index.set(v, index.size)
      if (index.size > 256) break
    }
    if (index.size <= 256) return { index, q }
  }
  throw new Error('too many colors')
}

// Most frames repeat the last one (idle scenes barely move): hand back the same string, skipping the encode.
// One cache per layer, so the scene and the text layer never evict each other.
export type PngCache = { px?: Int32Array; w: number; png: string }
export const pngCache = (): PngCache => ({ w: 0, png: '' })
const sceneCache = pngCache()

// `clear`: the one color drawn see-through (a tRNS entry), for a layer laid over another.
export function encodePng(px: Int32Array, width: number, height: number, cache = sceneCache, clear?: number) {
  if (cache.px && cache.w === width && cache.px.length === px.length && cache.px.every((v, i) => v === px[i])) return cache.png
  const { index, q } = palettize(px)
  const raw = new Uint8Array(height * (width + 1)) // each row: filter byte 0, then indices
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) raw[y * (width + 1) + 1 + x] = index.get(q(px[y * width + x] ?? 0))!

  const d = deflate(raw)
  const z = new Uint8Array(d.length + 6)
  z[0] = 0x78
  z[1] = 0x01
  z.set(d, 2)
  let a = 1, b = 0
  for (const v of raw) { a = (a + v) % 65521; b = (b + a) % 65521 }
  z.set(be32(((b << 16) | a) >>> 0), d.length + 2)

  const plte = new Uint8Array(index.size * 3)
  for (const [c, i] of index) plte.set([(c >> 16) & 255, (c >> 8) & 255, c & 255], i * 3)
  const ihdr = new Uint8Array([...be32(width), ...be32(height), 8, 3, 0, 0, 0])
  const parts = [new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('PLTE', plte), ...trns(index, q, clear), chunk('IDAT', z), chunk('IEND', new Uint8Array())]
  const bytes = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let at = 0
  for (const p of parts) { bytes.set(p, at); at += p.length }
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  cache.px = px.slice()
  cache.w = width
  cache.png = btoa(bin)
  return cache.png
}

function trns(index: Map<number, number>, q: (c: number) => number, clear: number | undefined) {
  const at = clear === undefined ? undefined : index.get(q(clear))
  if (at === undefined) return []
  const alpha = new Uint8Array(at + 1).fill(255)
  alpha[at] = 0
  return [chunk('tRNS', alpha)]
}

// Deflate, one fixed-Huffman block, greedy LZ77 over a hash of the next 3 bytes (32 KiB window).
const LEN_BASE = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258]
const LEN_EXTRA = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0]
const DIST_BASE = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577]
const DIST_EXTRA = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13]

let head = new Int32Array(1 << 15)
let prev = new Int32Array(0)

function deflate(data: Uint8Array): Uint8Array {
  const out = new Uint8Array(data.length * 2 + 16) // fixed Huffman: at most 9 bits a byte
  let o = 0
  let bitBuf = 0, bitLen = 0
  const bits = (v: number, n: number) => { // LSB first
    bitBuf |= v << bitLen
    bitLen += n
    while (bitLen >= 8) { out[o++] = bitBuf & 255; bitBuf >>>= 8; bitLen -= 8 }
  }
  const code = (c: number, n: number) => { // Huffman codes go MSB first
    let r = 0
    for (let i = 0; i < n; i++) r |= ((c >> i) & 1) << (n - 1 - i)
    bits(r, n)
  }
  const sym = (s: number) => {
    if (s < 144) code(0x30 + s, 8)
    else if (s < 256) code(0x190 + s - 144, 9)
    else if (s < 280) code(s - 256, 7)
    else code(0xc0 + s - 280, 8)
  }
  const upper = (base: number[], v: number) => { let i = base.length - 1; while (base[i]! > v) i--; return i }

  bits(1, 1) // final block
  bits(1, 2) // fixed Huffman
  head.fill(-1)
  if (prev.length < data.length) prev = new Int32Array(data.length)
  const hashAt = (i: number) => ((data[i]! << 10) ^ (data[i + 1]! << 5) ^ data[i + 2]!) & 0x7fff
  let i = 0
  while (i < data.length) {
    let bestLen = 0, bestDist = 0
    if (i + 2 < data.length) {
      const h = hashAt(i)
      for (let j = head[h]!, tries = 0; j >= 0 && i - j <= 32768 && tries < 32; j = prev[j]!, tries++) {
        let n = 0
        while (n < 258 && i + n < data.length && data[j + n] === data[i + n]) n++
        if (n > bestLen) { bestLen = n; bestDist = i - j; if (n === 258) break }
      }
      prev[i] = head[h]!
      head[h] = i
    }
    if (bestLen >= 3) {
      const li = upper(LEN_BASE, bestLen)
      sym(257 + li)
      bits(bestLen - LEN_BASE[li]!, LEN_EXTRA[li]!)
      const di = upper(DIST_BASE, bestDist)
      code(di, 5)
      bits(bestDist - DIST_BASE[di]!, DIST_EXTRA[di]!)
      for (let k = 1; k < bestLen && i + k + 2 < data.length; k++) { const h = hashAt(i + k); prev[i + k] = head[h]!; head[h] = i + k }
      i += bestLen
    } else {
      sym(data[i]!)
      i++
    }
  }
  sym(256)
  if (bitLen > 0) out[o++] = bitBuf & 255
  return out.subarray(0, o)
}
