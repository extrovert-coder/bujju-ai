// ====================================================================
// BUJJU AI - PWA ICON GENERATOR
// Generates valid PNG icons (192x192, 512x512, apple-touch-icon 180x180)
// using Node.js built-in zlib for universal zero-dependency PWA support
// ====================================================================

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import zlib from 'zlib'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const publicDir = path.resolve(__dirname, '../public')

// CRC32 table & computation for PNG chunks
const crcTable = []
for (let n = 0; n < 256; n++) {
  let c = n
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  }
  crcTable[n] = c >>> 0
}

function crc32(buf) {
  let crc = 0xffffffff
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

function makeChunk(type, data) {
  const len = data.length
  const chunk = Buffer.alloc(12 + len)
  chunk.writeUInt32BE(len, 0)
  chunk.write(type, 4, 4, 'ascii')
  data.copy(chunk, 8)
  const crc = crc32(chunk.subarray(4, 8 + len))
  chunk.writeUInt32BE(crc, 8 + len)
  return chunk
}

function createPng(width, height, drawPixel) {
  // PNG Signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

  // IHDR: Width, Height, Bit depth (8), Color type (6 = RGBA), Compression (0), Filter (0), Interlace (0)
  const ihdrData = Buffer.alloc(13)
  ihdrData.writeUInt32BE(width, 0)
  ihdrData.writeUInt32BE(height, 4)
  ihdrData[8] = 8 // bit depth
  ihdrData[9] = 6 // color type RGBA
  ihdrData[10] = 0
  ihdrData[11] = 0
  ihdrData[12] = 0
  const ihdrChunk = makeChunk('IHDR', ihdrData)

  // Scanlines with filter byte 0 (None)
  const scanlines = Buffer.alloc(height * (1 + width * 4))
  let offset = 0

  for (let y = 0; y < height; y++) {
    scanlines[offset++] = 0 // Filter type 0
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = drawPixel(x, y, width, height)
      scanlines[offset++] = r
      scanlines[offset++] = g
      scanlines[offset++] = b
      scanlines[offset++] = a
    }
  }

  // IDAT: Deflated scanlines
  const compressed = zlib.deflateSync(scanlines, { level: 9 })
  const idatChunk = makeChunk('IDAT', compressed)

  // IEND
  const iendChunk = makeChunk('IEND', Buffer.alloc(0))

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk])
}

