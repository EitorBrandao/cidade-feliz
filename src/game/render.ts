// Desenho do jogo no canvas. Arte provisória feita com formas; os PNGs entram na Fase 5.
import { cfg, defs } from './data'
import type { Building, BuildingDef, Float, GameState } from './types'
import * as G from './state'

export const TW = cfg.tile_w
export const TH = cfg.tile_h
const HW = TW / 2
const HH = TH / 2
const N = cfg.map_size
const C = cfg.colors
const OUT = C.outline
const FONT = "'Baloo 2', system-ui, sans-serif"

type P = { x: number; y: number }
type Ctx = CanvasRenderingContext2D

export interface Cam { x: number; y: number; zoom: number }
export interface Overlay {
  ghost?: { def: string; x: number; y: number; ok: boolean } | null
  roadMode: boolean
  floats: Float[]
}

export const iso = (x: number, y: number): P => ({ x: (x - y) * HW, y: (x + y) * HH })
export function toTile(px: number, py: number) {
  const a = px / HW
  const b = py / HH
  return { x: Math.round((a + b) / 2), y: Math.round((b - a) / 2) }
}
export function mapBounds() {
  return {
    left: iso(0, N - 1).x - HW,
    right: iso(N - 1, 0).x + HW,
    top: iso(0, 0).y - HH,
    bottom: iso(N - 1, N - 1).y + HH + cfg.ground_depth,
  }
}

// ---------- utilidades ----------

const up = (p: P, h: number): P => ({ x: p.x, y: p.y - h })
const lerp = (a: P, b: P, t: number): P => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })

function hexRgb(hex: string) {
  const v = parseInt(hex.slice(1), 16)
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255]
}
export function shade(hex: string, amt: number) {
  const [r, g, b] = hexRgb(hex)
  const f = (c: number) => Math.round(amt < 0 ? c * (1 + amt) : c + (255 - c) * amt)
  return `rgb(${f(r)},${f(g)},${f(b)})`
}

function poly(ctx: Ctx, pts: P[], fill: string, stroke: string | null = OUT, lw = 2) {
  ctx.beginPath()
  ctx.moveTo(pts[0].x, pts[0].y)
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y)
  ctx.closePath()
  ctx.fillStyle = fill
  ctx.fill()
  if (stroke) {
    ctx.strokeStyle = stroke
    ctx.lineWidth = lw
    ctx.lineJoin = 'round'
    ctx.stroke()
  }
}

function diamond(c: P, k: number) {
  return {
    n: { x: c.x, y: c.y - HH * k },
    e: { x: c.x + HW * k, y: c.y },
    s: { x: c.x, y: c.y + HH * k },
    w: { x: c.x - HW * k, y: c.y },
  }
}

/** Retângulo numa face, entre t0..t1 ao longo da base e z0..z1 de altura. */
function faceQuad(p0: P, p1: P, t0: number, t1: number, z0: number, z1: number): P[] {
  const a = lerp(p0, p1, t0)
  const b = lerp(p0, p1, t1)
  return [up(a, z0), up(b, z0), up(b, z1), up(a, z1)]
}

function hash(x: number, y: number) {
  let h = (x * 374761393 + y * 668265263) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) % 1000
}

// ---------- chão ----------

function drawGround(ctx: Ctx, s: GameState) {
  const d = cfg.ground_depth
  const left = { x: iso(0, N - 1).x - HW, y: iso(0, N - 1).y }
  const bottom = { x: iso(N - 1, N - 1).x, y: iso(N - 1, N - 1).y + HH }
  const right = { x: iso(N - 1, 0).x + HW, y: iso(N - 1, 0).y }
  poly(ctx, [left, bottom, { x: bottom.x, y: bottom.y + d }, { x: left.x, y: left.y + d }], C.dirt_side_left, null)
  poly(ctx, [bottom, right, { x: right.x, y: right.y + d }, { x: bottom.x, y: bottom.y + d }], C.dirt_side_right, null)

  const line = C.grass_line + '40'
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const c = iso(x, y)
      const q = diamond(c, 1)
      const pts = [q.n, q.e, q.s, q.w]
      if (G.isBorder(x, y)) poly(ctx, pts, C.dirt, null)
      else if (s.tiles[y][x].road) drawRoad(ctx, s, x, y, c, q)
      else poly(ctx, pts, C.grass[hash(x, y) % C.grass.length], null)
      poly(ctx, pts, 'transparent', line, 1)
    }
}

