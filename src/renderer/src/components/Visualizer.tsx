import { useRef, useEffect } from 'react'
import { rgba } from '../utils/color'

const PHI = 1.618033988749895

// Single restrained warm accent for the minimal (light) variant — Braun/Rams "one pop"
const RAMS_ACCENT = '#CC6B49'
// Muted terracotta/clay accent for the wabi-sabi variant — the one warm note (a hanko seal)
const WABI_ACCENT = '#A86C4F'

interface Particle {
  x: number; y: number; vx: number; vy: number; life: number; maxLife: number; size: number
}

type GeometryVariant = 'triangles' | 'mandala' | 'crystalline' | 'grid' | 'minimal' | 'wabi'

// Per-session variation — rolled fresh on every BEGIN so no two sessions look
// alike, while each mode keeps its signature geometry. Applied as shared
// transforms (speed/direction, starting angle, slow precession + drift) plus a
// build-pace jitter; the variant draw functions themselves are untouched.
interface Variation {
  spdMul: number    // rotation-speed multiplier
  spdDir: number    // rotation direction (+1 / -1)
  baseRot: number   // random starting orientation
  precess: number   // slow continuous rotation of the whole form
  driftR: number    // orbital drift radius (fraction of base)
  driftFx: number   // drift frequency x
  driftFy: number   // drift frequency y
  driftPx: number   // drift phase x
  driftPy: number   // drift phase y
  buildMul: number  // build-window multiplier (varies how it forms)
}

function rollVariation(): Variation {
  const rand = (a: number, b: number): number => a + Math.random() * (b - a)
  return {
    spdMul: rand(0.65, 1.5),
    spdDir: Math.random() < 0.5 ? -1 : 1,
    baseRot: Math.random() * Math.PI * 2,
    precess: rand(-0.012, 0.012),
    driftR: rand(0.02, 0.06),
    driftFx: rand(0.04, 0.10),
    driftFy: rand(0.04, 0.10),
    driftPx: Math.random() * Math.PI * 2,
    driftPy: Math.random() * Math.PI * 2,
    buildMul: rand(0.7, 1.3),
  }
}

interface VisualizerProps {
  bgColor: string
  orbColor: string
  accentColor: string
  particleColor: string
  isPlaying: boolean
  sessionDurationSeconds?: number   // drives how slowly the geometry builds
  geometrySpeed?: number
  geometryVariant?: GeometryVariant
  theme?: 'dark' | 'light'
  onTick?: () => void
}

function easeIn(t: number): number {
  const c = Math.max(0, Math.min(1, t))
  return c * c
}

function elementAlpha(bp: number, threshold: number, span = 0.12): number {
  return easeIn((bp - threshold) / span)
}

function drawPolygon(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  n: number, radius: number, rotation: number
): void {
  ctx.beginPath()
  for (let i = 0; i <= n; i++) {
    const angle = (i / n) * Math.PI * 2 + rotation
    const x = cx + radius * Math.cos(angle)
    const y = cy + radius * Math.sin(angle)
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.closePath()
}

// ── SHARED HELPERS ───────────────────────────────────────────────────────────

function drawFlowerOfLife(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  r: number, rotation: number,
  color: string, alpha: number, revealFraction: number
): void {
  if (alpha <= 0.005) return
  ctx.strokeStyle = rgba(color, alpha)
  ctx.lineWidth = 0.6
  ctx.setLineDash([])
  const total = 7
  const count = Math.min(total, Math.floor(revealFraction * total) + 1)
  const partial = (revealFraction * total) % 1
  for (let i = 0; i < count; i++) {
    let arcEnd = Math.PI * 2
    if (i === count - 1 && revealFraction < 1) arcEnd = partial * Math.PI * 2
    if (i === 0) {
      ctx.beginPath()
      ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + arcEnd)
      ctx.stroke()
    } else {
      const angle = ((i - 1) / 6) * Math.PI * 2 + rotation
      ctx.beginPath()
      ctx.arc(cx + r * Math.cos(angle), cy + r * Math.sin(angle), r, -Math.PI / 2, -Math.PI / 2 + arcEnd)
      ctx.stroke()
    }
  }
}

function drawMetatronLines(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  r: number, rotation: number,
  color: string, alpha: number, revealFraction: number
): void {
  if (alpha <= 0.005) return
  const nodes: [number, number][] = [[cx, cy]]
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2 + rotation
    nodes.push([cx + r * Math.cos(angle), cy + r * Math.sin(angle)])
  }
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2 + rotation + Math.PI / 6
    nodes.push([cx + r * 1.95 * Math.cos(angle), cy + r * 1.95 * Math.sin(angle)])
  }
  const pairs: [[number, number], [number, number]][] = []
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      pairs.push([nodes[i], nodes[j]])
    }
  }
  const linesToDraw = Math.floor(revealFraction * pairs.length)
  ctx.strokeStyle = rgba(color, alpha)
  ctx.lineWidth = 0.4
  ctx.setLineDash([])
  for (let k = 0; k < linesToDraw; k++) {
    const [a, b] = pairs[k]
    ctx.beginPath()
    ctx.moveTo(a[0], a[1])
    ctx.lineTo(b[0], b[1])
    ctx.stroke()
  }
}

// ── VARIANT: TRIANGLES (deep-focus) — Sri Yantra–inspired nested triangles ──