// Draw Bujju AI Aurora Gradient Icon with Monogram "B" and Squircle Background
function renderBujjuIcon(x, y, w, h, isMaskable = false) {
  const cx = w / 2
  const cy = h / 2
  const u = x / w
  const v = y / h

  // Safe area for maskable icon vs standard icon
  const paddingRatio = isMaskable ? 0.18 : 0.08
  const pad = w * paddingRatio
  const innerW = w - pad * 2
  const innerH = h - pad * 2
  const cornerR = innerW * 0.28

  // Squircle distance check
  const dx = Math.abs(x - cx) - (innerW / 2 - cornerR)
  const dy = Math.abs(y - cy) - (innerH / 2 - cornerR)
  const isInsideSquircle =
    (dx <= 0 && dy <= cornerR) ||
    (dy <= 0 && dx <= cornerR) ||
    (dx > 0 && dy > 0 && dx * dx + dy * dy <= cornerR * cornerR)

  if (!isInsideSquircle && !isMaskable) {
    return [0, 0, 0, 0] // Transparent exterior
  }

  // Background dark gradient
  let bgR = 19, bgG = 20, bgB = 22, bgA = 255
  if (isMaskable && !isInsideSquircle) {
    // Fill maskable exterior with brand dark background
    return [19, 20, 22, 255]
  }

  // Bujju AI Aurora Brand Gradient: Blue (#4285F4) -> Purple (#9B72CF) -> Rose (#D96570)
  const t = Math.max(0, Math.min(1, (u * 0.7 + v * 0.3)))
  let gradR, gradG, gradB
  if (t < 0.5) {
    const k = t / 0.5
    gradR = Math.round(66 + (155 - 66) * k)
    gradG = Math.round(133 + (114 - 133) * k)
    gradB = Math.round(244 + (207 - 244) * k)
  } else {
    const k = (t - 0.5) / 0.5
    gradR = Math.round(155 + (217 - 155) * k)
    gradG = Math.round(114 + (101 - 114) * k)
    gradB = Math.round(207 + (112 - 207) * k)
  }

  // Monogram "B" relative geometry
  const bx = (x - cx) / (w * 0.5) // -1 to 1 normalized
  const by = (y - cy) / (h * 0.5)

  // Vertical spine: bx between -0.42 and -0.22, by between -0.52 and 0.52
  const isSpine = bx >= -0.44 && bx <= -0.20 && by >= -0.52 && by <= 0.52

  // Upper loop
  const upperDist = Math.hypot(bx - -0.05, by - -0.26)
  const isUpperLoop = upperDist <= 0.38 && upperDist >= 0.18 && bx >= -0.22

  // Lower loop
  const lowerDist = Math.hypot(bx - -0.02, by - 0.26)
  const isLowerLoop = lowerDist <= 0.42 && lowerDist >= 0.20 && bx >= -0.22

  // Top horizontal bar & middle bar & bottom bar
  const isTopBar = bx >= -0.44 && bx <= 0.05 && by >= -0.52 && by <= -0.34
  const isMidBar = bx >= -0.44 && bx <= 0.05 && by >= -0.09 && by <= 0.09
  const isBottomBar = bx >= -0.44 && bx <= 0.05 && by >= 0.34 && by <= 0.52

  // Gemini 4-point Starburst in top-right
  const starX = Math.abs(bx - 0.45)
  const starY = Math.abs(by - -0.45)
  const isStar = (starX < 0.18 && starY < 0.04) || (starY < 0.18 && starX < 0.04) || (starX * starX + starY * starY < 0.003)

  if (isSpine || isUpperLoop || isLowerLoop || isTopBar || isMidBar || isBottomBar) {
    return [gradR, gradG, gradB, 255]
  }

  if (isStar) {
    return [255, 255, 255, 255]
  }

  // Squircle border glow
  const borderDist = Math.hypot(Math.max(0, dx), Math.max(0, dy))
  if (borderDist > cornerR - 3 && borderDist <= cornerR) {
    return [Math.round(gradR * 0.7), Math.round(gradG * 0.7), Math.round(gradB * 0.7), 200]
  }

  return [bgR, bgG, bgB, bgA]
}

console.log('[PWA Icon Generator] Creating universal PNG icons in public/...')

// 1. pwa-192.png (192x192)
const pwa192 = createPng(192, 192, (x, y, w, h) => renderBujjuIcon(x, y, w, h, false))
fs.writeFileSync(path.join(publicDir, 'pwa-192.png'), pwa192)
console.log('  ✓ Created public/pwa-192.png (192x192)')

// 2. pwa-512.png (512x512)
const pwa512 = createPng(512, 512, (x, y, w, h) => renderBujjuIcon(x, y, w, h, false))
fs.writeFileSync(path.join(publicDir, 'pwa-512.png'), pwa512)
console.log('  ✓ Created public/pwa-512.png (512x512)')

// 3. apple-touch-icon.png (180x180 for iOS)
const appleIcon = createPng(180, 180, (x, y, w, h) => renderBujjuIcon(x, y, w, h, false))
fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), appleIcon)
console.log('  ✓ Created public/apple-touch-icon.png (180x180)')

// 4. pwa-maskable-512.png (512x512 maskable with safe zone for Android adaptive icons)
const maskable512 = createPng(512, 512, (x, y, w, h) => renderBujjuIcon(x, y, w, h, true))
fs.writeFileSync(path.join(publicDir, 'pwa-maskable-512.png'), maskable512)
console.log('  ✓ Created public/pwa-maskable-512.png (512x512 maskable)')

console.log('[PWA Icon Generator] Done!')