function drawRoad(ctx: Ctx, s: GameState, x: number, y: number, c: P, q: ReturnType<typeof diamond>) {
  poly(ctx, [q.n, q.e, q.s, q.w], C.sidewalk, null)
  const k = 0.7
  const i = diamond(c, k)
  poly(ctx, [i.n, i.e, i.s, i.w], C.asphalt, null)
  const conn = (a: P, b: P, step: P) => {
    const sh = { x: step.x * (1 - k) * 0.5, y: step.y * (1 - k) * 0.5 }
    poly(ctx, [a, { x: a.x + sh.x, y: a.y + sh.y }, { x: b.x + sh.x, y: b.y + sh.y }, b], C.asphalt, null)
  }
  const R = (dx: number, dy: number) => G.isRoad(s, x + dx, y + dy)
  if (R(1, 0)) conn(i.e, i.s, { x: HW, y: HH })
  if (R(-1, 0)) conn(i.w, i.n, { x: -HW, y: -HH })
  if (R(0, 1)) conn(i.s, i.w, { x: -HW, y: HH })
  if (R(0, -1)) conn(i.n, i.e, { x: HW, y: -HH })
  const ax = R(1, 0) || R(-1, 0)
  const ay = R(0, 1) || R(0, -1)
  if (ax !== ay) {
    const u = ax ? { x: HW, y: HH } : { x: -HW, y: HH }
    ctx.strokeStyle = C.lane
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    for (const [t0, t1] of [[-0.375, -0.125], [0.125, 0.375]]) {
      ctx.beginPath()
      ctx.moveTo(c.x + u.x * t0, c.y + u.y * t0)
      ctx.lineTo(c.x + u.x * t1, c.y + u.y * t1)
      ctx.stroke()
    }
  }
}

// ---------- construções ----------

function box(ctx: Ctx, c: P, k: number, h: number, color: string) {
  const q = diamond(c, k)
  poly(ctx, [q.w, q.s, up(q.s, h), up(q.w, h)], shade(color, -0.25))
  poly(ctx, [q.s, q.e, up(q.e, h), up(q.s, h)], shade(color, -0.08))
  poly(ctx, [up(q.n, h), up(q.e, h), up(q.s, h), up(q.w, h)], shade(color, 0.12))
  return q
}

const GLASS = '#bfe6ff'

function windows(ctx: Ctx, q: ReturnType<typeof diamond>, h: number, rows: number, cols: number, z0: number) {
  const rowH = (h - z0) / rows
  for (let r = 0; r < rows; r++) {
    const zA = z0 + r * rowH + rowH * 0.25
    const zB = z0 + r * rowH + rowH * 0.75
    for (let i = 0; i < cols; i++) {
      const t0 = (i + 0.25) / cols
      const t1 = (i + 0.75) / cols
      poly(ctx, faceQuad(q.w, q.s, t0, t1, zA, zB), GLASS, OUT, 1.2)
      poly(ctx, faceQuad(q.s, q.e, t0, t1, zA, zB), shade(GLASS, 0.3), OUT, 1.2)
    }
  }
}