function drawTrianglesVariant(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  B: number, t: number, spd: number,
  accent: string, _orb: string,
  bp: number
): void {
  // 5 nested triangle pairs (up + down), innermost brightest — bindu build
  const pairs = 5
  for (let i = 0; i < pairs; i++) {
    const revThreshold = 0.08 + i * 0.12
    const a = elementAlpha(bp, revThreshold, 0.14)
    if (a < 0.01) continue

    const r = B * (0.68 - i * 0.11)
    const rotUp = t * (0.006 + i * 0.002) * spd
    const rotDn = -t * (0.005 + i * 0.002) * spd + Math.PI

    const brightness = 0.25 + i * 0.12
    ctx.shadowBlur = 8 + i * 4
    ctx.shadowColor = rgba(accent, a * 0.5)
    ctx.strokeStyle = rgba(accent, a * brightness)
    ctx.lineWidth = 0.7 + i * 0.15

    drawPolygon(ctx, cx, cy, 3, r, rotUp)
    ctx.stroke()
    drawPolygon(ctx, cx, cy, 3, r * 0.92, rotDn)
    ctx.stroke()
  }
  ctx.shadowBlur = 0

  // Metatron overlay — faint, builds mid-late
  const metA = elementAlpha(bp, 0.55, 0.20) * 0.06
  const metReveal = Math.max(0, Math.min(1, (bp - 0.55) / 0.22))
  if (metA > 0.003) {
    drawMetatronLines(ctx, cx, cy, B * 0.22, t * 0.010 * spd, '#ffffff', metA, metReveal)
  }

  // Golden rings
  const ringA = elementAlpha(bp, 0.55, 0.14)
  if (ringA > 0.01) {
    ctx.shadowBlur = 8
    ctx.shadowColor = rgba(accent, ringA * 0.25);
    [B, B / PHI, B / (PHI * PHI)].forEach((r, i) => {
      const a = ringA * (1 - i * 0.25) * 0.28
      if (a < 0.006) return
      ctx.strokeStyle = rgba(accent, a)
      ctx.lineWidth = 0.6
      ctx.setLineDash([])
      ctx.beginPath()
      ctx.arc(cx, cy, r, 0, Math.PI * 2)
      ctx.stroke()
    })
    ctx.shadowBlur = 0
  }

  // Bindu (center point) — last to appear, pulses
  const dotA = elementAlpha(bp, 0.82, 0.12)
  if (dotA > 0.01) {
    const pulse = 1 + 0.5 * Math.sin(t * 1.4) * dotA
    ctx.shadowBlur = 24 * dotA
    ctx.shadowColor = rgba(accent, 0.9)
    ctx.fillStyle = rgba(accent, dotA * 0.95)
    ctx.beginPath()
    ctx.arc(cx, cy, 3 * pulse, 0, Math.PI * 2)
    ctx.fill()
    ctx.shadowBlur = 0
  }
}

// ── VARIANT: MANDALA (creative) — petal rings ────────────────────────────────

function drawPetalRing(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  petalCount: number, innerR: number, outerR: number,
  rotation: number, color: string, alpha: number
): void {
  if (alpha < 0.005) return
  ctx.strokeStyle = rgba(color, alpha)
  ctx.setLineDash([])
  for (let i = 0; i < petalCount; i++) {
    const angle = (i / petalCount) * Math.PI * 2 + rotation
    const next = ((i + 1) / petalCount) * Math.PI * 2 + rotation
    const midAngle = (angle + next) / 2

    const ax = cx + innerR * Math.cos(angle)
    const ay = cy + innerR * Math.sin(angle)
    const bx = cx + innerR * Math.cos(next)
    const by = cy + innerR * Math.sin(next)
    const tip = outerR
    const tipX = cx + tip * Math.cos(midAngle)
    const tipY = cy + tip * Math.sin(midAngle)

    const cpDist = (outerR - innerR) * 0.55
    ctx.beginPath()
    ctx.moveTo(ax, ay)
    ctx.quadraticCurveTo(tipX + cpDist * Math.cos(midAngle + Math.PI / 2), tipY + cpDist * Math.sin(midAngle + Math.PI / 2), tipX, tipY)
    ctx.quadraticCurveTo(tipX + cpDist * Math.cos(midAngle - Math.PI / 2), tipY + cpDist * Math.sin(midAngle - Math.PI / 2), bx, by)
    ctx.stroke()
  }
}

