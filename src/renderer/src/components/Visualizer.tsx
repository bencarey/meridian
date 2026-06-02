import { useRef, useEffect } from 'react'

const PHI = 1.618033988749895

interface Particle {
  x: number; y: number; vx: number; vy: number; life: number; maxLife: number; size: number
}

type GeometryVariant = 'triangles' | 'circles' | 'mandala' | 'crystalline' | 'grid'

interface VisualizerProps {
  bgColor: string
  orbColor: string
  accentColor: string
  particleColor: string
  isPlaying: boolean
  sessionDurationSeconds?: number   // drives how slowly the geometry builds
  geometrySpeed?: number
  geometryVariant?: GeometryVariant
  onTick?: () => void
}

function hexToRgb(hex: string): [number, number, number] {
  const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!r) return [0, 0, 0]
  return [parseInt(r[1], 16), parseInt(r[2], 16), parseInt(r[3], 16)]
}

function rgba(hex: string, a: number): string {
  const [r, g, b] = hexToRgb(hex)
  return `rgba(${r},${g},${b},${Math.max(0, a)})`
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
  accent: string, orb: string,
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

// ── VARIANT: CIRCLES (flow-state) — Vesica Piscis / Flower of Life ──────────

function drawCirclesVariant(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  B: number, t: number, spd: number,
  accent: string, orb: string,
  bp: number
): void {
  const folR = B * 0.25

  // Outer hexagon
  const hexA = elementAlpha(bp, 0.06, 0.12)
  if (hexA > 0.01) {
    ctx.strokeStyle = rgba(accent, hexA * 0.22)
    ctx.lineWidth = 0.7
    ctx.setLineDash([])
    drawPolygon(ctx, cx, cy, 6, B * 0.92, t * 0.005 * spd)
    ctx.stroke()
  }

  // Flower of Life — primary element, reveals early
  const folA = elementAlpha(bp, 0.06, 0.18) * 0.32
  const folReveal = Math.max(0, Math.min(1, (bp - 0.06) / 0.20))
  if (folA > 0.003) {
    drawFlowerOfLife(ctx, cx, cy, folR, t * 0.010 * spd, orb, folA, folReveal)
  }

  // Vesica piscis overlapping rings at golden ratio distances
  const vA = elementAlpha(bp, 0.28, 0.14) * 0.18
  if (vA > 0.005) {
    ctx.strokeStyle = rgba(accent, vA)
    ctx.lineWidth = 0.5
    ctx.setLineDash([])
    const offsets = [folR, folR * PHI]
    for (const off of offsets) {
      for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * Math.PI * 2 + t * 0.008 * spd
        ctx.beginPath()
        ctx.arc(cx + off * Math.cos(angle), cy + off * Math.sin(angle), folR, 0, Math.PI * 2)
        ctx.stroke()
      }
    }
  }

  // Inner hexagram
  const stA = elementAlpha(bp, 0.44, 0.14)
  if (stA > 0.01) {
    ctx.shadowBlur = 12
    ctx.shadowColor = rgba(accent, stA * 0.45)
    ctx.strokeStyle = rgba(accent, stA * 0.50)
    ctx.lineWidth = 1.0
    ctx.setLineDash([])
    drawPolygon(ctx, cx, cy, 3, B * 0.45, t * 0.012 * spd)
    ctx.stroke()
    drawPolygon(ctx, cx, cy, 3, B * 0.45, -t * 0.009 * spd + Math.PI / 3)
    ctx.stroke()
    ctx.shadowBlur = 0
  }

  // Concentric circles — breathing
  const concA = elementAlpha(bp, 0.58, 0.14)
  if (concA > 0.01) {
    ctx.shadowBlur = 6
    ctx.shadowColor = rgba(accent, concA * 0.3);
    [B, B / PHI, B / (PHI * PHI), B / (PHI * PHI * PHI)].forEach((r, i) => {
      const a = concA * (1 - i * 0.2) * 0.32
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

  // 12 radial lines
  const rayA = elementAlpha(bp, 0.70, 0.12) * 0.22
  if (rayA > 0.005) {
    ctx.strokeStyle = rgba(accent, rayA)
    ctx.lineWidth = 0.4
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2 + t * 0.004 * spd
      ctx.beginPath()
      ctx.moveTo(cx, cy)
      ctx.lineTo(cx + B * 0.88 * Math.cos(angle), cy + B * 0.88 * Math.sin(angle))
      ctx.stroke()
    }
  }

  // Center dot
  const dotA = elementAlpha(bp, 0.82, 0.12)
  if (dotA > 0.01) {
    const pulse = 1 + 0.35 * Math.sin(t * 1.1) * dotA
    ctx.shadowBlur = 20 * dotA
    ctx.shadowColor = rgba(accent, 0.9)
    ctx.fillStyle = rgba(accent, dotA * 0.95)
    ctx.beginPath()
    ctx.arc(cx, cy, 3.5 * pulse, 0, Math.PI * 2)
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
  accent: string, orb: string,
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
  accent: string, orb: string,
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

// ── MAIN COMPONENT ───────────────────────────────────────────────────────────

export function Visualizer({
  bgColor, orbColor, accentColor, particleColor,
  isPlaying, sessionDurationSeconds = 25 * 60,
  geometrySpeed = 1.0, geometryVariant = 'triangles', onTick
}: VisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const timeRef = useRef(0)
  const buildProgressRef = useRef(0)
  const particlesRef = useRef<Particle[]>([])
  const rafRef = useRef<number | null>(null)

  const bgColorRef = useRef(bgColor)
  const orbColorRef = useRef(orbColor)
  const accentColorRef = useRef(accentColor)
  const particleColorRef = useRef(particleColor)
  const isPlayingRef = useRef(isPlaying)
  const sessionDurationRef = useRef(sessionDurationSeconds)
  const geometrySpeedRef = useRef(geometrySpeed)
  const geometryVariantRef = useRef(geometryVariant)
  const onTickRef = useRef(onTick)

  bgColorRef.current = bgColor
  orbColorRef.current = orbColor
  accentColorRef.current = accentColor
  particleColorRef.current = particleColor
  isPlayingRef.current = isPlaying
  sessionDurationRef.current = sessionDurationSeconds
  geometrySpeedRef.current = geometrySpeed
  geometryVariantRef.current = geometryVariant
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

      // Build geometry over the full session duration so new elements
      // emerge throughout — not fully built in 18 seconds then static.
      // At ~60 fps: sessionDurationSeconds * 60 frames = full build.
      const dur = sessionDurationRef.current ?? 25 * 60
      const bpSpeed = playing ? 1 / (dur * 60) : -1 / 240
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

      // Ambient glow
      const glowAlpha = 0.12 + (playing ? 0.18 : 0) * bp
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

      // Dispatch to variant
      ctx.setLineDash([])
      if (variant === 'triangles') {
        drawTrianglesVariant(ctx, cx, cy, B, t, spd, accent, orb, bp)
      } else if (variant === 'circles') {
        drawCirclesVariant(ctx, cx, cy, B, t, spd, accent, orb, bp)
      } else if (variant === 'mandala') {
        drawMandalaVariant(ctx, cx, cy, B, t, spd, accent, orb, bp)
      } else if (variant === 'crystalline') {
        drawCrystallineVariant(ctx, cx, cy, B, t, spd, accent, orb, bp)
      } else if (variant === 'grid') {
        drawGridVariant(ctx, cx, cy, B, t, spd, accent, orb, bp)
      }

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