function drawTree(ctx: Ctx, c: P, color: string, scale = 1) {
  const trunk = { x: c.x, y: c.y + 2 }
  ctx.fillStyle = 'rgba(0,0,0,0.18)'
  ctx.beginPath()
  ctx.ellipse(c.x, c.y + 3, 14 * scale, 6 * scale, 0, 0, Math.PI * 2)
  ctx.fill()
  poly(ctx, [
    { x: trunk.x - 3 * scale, y: trunk.y }, { x: trunk.x + 3 * scale, y: trunk.y },
    { x: trunk.x + 3 * scale, y: trunk.y - 16 * scale }, { x: trunk.x - 3 * scale, y: trunk.y - 16 * scale },
  ], '#7a4a2a', OUT, 1.5)
  const blobs: [number, number, number, string][] = [
    [-8, -20, 10, shade(color, -0.15)], [8, -21, 10, shade(color, -0.05)], [0, -30, 12, color], [-2, -33, 6, shade(color, 0.25)],
  ]
  for (const [dx, dy, r, col] of blobs) {
    ctx.beginPath()
    ctx.arc(c.x + dx * scale, c.y + dy * scale, r * scale, 0, Math.PI * 2)
    ctx.fillStyle = col
    ctx.fill()
    ctx.strokeStyle = OUT
    ctx.lineWidth = 1.5
    ctx.stroke()
  }
}

/** Altura do topo da construção, para pôr moeda e barra em cima. */
export function topOf(d: BuildingDef) {
  const L = d.look
  if (L.shape === 'house') return L.h + 22 * L.k
  if (L.shape === 'civic') return L.h + 30
  if (L.shape === 'tree') return 40
  return L.h + 6
}