function drawMandalaVariant(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  B: number, t: number, spd: number,
  accent: string, _orb: string,
  bp: number
): void {
  // Outer ring: 12 petals
  const r3A = elementAlpha(bp, 0.08, 0.16)
  if (r3A > 0.01) {
    ctx.lineWidth = 0.6
    ctx.shadowBlur = 6
    ctx.shadowColor = rgba(accent, r3A * 0.3)
    drawPetalRing(ctx, cx, cy, 12, B * 0.55, B * 0.88, t * 0.004 * spd, accent, r3A * 0.28)
    ctx.shadowBlur = 0
  }

  // Middle ring: 8 petals
  const r2A = elementAlpha(bp, 0.20, 0.16)
  if (r2A > 0.01) {
    ctx.lineWidth = 0.7
    ctx.shadowBlur = 8
    ctx.shadowColor = rgba(accent, r2A * 0.35)
    drawPetalRing(ctx, cx, cy, 8, B * 0.32, B * 0.58, -t * 0.007 * spd, accent, r2A * 0.40)
    ctx.shadowBlur = 0
  }

  // Inner ring: 6 petals
  const r1A = elementAlpha(bp, 0.34, 0.16)
  if (r1A > 0.01) {
    ctx.lineWidth = 0.9
    ctx.shadowBlur = 12
    ctx.shadowColor = rgba(accent, r1A * 0.45)
    drawPetalRing(ctx, cx, cy, 6, B * 0.14, B * 0.34, t * 0.011 * spd, accent, r1A * 0.52)
    ctx.shadowBlur = 0
  }

  // Metatron faint overlay
  const metA = elementAlpha(bp, 0.44, 0.18) * 0.07
  const metReveal = Math.max(0, Math.min(1, (bp - 0.44) / 0.20))
  if (metA > 0.003) {
    drawMetatronLines(ctx, cx, cy, B * 0.22, t * 0.008 * spd, '#ffffff', metA, metReveal)
  }

  // Two concentric decorative rings
  const circA = elementAlpha(bp, 0.56, 0.14)
  if (circA > 0.01) {
    ctx.shadowBlur = 8
    ctx.shadowColor = rgba(accent, circA * 0.3)
    ctx.setLineDash([])
    ctx.strokeStyle = rgba(accent, circA * 0.30)
    ctx.lineWidth = 0.7
    ctx.beginPath(); ctx.arc(cx, cy, B * 0.90, 0, Math.PI * 2); ctx.stroke()
    ctx.strokeStyle = rgba(accent, circA * 0.18)
    ctx.lineWidth = 0.5
    ctx.beginPath(); ctx.arc(cx, cy, B * 0.52, 0, Math.PI * 2); ctx.stroke()
    ctx.shadowBlur = 0
  }

  // Hexagram
  const hexA = elementAlpha(bp, 0.66, 0.12)
  if (hexA > 0.01) {
    ctx.shadowBlur = 14
    ctx.shadowColor = rgba(accent, hexA * 0.5)
    ctx.strokeStyle = rgba(accent, hexA * 0.55)
    ctx.lineWidth = 1.0
    ctx.setLineDash([])
    drawPolygon(ctx, cx, cy, 3, B * 0.28, t * 0.013 * spd)
    ctx.stroke()
    drawPolygon(ctx, cx, cy, 3, B * 0.28, -t * 0.010 * spd + Math.PI / 3)
    ctx.stroke()
    ctx.shadowBlur = 0
  }

  // 24 fine radial lines
  const rayA = elementAlpha(bp, 0.74, 0.12) * 0.18
  if (rayA > 0.005) {
    ctx.strokeStyle = rgba(accent, rayA)
    ctx.lineWidth = 0.35
    for (let i = 0; i < 24; i++) {
      const angle = (i / 24) * Math.PI * 2 + t * 0.003 * spd
      ctx.beginPath()
      ctx.moveTo(cx + B * 0.14 * Math.cos(angle), cy + B * 0.14 * Math.sin(angle))
      ctx.lineTo(cx + B * 0.90 * Math.cos(angle), cy + B * 0.90 * Math.sin(angle))
      ctx.stroke()
    }
  }

  // Center dot
  const dotA = elementAlpha(bp, 0.84, 0.12)
  if (dotA > 0.01) {
    const pulse = 1 + 0.45 * Math.sin(t * 1.6) * dotA
    ctx.shadowBlur = 20 * dotA
    ctx.shadowColor = rgba(accent, 0.9)
    ctx.fillStyle = rgba(accent, dotA * 0.95)
    ctx.beginPath()
    ctx.arc(cx, cy, 3 * pulse, 0, Math.PI * 2)
    ctx.fill()
    ctx.shadowBlur = 0
  }
}

// ── VARIANT: CRYSTALLINE (power) — 3D octahedron ─────────────────────────────

function projectOcta(
  vx: number, vy: number, vz: number,
  cx: number, cy: number, scale: number,
  rotX: number, rotY: number
): [number, number, number] {
  // Rotate around Y axis
  const cosY = Math.cos(rotY), sinY = Math.sin(rotY)
  let x1 = vx * cosY - vz * sinY
  let z1 = vx * sinY + vz * cosY
  let y1 = vy
  // Rotate around X axis
  const cosX = Math.cos(rotX), sinX = Math.sin(rotX)
  const y2 = y1 * cosX - z1 * sinX
  const z2 = y1 * sinX + z1 * cosX
  const x2 = x1
  return [cx + x2 * scale, cy + y2 * scale, z2]
}