export function drawDef(ctx: Ctx, d: BuildingDef, c: P, t: number) {
  const L = d.look
  const h = L.h
  switch (L.shape) {
    case 'house': {
      const q = box(ctx, c, L.k, h, L.color)
      windows(ctx, q, h * 0.85, h > 30 ? 2 : 1, 2, 4)
      poly(ctx, faceQuad(q.s, q.e, 0.38, 0.62, 0, Math.min(16, h * 0.6)), '#8a5a3c', OUT, 1.5)
      const apex = up(c, h + 22 * L.k)
      const roof = L.roof ?? '#c0392b'
      poly(ctx, [up(q.w, h), up(q.s, h), apex], shade(roof, -0.2))
      poly(ctx, [up(q.s, h), up(q.e, h), apex], roof)
      break
    }
    case 'shop': {
      const q = box(ctx, c, L.k, h, L.color)
      poly(ctx, faceQuad(q.w, q.s, 0.12, 0.88, 3, h - 13), GLASS, OUT, 1.5)
      poly(ctx, faceQuad(q.s, q.e, 0.3, 0.7, 0, h - 13), '#8a5a3c', OUT, 1.5)
      const acc = L.accent ?? '#e94b3c'
      for (let i = 0; i < 5; i++) {
        const col = i % 2 ? '#ffffff' : acc
        poly(ctx, faceQuad(q.w, q.s, i / 5, (i + 1) / 5, h - 11, h - 3), col, null)
        poly(ctx, faceQuad(q.s, q.e, i / 5, (i + 1) / 5, h - 11, h - 3), col, null)
      }
      poly(ctx, faceQuad(q.w, q.s, 0, 1, h - 11, h - 3), 'transparent', OUT, 1.5)
      poly(ctx, faceQuad(q.s, q.e, 0, 1, h - 11, h - 3), 'transparent', OUT, 1.5)
      break
    }
    case 'tower': {
      const q = box(ctx, c, L.k, h, L.color)
      windows(ctx, q, h - 4, Math.floor(h / 14), 3, 4)
      poly(ctx, [up(q.n, h), up(q.e, h), up(q.s, h), up(q.w, h)], shade(L.accent ?? '#4a6fa5', 0.1))
      break
    }
    case 'civic': {
      const q = box(ctx, c, L.k, h, L.color)
      windows(ctx, q, h - 6, h > 40 ? 2 : 1, 3, 6)
      poly(ctx, faceQuad(q.s, q.e, 0.4, 0.6, 0, 16), '#8a5a3c', OUT, 1.5)
      const acc = L.accent ?? '#2f6fbf'
      poly(ctx, faceQuad(q.w, q.s, 0, 1, h - 5, h), acc, OUT, 1.5)
      poly(ctx, faceQuad(q.s, q.e, 0, 1, h - 5, h), shade(acc, 0.15), OUT, 1.5)
      if (L.extra === 'cross') {
        poly(ctx, faceQuad(q.s, q.e, 0.12, 0.3, h - 22, h - 9), '#ffffff', OUT, 1)
        poly(ctx, faceQuad(q.s, q.e, 0.18, 0.24, h - 20, h - 11), acc, null)
        poly(ctx, faceQuad(q.s, q.e, 0.14, 0.28, h - 17.5, h - 13.5), acc, null)
      }
      if (L.extra === 'clock') {
        const cc = up(lerp(q.s, q.e, 0.5), h + 8)
        ctx.beginPath()
        ctx.arc(cc.x, cc.y, 8, 0, Math.PI * 2)
        ctx.fillStyle = '#fffbe8'
        ctx.fill()
        ctx.strokeStyle = OUT
        ctx.lineWidth = 2
        ctx.stroke()
        ctx.beginPath()
        ctx.moveTo(cc.x, cc.y)
        ctx.lineTo(cc.x, cc.y - 5)
        ctx.moveTo(cc.x, cc.y)
        ctx.lineTo(cc.x + 4, cc.y)
        ctx.stroke()
      }
      // mastro e bandeira balançando
      const base = up(c, h)
      const topP = up(c, h + 30)
      ctx.strokeStyle = OUT
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(base.x, base.y)
      ctx.lineTo(topP.x, topP.y)
      ctx.stroke()
      const wave = (i: number) => Math.sin(t / 250 + i) * 2
      poly(ctx, [
        topP, { x: topP.x + 9, y: topP.y + wave(0) }, { x: topP.x + 18, y: topP.y + 1 + wave(1) },
        { x: topP.x + 18, y: topP.y + 11 + wave(1) }, { x: topP.x + 9, y: topP.y + 10 + wave(0) }, { x: topP.x, y: topP.y + 10 },
      ], acc, OUT, 1.5)
      break
    }
    case 'plaza': {
      const q = diamond(c, L.k)
      poly(ctx, [q.n, q.e, q.s, q.w], L.color, OUT, 1.5)
      const i = diamond(c, L.k * 0.45)
      poly(ctx, [i.n, i.e, i.s, i.w], '#c9c0aa', OUT, 1.2)
      ctx.beginPath()
      ctx.ellipse(c.x, c.y, 11, 5.5, 0, 0, Math.PI * 2)
      ctx.fillStyle = L.accent ?? '#5ab4e6'
      ctx.fill()
      ctx.strokeStyle = OUT
      ctx.lineWidth = 1.5
      ctx.stroke()
      const jet = 6 + Math.sin(t / 200) * 2
      ctx.strokeStyle = '#dff4ff'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(c.x, c.y)
      ctx.lineTo(c.x, c.y - jet)
      ctx.stroke()
      drawTree(ctx, { x: c.x - HW * 0.55, y: c.y }, '#5cbf5f', 0.55)
      drawTree(ctx, { x: c.x + HW * 0.55, y: c.y }, '#5cbf5f', 0.55)
      break
    }
    case 'tree':
      drawTree(ctx, c, L.color, 1)
      break
    case 'bed': {
      const q = diamond(c, L.k)
      poly(ctx, [q.w, q.s, up(q.s, 5), up(q.w, 5)], shade(L.color, -0.25), OUT, 1.5)
      poly(ctx, [q.s, q.e, up(q.e, 5), up(q.s, 5)], shade(L.color, -0.05), OUT, 1.5)
      poly(ctx, [up(q.n, 5), up(q.e, 5), up(q.s, 5), up(q.w, 5)], '#6b8f3a', OUT, 1.5)
      const flowers = [L.accent ?? '#ff7aa8', '#ffd84d', '#ffffff', '#b07cff']
      for (let i = 0; i < 9; i++) {
        const fx = c.x + ((i % 3) - 1) * 12 + ((i / 3) | 0) * 4 - 4
        const fy = c.y - 5 + (((i / 3) | 0) - 1) * 5
        ctx.beginPath()
        ctx.arc(fx, fy, 2.6, 0, Math.PI * 2)
        ctx.fillStyle = flowers[i % flowers.length]
        ctx.fill()
      }
      break
    }
  }
}

function drawScaffold(ctx: Ctx, d: BuildingDef, c: P, p: number) {
  const L = d.look
  const k = L.k
  const q = diamond(c, k)
  poly(ctx, [q.n, q.e, q.s, q.w], '#b8a98f', OUT, 1.5)
  const h = Math.max(10, L.h * (0.3 + 0.7 * p))
  ctx.globalAlpha = 0.85
  box(ctx, c, k * 0.85, h * 0.8, L.color)
  ctx.globalAlpha = 1
  ctx.strokeStyle = '#c98a2b'
  ctx.lineWidth = 2
  for (const corner of [q.w, q.s, q.e]) {
    ctx.beginPath()
    ctx.moveTo(corner.x, corner.y)
    ctx.lineTo(corner.x, corner.y - h)
    ctx.stroke()
  }
  for (let z = 8; z < h; z += 10) {
    ctx.beginPath()
    ctx.moveTo(q.w.x, q.w.y - z)
    ctx.lineTo(q.s.x, q.s.y - z)
    ctx.lineTo(q.e.x, q.e.y - z)
    ctx.stroke()
  }
}

function drawCoin(ctx: Ctx, p: P, t: number) {
  const y = p.y + Math.sin(t / 300) * 3
  ctx.fillStyle = 'rgba(0,0,0,0.2)'
  ctx.beginPath()
  ctx.ellipse(p.x, p.y + 14, 8, 3, 0, 0, Math.PI * 2)
  ctx.fill()
  const sx = Math.abs(Math.cos(t / 500)) * 0.35 + 0.65
  ctx.beginPath()
  ctx.ellipse(p.x, y, 11 * sx, 11, 0, 0, Math.PI * 2)
  ctx.fillStyle = '#ffd84d'
  ctx.fill()
  ctx.lineWidth = 2.5
  ctx.strokeStyle = '#b8860b'
  ctx.stroke()
  ctx.beginPath()
  ctx.ellipse(p.x, y, 6 * sx, 6, 0, 0, Math.PI * 2)
  ctx.strokeStyle = '#e0a800'
  ctx.lineWidth = 2
  ctx.stroke()
}

function drawBar(ctx: Ctx, p: P, v: number, color: string) {
  const w = 44
  ctx.fillStyle = 'rgba(30,35,50,0.85)'
  roundRect(ctx, p.x - w / 2 - 2, p.y - 2, w + 4, 10, 5)
  ctx.fill()
  ctx.fillStyle = color
  roundRect(ctx, p.x - w / 2, p.y, Math.max(6, w * v), 6, 3)
  ctx.fill()
}

function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function drawPlate(ctx: Ctx, p: P, text: string) {
  ctx.font = `700 11px ${FONT}`
  const w = ctx.measureText(text).width + 12
  ctx.fillStyle = 'rgba(255,250,235,0.95)'
  roundRect(ctx, p.x - w / 2, p.y, w, 16, 5)
  ctx.fill()
  ctx.strokeStyle = OUT
  ctx.lineWidth = 1.5
  ctx.stroke()
  ctx.fillStyle = '#3a2e22'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, p.x, p.y + 8.5)
}

// ---------- quadro inteiro ----------