function drawCrystallineVariant(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  B: number, t: number, spd: number,
  accent: string, _orb: string,
  bp: number
): void {
  // Outer circle + 12-gon
  const outerA = elementAlpha(bp, 0.06, 0.12)
  if (outerA > 0.01) {
    ctx.strokeStyle = rgba(accent, outerA * 0.22)
    ctx.lineWidth = 0.7
    ctx.setLineDash([])
    ctx.beginPath(); ctx.arc(cx, cy, B, 0, Math.PI * 2); ctx.stroke()
    drawPolygon(ctx, cx, cy, 12, B, t * 0.005 * spd)
    ctx.stroke()
  }

  // Octahedron — 6 vertices at ±1 on each axis
  const rotY = t * 0.022 * spd
  const rotX = t * 0.014 * spd + 0.5

  const verts: [number, number, number][] = [
    [0, -1, 0], [0, 1, 0],  // top, bottom
    [1, 0, 0], [-1, 0, 0],  // right, left
    [0, 0, 1], [0, 0, -1],  // front, back
  ]

  const edges: [number, number][] = [
    [0,2],[0,3],[0,4],[0,5],
    [1,2],[1,3],[1,4],[1,5],
    [2,4],[4,3],[3,5],[5,2],
  ]

  const scale = B * 0.50
  const octA = elementAlpha(bp, 0.18, 0.20)

  if (octA > 0.01) {
    const projected = verts.map(([vx, vy, vz]) => projectOcta(vx, vy, vz, cx, cy, scale, rotX, rotY))

    ctx.setLineDash([])
    // Draw back edges first (negative z), then front
    const backEdges = edges.filter(([a, b]) => projected[a][2] < 0 || projected[b][2] < 0)
    const frontEdges = edges.filter(([a, b]) => projected[a][2] >= 0 && projected[b][2] >= 0)

    ctx.shadowBlur = 0
    for (const [a, b] of backEdges) {
      ctx.strokeStyle = rgba(accent, octA * 0.18)
      ctx.lineWidth = 0.5
      ctx.beginPath()
      ctx.moveTo(projected[a][0], projected[a][1])
      ctx.lineTo(projected[b][0], projected[b][1])
      ctx.stroke()
    }
    ctx.shadowBlur = 12
    ctx.shadowColor = rgba(accent, octA * 0.45)
    for (const [a, b] of frontEdges) {
      ctx.strokeStyle = rgba(accent, octA * 0.75)
      ctx.lineWidth = 1.2
      ctx.beginPath()
      ctx.moveTo(projected[a][0], projected[a][1])
      ctx.lineTo(projected[b][0], projected[b][1])
      ctx.stroke()
    }
    ctx.shadowBlur = 0

    // Vertex dots
    const dotBaseA = octA * 0.85
    for (const [px, py, pz] of projected) {
      const front = pz >= 0
      ctx.shadowBlur = front ? 10 : 0
      ctx.shadowColor = rgba(accent, 0.8)
      ctx.fillStyle = rgba(accent, front ? dotBaseA : dotBaseA * 0.25)
      ctx.beginPath()
      ctx.arc(px, py, front ? 2.5 : 1.5, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.shadowBlur = 0
  }

  // Inner nested octahedron (smaller, rotates opposite)
  const innerA = elementAlpha(bp, 0.42, 0.18)
  if (innerA > 0.01) {
    const rotY2 = -t * 0.018 * spd
    const rotX2 = t * 0.010 * spd + 1.0
    const scale2 = B * 0.26
    const projected2 = verts.map(([vx, vy, vz]) => projectOcta(vx, vy, vz, cx, cy, scale2, rotX2, rotY2))
    ctx.shadowBlur = 8
    ctx.shadowColor = rgba(accent, innerA * 0.4)
    for (const [a, b] of edges) {
      const avgZ = (projected2[a][2] + projected2[b][2]) / 2
      ctx.strokeStyle = rgba(accent, innerA * (avgZ >= 0 ? 0.55 : 0.12))
      ctx.lineWidth = 0.7
      ctx.setLineDash([])
      ctx.beginPath()
      ctx.moveTo(projected2[a][0], projected2[a][1])
      ctx.lineTo(projected2[b][0], projected2[b][1])
      ctx.stroke()
    }
    ctx.shadowBlur = 0
  }

  // Spiky radial lines (8 directions — power theme)
  const spikeA = elementAlpha(bp, 0.62, 0.14) * 0.30
  if (spikeA > 0.005) {
    ctx.strokeStyle = rgba(accent, spikeA)
    ctx.lineWidth = 0.5
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2 + t * 0.010 * spd
      ctx.beginPath()
      ctx.moveTo(cx, cy)
      ctx.lineTo(cx + B * 0.95 * Math.cos(angle), cy + B * 0.95 * Math.sin(angle))
      ctx.stroke()
    }
  }

  // Golden ratio rings — brief
  const ringA = elementAlpha(bp, 0.70, 0.12)
  if (ringA > 0.01) {
    ctx.shadowBlur = 6
    ctx.shadowColor = rgba(accent, ringA * 0.2)
    ctx.strokeStyle = rgba(accent, ringA * 0.22)
    ctx.lineWidth = 0.5
    ctx.setLineDash([])
    ctx.beginPath(); ctx.arc(cx, cy, B / PHI, 0, Math.PI * 2); ctx.stroke()
    ctx.shadowBlur = 0
  }

  // Center dot
  const dotA = elementAlpha(bp, 0.80, 0.12)
  if (dotA > 0.01) {
    const pulse = 1 + 0.55 * Math.sin(t * 2.2) * dotA
    ctx.shadowBlur = 26 * dotA
    ctx.shadowColor = rgba(accent, 0.9)
    ctx.fillStyle = rgba(accent, dotA * 0.95)
    ctx.beginPath()
    ctx.arc(cx, cy, 3.5 * pulse, 0, Math.PI * 2)
    ctx.fill()
    ctx.shadowBlur = 0
  }
}

// ── VARIANT: GRID (build) — Metatron + circuit-board grid ────────────────────

function drawGridVariant(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  B: number, t: number, spd: number,
  accent: string, orb: string,
  bp: number
): void {
  // Circuit-board grid — square lattice revealed early
  const gridA = elementAlpha(bp, 0.04, 0.18) * 0.09
  if (gridA > 0.003) {
    const step = B * 0.14
    const cols = Math.ceil(B * 2 / step) + 2
    const startX = cx - Math.ceil(cols / 2) * step
    const startY = cy - Math.ceil(cols / 2) * step
    ctx.strokeStyle = rgba(accent, gridA)
    ctx.lineWidth = 0.4
    ctx.setLineDash([])
    for (let i = 0; i <= cols; i++) {
      const x = startX + i * step
      ctx.beginPath(); ctx.moveTo(x, cy - B * 1.1); ctx.lineTo(x, cy + B * 1.1); ctx.stroke()
      const y = startY + i * step
      ctx.beginPath(); ctx.moveTo(cx - B * 1.1, y); ctx.lineTo(cx + B * 1.1, y); ctx.stroke()
    }
  }

  // Metatron's Cube — dominant element
  const metA = elementAlpha(bp, 0.10, 0.22) * 0.14
  const metReveal = Math.max(0, Math.min(1, (bp - 0.10) / 0.24))
  const folR = B * 0.25
  if (metA > 0.003) {
    drawMetatronLines(ctx, cx, cy, folR, t * 0.014 * spd, '#ffffff', metA, metReveal)
  }

  // FOL circles under Metatron
  const folA = elementAlpha(bp, 0.10, 0.18) * 0.18
  const folReveal = Math.max(0, Math.min(1, (bp - 0.10) / 0.20))
  if (folA > 0.003) {
    drawFlowerOfLife(ctx, cx, cy, folR, t * 0.014 * spd, orb, folA, folReveal)
  }

  // Diamond squares (squares rotated 45°)
  const diamondA = elementAlpha(bp, 0.36, 0.14)
  if (diamondA > 0.01) {
    ctx.shadowBlur = 8
    ctx.shadowColor = rgba(accent, diamondA * 0.3)
    const sizes = [B * 0.70, B * 0.48, B * 0.28]
    sizes.forEach((r, i) => {
      ctx.strokeStyle = rgba(accent, diamondA * (0.22 - i * 0.05))
      ctx.lineWidth = 0.7
      ctx.setLineDash([])
      drawPolygon(ctx, cx, cy, 4, r, Math.PI / 4 + t * (0.008 + i * 0.004) * spd)
      ctx.stroke()
    })
    ctx.shadowBlur = 0
  }

  // Outer circle + 12-gon frame
  const frameA = elementAlpha(bp, 0.48, 0.12)
  if (frameA > 0.01) {
    ctx.strokeStyle = rgba(accent, frameA * 0.28)
    ctx.lineWidth = 0.7
    ctx.setLineDash([])
    ctx.beginPath(); ctx.arc(cx, cy, B, 0, Math.PI * 2); ctx.stroke()
    ctx.strokeStyle = rgba(accent, frameA * 0.20)
    drawPolygon(ctx, cx, cy, 12, B, t * 0.006 * spd)
    ctx.stroke()
  }

  // Node dots at grid intersections near Metatron
  const nodeA = elementAlpha(bp, 0.58, 0.14)
  if (nodeA > 0.01) {
    const nodePositions: [number, number][] = [[cx, cy]]
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2 + t * 0.014 * spd
      nodePositions.push([cx + folR * Math.cos(angle), cy + folR * Math.sin(angle)])
    }
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2 + t * 0.014 * spd + Math.PI / 6
      nodePositions.push([cx + folR * 1.95 * Math.cos(angle), cy + folR * 1.95 * Math.sin(angle)])
    }
    ctx.shadowBlur = 6
    ctx.shadowColor = rgba(accent, 0.6)
    ctx.fillStyle = rgba(accent, nodeA * 0.7)
    for (const [nx, ny] of nodePositions) {
      ctx.beginPath()
      ctx.arc(nx, ny, 1.8, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.shadowBlur = 0
  }

  // Hexagram
  const hexA = elementAlpha(bp, 0.68, 0.12)
  if (hexA > 0.01) {
    ctx.shadowBlur = 16
    ctx.shadowColor = rgba(accent, hexA * 0.55)
    ctx.strokeStyle = rgba(accent, hexA * 0.60)
    ctx.lineWidth = 1.1
    ctx.setLineDash([])
    drawPolygon(ctx, cx, cy, 3, B * 0.38, t * 0.016 * spd)
    ctx.stroke()
    drawPolygon(ctx, cx, cy, 3, B * 0.38, -t * 0.012 * spd + Math.PI / 3)
    ctx.stroke()
    ctx.shadowBlur = 0
  }

  // Center dot — sharp pulse (gamma energy)
  const dotA = elementAlpha(bp, 0.80, 0.12)
  if (dotA > 0.01) {
    const pulse = 1 + 0.6 * Math.abs(Math.sin(t * 2.6)) * dotA
    ctx.shadowBlur = 28 * dotA
    ctx.shadowColor = rgba(accent, 0.95)
    ctx.fillStyle = rgba(accent, dotA * 0.98)
    ctx.beginPath()
    ctx.arc(cx, cy, 3.5 * pulse, 0, Math.PI * 2)
    ctx.fill()
    ctx.shadowBlur = 0
  }
}

// ── VARIANT: MINIMAL (minimalist) — Dieter Rams grid + Eno/Fred-Again ambient ─
// Flat, no glow, dark ink on a cream field. Restraint over ornament.

function drawMinimalVariant(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  B: number, t: number, spd: number,
  accent: string, _orb: string,
  bp: number
): void {
  ctx.setLineDash([])
  ctx.shadowBlur = 0

  // 1. Braun dot-grid — quiet order, revealed first
  const gridA = elementAlpha(bp, 0.03, 0.22) * 0.11
  if (gridA > 0.003) {
    const step = B * 0.18
    const reach = Math.ceil((B * 1.2) / step)
    ctx.fillStyle = rgba(accent, gridA)
    for (let i = -reach; i <= reach; i++) {
      for (let j = -reach; j <= reach; j++) {
        const x = cx + i * step
        const y = cy + j * step
        if (Math.hypot(x - cx, y - cy) > B * 1.12) continue
        ctx.beginPath()
        ctx.arc(x, y, 0.9, 0, Math.PI * 2)
        ctx.fill()
      }
    }
  }

  // 2. Outer precise circle
  const outerA = elementAlpha(bp, 0.10, 0.16)
  if (outerA > 0.01) {
    ctx.strokeStyle = rgba(accent, outerA * 0.34)
    ctx.lineWidth = 0.8
    ctx.beginPath(); ctx.arc(cx, cy, B, 0, Math.PI * 2); ctx.stroke()
  }

  // 3. Tick ring (Braun clock face) — slow rotation
  const tickA = elementAlpha(bp, 0.22, 0.16)
  if (tickA > 0.01) {
    const ticks = 60
    const rot = t * 0.004 * spd
    ctx.lineWidth = 0.6
    for (let i = 0; i < ticks; i++) {
      const ang = (i / ticks) * Math.PI * 2 + rot
      const major = i % 5 === 0
      const r1 = B * (major ? 0.92 : 0.955)
      ctx.strokeStyle = rgba(accent, tickA * (major ? 0.32 : 0.20))
      ctx.beginPath()
      ctx.moveTo(cx + r1 * Math.cos(ang), cy + r1 * Math.sin(ang))
      ctx.lineTo(cx + B * Math.cos(ang), cy + B * Math.sin(ang))
      ctx.stroke()
    }
  }

  // 4. Inner golden-ratio circles
  const innerA = elementAlpha(bp, 0.34, 0.16)
  if (innerA > 0.01) {
    ctx.strokeStyle = rgba(accent, innerA * 0.22)
    ctx.lineWidth = 0.7
    ctx.beginPath(); ctx.arc(cx, cy, B / PHI, 0, Math.PI * 2); ctx.stroke()
    ctx.strokeStyle = rgba(accent, innerA * 0.15)
    ctx.beginPath(); ctx.arc(cx, cy, B / (PHI * PHI), 0, Math.PI * 2); ctx.stroke()
  }

  // 5. Eno horizon strata — faint horizontal layers
  const stratA = elementAlpha(bp, 0.58, 0.18) * 0.085
  if (stratA > 0.003) {
    ctx.strokeStyle = rgba(accent, stratA)
    ctx.lineWidth = 0.5
    for (const off of [-0.34, -0.12, 0.12, 0.34]) {
      const y = cy + B * off
      ctx.beginPath(); ctx.moveTo(cx - B * 0.86, y); ctx.lineTo(cx + B * 0.86, y); ctx.stroke()
    }
  }

  // 6. Slow sweep hand + warm travelling node — the generative, evolving motion
  const sweepA = elementAlpha(bp, 0.28, 0.16)
  if (sweepA > 0.01) {
    const ang = t * 0.05 * spd
    ctx.strokeStyle = rgba(accent, sweepA * 0.28)
    ctx.lineWidth = 0.9
    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.lineTo(cx + B * 0.98 * Math.cos(ang), cy + B * 0.98 * Math.sin(ang))
    ctx.stroke()
    ctx.fillStyle = rgba(RAMS_ACCENT, sweepA * 0.9)
    ctx.beginPath(); ctx.arc(cx + B * Math.cos(ang), cy + B * Math.sin(ang), 3, 0, Math.PI * 2); ctx.fill()
  }

  // 7. Center accent dot — the single Rams "pop", gentle breath
  const dotA = elementAlpha(bp, 0.18, 0.14)
  if (dotA > 0.01) {
    const pulse = 1 + 0.22 * Math.sin(t * 0.8) * dotA
    ctx.fillStyle = rgba(RAMS_ACCENT, dotA * 0.95)
    ctx.beginPath(); ctx.arc(cx, cy, 3 * pulse, 0, Math.PI * 2); ctx.fill()
  }
}

// ── VARIANT: WABI (wabi-sabi) — ensō brush circle, Japandi stillness ──────────
// Imperfect, asymmetric, hand-drawn. Flat sumi-ink on warm clay. Lots of negative space.

function drawWabiVariant(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  B: number, t: number, spd: number,
  accent: string, _orb: string,
  bp: number
): void {
  ctx.setLineDash([])
  ctx.shadowBlur = 0

  // Off-centre anchor — wabi-sabi prizes asymmetry over balance
  const ox = cx - B * 0.06
  const oy = cy - B * 0.04

  // 1. Horizon — a single low, asymmetric line (Japandi calm; doesn't span the frame)
  const horizA = elementAlpha(bp, 0.05, 0.18)
  if (horizA > 0.01) {
    const hy = cy + B * 0.64
    ctx.strokeStyle = rgba(accent, horizA * 0.16)
    ctx.lineWidth = 0.8
    ctx.beginPath()
    ctx.moveTo(cx - B * 0.92, hy)
    ctx.lineTo(cx + B * 0.50, hy)
    ctx.stroke()
  }

  // 2. Ensō — an incomplete hand-drawn brush circle; the focal element.
  //    Drawn segment-by-segment with a brush envelope (taper at the lift) and an
  //    organic radius wobble, revealed gradually across the session.
  const ensoA = elementAlpha(bp, 0.10, 0.24)
  if (ensoA > 0.01) {
    const R = B * 0.50
    const a0 = t * 0.012 * spd + 0.45        // slowly drifting brush-start angle
    const gap = 0.55                          // radians left open (incomplete)
    const sweep = Math.PI * 2 - gap
    const reveal = Math.max(0, Math.min(1, (bp - 0.10) / 0.5))
    const segs = 180
    const drawn = Math.max(1, Math.floor(reveal * segs))
    const wob = (ang: number): number =>
      1 + 0.035 * Math.sin(ang * 3 + 0.6) + 0.02 * Math.cos(ang * 5 - 1.1)
    ctx.lineCap = 'round'
    for (let i = 0; i < drawn; i++) {
      const f = i / segs
      const ang = a0 + f * sweep
      const ang2 = a0 + ((i + 1) / segs) * sweep
      const x = ox + R * wob(ang) * Math.cos(ang)
      const y = oy + R * wob(ang) * Math.sin(ang)
      const x2 = ox + R * wob(ang2) * Math.cos(ang2)
      const y2 = oy + R * wob(ang2) * Math.sin(ang2)
      // brush envelope — fade in at the start, lift off near the end
      const brush = Math.min(Math.min(1, f / 0.07), Math.min(1, (1 - f) / 0.16))
      ctx.strokeStyle = rgba(accent, ensoA * (0.18 + 0.42 * brush))
      ctx.lineWidth = 1.2 + 2.0 * Math.sin(f * Math.PI)   // brush pressure, thickest mid-stroke
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.lineTo(x2, y2)
      ctx.stroke()
    }
    ctx.lineCap = 'butt'
  }

  // 3. Stones — a few small irregular forms, asymmetrically clustered (karesansui)
  const stoneA = elementAlpha(bp, 0.46, 0.20)
  if (stoneA > 0.01) {
    const stones: [number, number, number, number, number][] = [
      [cx + B * 0.44, cy + B * 0.30, B * 0.050, 0.66, 0.3],
      [cx + B * 0.57, cy + B * 0.41, B * 0.030, 0.80, -0.2],
      [cx - B * 0.60, cy + B * 0.24, B * 0.040, 0.62, 0.5],
    ]
    ctx.fillStyle = rgba(accent, stoneA * 0.13)
    for (const [sx, sy, r, sq, rot] of stones) {
      ctx.beginPath()
      ctx.ellipse(sx, sy, r, r * sq, rot, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  // 4. The single warm note — a small terracotta seal at the ensō's brush-start
  const sealA = elementAlpha(bp, 0.30, 0.16)
  if (sealA > 0.01) {
    const pulse = 1 + 0.12 * Math.sin(t * 0.5)
    const a0 = t * 0.012 * spd + 0.45
    const px = ox + B * 0.50 * Math.cos(a0)
    const py = oy + B * 0.50 * Math.sin(a0)
    ctx.fillStyle = rgba(WABI_ACCENT, sealA * 0.85)
    ctx.beginPath()
    ctx.arc(px, py, 3.4 * pulse, 0, Math.PI * 2)
    ctx.fill()
  }
}

// ── MAIN COMPONENT ───────────────────────────────────────────────────────────

export function Visualizer({
  bgColor, orbColor, accentColor, particleColor,
  isPlaying, sessionDurationSeconds = 25 * 60,
  geometrySpeed = 1.0, geometryVariant = 'triangles', theme = 'dark', onTick
}: VisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const timeRef = useRef(0)
  const buildProgressRef = useRef(0)
  const particlesRef = useRef<Particle[]>([])
  const rafRef = useRef<number | null>(null)
  const prevPlayingRef = useRef(false)
  const varyRef = useRef<Variation>(rollVariation())

  const bgColorRef = useRef(bgColor)
  const orbColorRef = useRef(orbColor)
  const accentColorRef = useRef(accentColor)
  const particleColorRef = useRef(particleColor)
  const isPlayingRef = useRef(isPlaying)
  const sessionDurationRef = useRef(sessionDurationSeconds)
  const geometrySpeedRef = useRef(geometrySpeed)
  const geometryVariantRef = useRef(geometryVariant)
  const themeRef = useRef(theme)
  const onTickRef = useRef(onTick)

  bgColorRef.current = bgColor
  orbColorRef.current = orbColor
  accentColorRef.current = accentColor
  particleColorRef.current = particleColor
  isPlayingRef.current = isPlaying
  sessionDurationRef.current = sessionDurationSeconds
  geometrySpeedRef.current = geometrySpeed
  geometryVariantRef.current = geometryVariant
  themeRef.current = theme
  onTickRef.current = onTick

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const handleResize = (): void => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
      const count = 35 + Math.floor(Math.random() * 20)
      particlesRef.current = Array.from({ length: count }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.25,
        vy: -(0.15 + Math.random() * 0.4),
        life: Math.random() * 200,
        maxLife: 120 + Math.random() * 160,
        size: 1 + Math.random() * 2,
      }))
    }
    handleResize()
    window.addEventListener('resize', handleResize)

    const animate = (): void => {
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      timeRef.current += 0.016
      const t = timeRef.current
      const playing = isPlayingRef.current

      // Roll fresh variation on each BEGIN so every session differs.
      if (playing && !prevPlayingRef.current) varyRef.current = rollVariation()
      prevPlayingRef.current = playing
      const vary = varyRef.current

      // Build geometry in over a gentle window so elements (and finally the
      // center bindu, revealed at bp ~0.8) emerge after BEGIN — then hold for
      // the rest of the session. Capped so the centerpiece always appears
      // within ~90s, with a per-session jitter so the build differs each time.
      const dur = sessionDurationRef.current ?? 25 * 60
      const buildSeconds = Math.min(dur, 90) * vary.buildMul
      const bpSpeed = playing ? 1 / (buildSeconds * 60) : -1 / 240
      buildProgressRef.current = Math.max(0, Math.min(1, buildProgressRef.current + bpSpeed))
      const bp = buildProgressRef.current

      const bg = bgColorRef.current
      const orb = orbColorRef.current
      const accent = accentColorRef.current
      const pColor = particleColorRef.current

      const W = canvas.width
      const H = canvas.height
      const cx = W / 2
      const cy = H / 2
      const base = Math.min(W, H) * 0.36
      const spd = geometrySpeedRef.current
      const variant = geometryVariantRef.current

      const breathe = 1 + (playing ? 0.022 * Math.sin(t * 0.65) : 0)
      const B = base * breathe

      // Background
      ctx.fillStyle = bg
      ctx.fillRect(0, 0, W, H)

      // Ambient glow — far more restrained on the light theme
      const isLight = themeRef.current === 'light'
      const glowAlpha = (isLight ? 0.05 : 0.12) + (playing ? (isLight ? 0.05 : 0.18) : 0) * bp
      const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, base * 2.2)
      glow.addColorStop(0, rgba(orb, glowAlpha * 0.55))
      glow.addColorStop(0.45, rgba(orb, glowAlpha * 0.18))
      glow.addColorStop(1, rgba(orb, 0))
      ctx.fillStyle = glow
      ctx.fillRect(0, 0, W, H)

      // Particles
      particlesRef.current = particlesRef.current.map((p) => {
        p.life -= 1
        if (p.life <= 0) {
          return {
            x: Math.random() * W,
            y: H * 0.55 + Math.random() * H * 0.45,
            vx: (Math.random() - 0.5) * 0.25,
            vy: -(0.15 + Math.random() * 0.4),
            life: p.maxLife,
            maxLife: p.maxLife,
            size: 1 + Math.random() * 2,
          }
        }
        return { ...p, x: p.x + p.vx + (Math.random() - 0.5) * 0.08, y: p.y + p.vy, vx: p.vx * 0.99 }
      })
      for (const p of particlesRef.current) {
        const a = Math.sin((p.life / p.maxLife) * Math.PI) * 0.5
        const pStr = pColor.startsWith('rgba') ? pColor.replace(/[\d.]+\)$/, `${a.toFixed(3)})`) : rgba(pColor, a)
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        ctx.fillStyle = pStr
        ctx.fill()
      }

      // Dispatch to variant — wrapped in the per-session transform so the whole
      // form keeps a unique orientation, slowly precesses, and gently orbits the
      // center, at a session-specific speed/direction. The variant artwork is
      // unchanged; only how it moves and forms differs each time.
      const effSpd = spd * vary.spdMul * vary.spdDir
      const driftX = vary.driftR * base * Math.cos(t * vary.driftFx + vary.driftPx)
      const driftY = vary.driftR * base * Math.sin(t * vary.driftFy + vary.driftPy)
      ctx.setLineDash([])
      ctx.save()
      ctx.translate(driftX, driftY)
      ctx.translate(cx, cy)
      ctx.rotate(vary.baseRot + t * vary.precess)
      ctx.translate(-cx, -cy)
      if (variant === 'triangles') {
        drawTrianglesVariant(ctx, cx, cy, B, t, effSpd, accent, orb, bp)
      } else if (variant === 'mandala') {
        drawMandalaVariant(ctx, cx, cy, B, t, effSpd, accent, orb, bp)
      } else if (variant === 'crystalline') {
        drawCrystallineVariant(ctx, cx, cy, B, t, effSpd, accent, orb, bp)
      } else if (variant === 'grid') {
        drawGridVariant(ctx, cx, cy, B, t, effSpd, accent, orb, bp)
      } else if (variant === 'minimal') {
        drawMinimalVariant(ctx, cx, cy, B, t, effSpd, accent, orb, bp)
      } else if (variant === 'wabi') {
        drawWabiVariant(ctx, cx, cy, B, t, effSpd, accent, orb, bp)
      }
      ctx.restore()

      onTickRef.current?.()
      rafRef.current = requestAnimationFrame(animate)
    }

    animate()

    return () => {
      window.removeEventListener('resize', handleResize)
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{ position: 'fixed', inset: 0, zIndex: 0, display: 'block', width: '100vw', height: '100vh' }}
    />
  )
}