export function drawWorld(ctx: Ctx, W: number, H: number, cam: Cam, s: GameState, ov: Overlay, t: number) {
  const sky = ctx.createLinearGradient(0, 0, 0, H)
  sky.addColorStop(0, C.sky_top)
  sky.addColorStop(1, C.sky_bottom)
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, W, H)

  // nuvens passando
  ctx.fillStyle = 'rgba(255,255,255,0.75)'
  for (let i = 0; i < 4; i++) {
    const span = W + 260
    const cx = ((t / (60 + i * 25) + i * 330) % span) - 130
    const cy = 70 + i * 0.27 * H
    for (const [dx, dy, r] of [[0, 0, 26], [24, -10, 22], [46, 2, 20], [-22, 4, 18]]) {
      ctx.beginPath()
      ctx.arc(cx + dx, cy + dy, r, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  ctx.save()
  ctx.translate(W / 2, H / 2)
  ctx.scale(cam.zoom, cam.zoom)
  ctx.translate(-cam.x, -cam.y)

  drawGround(ctx, s)

  // fantasma no chão
  const g = ov.ghost
  if (g && G.inBounds(g.x, g.y)) {
    const q = diamond(iso(g.x, g.y), 1)
    poly(ctx, [q.n, q.e, q.s, q.w], g.ok ? 'rgba(80,220,90,0.45)' : 'rgba(240,70,60,0.45)', g.ok ? '#2e9e3c' : '#b52a20', 2)
  }

  // objetos em ordem de profundidade
  const items: { d: number; draw: () => void }[] = []
  const byUid = new Map(s.buildings.map((b) => [b.uid, b]))
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const tile = s.tiles[y][x]
      const c = iso(x, y)
      if (tile.tree) {
        const sc = 0.85 + (hash(x, y) % 30) / 100
        items.push({ d: x + y, draw: () => drawTree(ctx, c, '#3fa34d', sc) })
      }
      if (tile.b) {
        const b = byUid.get(tile.b)
        if (!b) continue
        const d = defs[b.def]
        items.push({
          d: x + y,
          draw: () => (G.isBuilding(b, t) ? drawScaffold(ctx, d, c, G.buildProgress(b, t)) : drawDef(ctx, d, c, t)),
        })
      }
    }
  if (g && g.def !== 'road' && G.inBounds(g.x, g.y) && defs[g.def]) {
    const c = iso(g.x, g.y)
    items.push({
      d: g.x + g.y + 0.5,
      draw: () => {
        ctx.globalAlpha = 0.7
        drawDef(ctx, defs[g.def], c, t)
        ctx.globalAlpha = 1
      },
    })
  }
  items.sort((a, b) => a.d - b.d)
  for (const it of items) it.draw()

  // por cima de tudo: placas, moedas, barras
  for (const b of s.buildings) {
    const d = defs[b.def]
    const c = iso(b.x, b.y)
    if (b.name && cam.zoom >= 0.5) drawPlate(ctx, { x: c.x, y: c.y + HH * d.look.k + 3 }, b.name)
    const top = up(c, topOf(d) + 14)
    if (G.isBuilding(b, t)) drawBar(ctx, top, G.buildProgress(b, t), '#ffb02e')
    else if (G.isReady(b, t)) drawCoin(ctx, up(top, 6), t)
  }

  // números flutuando
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  for (const f of ov.floats) {
    const age = (t - f.t0) / 1300
    if (age > 1) continue
    ctx.globalAlpha = 1 - age * age
    ctx.font = `800 18px ${FONT}`
    ctx.lineWidth = 4
    ctx.strokeStyle = OUT
    const y = f.wy - age * 46
    ctx.strokeText(f.text, f.wx, y)
    ctx.fillStyle = f.color
    ctx.fillText(f.text, f.wx, y)
  }
  ctx.globalAlpha = 1
  ctx.restore()
}

/** Miniatura de uma construção, para a Loja. */
export function drawPreview(canvas: HTMLCanvasElement, d: BuildingDef) {
  const dpr = window.devicePixelRatio || 1
  const W = canvas.clientWidth
  const H = canvas.clientHeight
  canvas.width = W * dpr
  canvas.height = H * dpr
  const ctx = canvas.getContext('2d')!
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, W, H)
  const top = topOf(d) + 4
  const total = top + HH + 6
  const sc = Math.min(W / (TW + 8), H / total, 1.2)
  ctx.translate(W / 2, H - (HH + 4) * sc)
  ctx.scale(sc, sc)
  const q = diamond({ x: 0, y: 0 }, 1)
  poly(ctx, [q.n, q.e, q.s, q.w], C.grass[0], null)
  drawDef(ctx, d, { x: 0, y: 0 }, 0)
}

export type { Building }
