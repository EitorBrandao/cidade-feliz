// Desenho do jogo no canvas, no mesmo estilo do protótipo aprovado.
import { cfg, DEFS, type Bot, type Def } from './data'
import { cidadeAtual, curMap, DIRS, game, isRoad, N, nomeDe, tempoMs, canPlace, type B, type Tile } from './state'
import { hash, pick, rand, rng } from './util'

export const TW = cfg.tile_w
export const TH = cfg.tile_h
type Pt = [number, number]
type Ctx = CanvasRenderingContext2D
let G: Ctx
let T = 0

export const iso = (x: number, y: number): Pt => [((x - y) * TW) / 2, ((x + y) * TH) / 2]

function rgb(h: string) {
  h = h.replace('#', '')
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  const n = parseInt(h, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
export function shade(h: string, f: number) {
  const c = rgb(h)
  const m = (v: number) => Math.round(f <= 1 ? v * f : v + (255 - v) * (f - 1))
  return `rgb(${m(c[0])},${m(c[1])},${m(c[2])})`
}

// ---------- primitivas ----------

function P(pts: Pt[], fill: string | CanvasGradient, stroke = true) {
  G.beginPath()
  G.moveTo(pts[0][0], pts[0][1])
  for (let i = 1; i < pts.length; i++) G.lineTo(pts[i][0], pts[i][1])
  G.closePath()
  G.fillStyle = fill
  G.fill()
  if (stroke) {
    G.strokeStyle = 'rgba(40,30,10,.35)'
    G.lineWidth = 1
    G.stroke()
  }
}
type Corners = { t: Pt; r: Pt; b: Pt; l: Pt }
function Cn(sx: number, sy: number, s: number): Corners {
  const hw = (TW / 2) * s
  const hh = (TH / 2) * s
  return { t: [sx, sy - hh], r: [sx + hw, sy], b: [sx, sy + hh], l: [sx - hw, sy] }
}
const U = (p: Pt, h: number): Pt => [p[0], p[1] - h]
const L = (a: Pt, b: Pt, u: number): Pt => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u]
function circle(x: number, y: number, r: number, f: string | CanvasGradient) {
  G.beginPath()
  G.arc(x, y, r, 0, Math.PI * 2)
  G.fillStyle = f
  G.fill()
}
function shadowAt(sx: number, sy: number, s: number) {
  G.beginPath()
  G.ellipse(sx + 6, sy + 3, (TW / 2) * s, (TH / 2) * s, 0, 0, Math.PI * 2)
  G.fillStyle = 'rgba(0,0,0,.13)'
  G.fill()
}
function box(sx: number, sy: number, s: number, h0: number, h1: number, col: string) {
  const c = Cn(sx, sy, s)
  P([U(c.l, h0), U(c.b, h0), U(c.b, h1), U(c.l, h1)], shade(col, 0.88))
  P([U(c.b, h0), U(c.r, h0), U(c.r, h1), U(c.b, h1)], shade(col, 0.72))
  P([U(c.t, h1), U(c.r, h1), U(c.b, h1), U(c.l, h1)], col)
  return c
}
function fq(A: Pt, Bp: Pt, u0: number, u1: number, v0: number, v1: number, col: string, st?: boolean | number) {
  const a = L(A, Bp, u0)
  const b = L(A, Bp, u1)
  P([U(a, v0), U(b, v0), U(b, v1), U(a, v1)], col, !!st)
}
function win(A: Pt, Bp: Pt, u0: number, u1: number, v0: number, v1: number) {
  fq(A, Bp, u0 - 0.02, u1 + 0.02, v0 - 1.5, v1 + 1.5, '#fff')
  fq(A, Bp, u0, u1, v0, v1, '#8fd0f5')
  fq(A, Bp, u0, (u0 + u1) / 2 - 0.01, (v0 + v1) / 2, v1, '#c5ebff')
}
function gable(sx: number, sy: number, s: number, h: number, rh: number, col: string, wall: string) {
  const c = Cn(sx, sy, s + 0.1)
  const cw = Cn(sx, sy, s)
  const mTL = U(L(c.t, c.l, 0.5), h + rh)
  const mRB = U(L(c.r, c.b, 0.5), h + rh)
  P([U(c.t, h), U(c.r, h), mRB, mTL], shade(col, 1.05))
  P([U(cw.b, h), U(cw.r, h), U(L(cw.r, cw.b, 0.5), h + rh * 0.9)], shade(wall, 0.72))
  P([U(c.l, h), U(c.b, h), mRB, mTL], shade(col, 0.85))
  G.strokeStyle = shade(col, 1.3)
  G.lineWidth = 2
  G.beginPath()
  G.moveTo(mTL[0], mTL[1])
  G.lineTo(mRB[0], mRB[1])
  G.stroke()
}

// ---------- construções ----------

function drawHouse(sx: number, sy: number, d: Def) {
  const h = d.h!
  const s = 0.6
  shadowAt(sx, sy, 0.7)
  const c = box(sx, sy, s, 0, h, d.wall!)
  const fl = d.floors || 1
  for (let f = 0; f < fl; f++) {
    const v0 = 6 + f * (h / fl)
    const v1 = v0 + (h / fl) * 0.48
    win(c.l, c.b, 0.15, 0.38, v0, v1)
    win(c.l, c.b, 0.6, 0.83, v0, v1)
    if (f > 0) win(c.b, c.r, 0.55, 0.8, v0, v1)
  }
  fq(c.b, c.r, 0.3, 0.55, 0, Math.min(h * 0.6, 18), '#7a4a2b', 1)
  gable(sx, sy, s, h, 22, d.roof!, d.wall!)
  const ch = L(Cn(sx, sy, s).t, Cn(sx, sy, s).r, 0.55)
  box(ch[0] + 4, ch[1] + 6, 0.08, h + 8, h + 22, '#a0522d')
  circle(sx - TW * 0.3, sy + 2, 5, '#4fa83a')
  circle(sx - TW * 0.26, sy - 1, 4, '#6cc644')
}
function drawShop(sx: number, sy: number, d: Def) {
  const s = 0.7
  const h = d.h!
  shadowAt(sx, sy, 0.8)
  const c = box(sx, sy, s, 0, h, d.wall!)
  win(c.l, c.b, 0.1, 0.9, 4, h * 0.48)
  for (let i = 0; i < 6; i++) fq(c.l, c.b, i / 6, (i + 1) / 6, h * 0.5, h * 0.66, i % 2 ? '#ffffff' : d.roof!, 1)
  fq(c.b, c.r, 0.25, 0.5, 0, h * 0.55, '#6d4c2e', 1)
  win(c.b, c.r, 0.62, 0.88, 6, h * 0.5)
  fq(c.l, c.b, 0, 1, h * 0.72, h * 0.97, d.sign!, 1)
  fq(c.b, c.r, 0, 1, h * 0.72, h * 0.97, shade(d.sign!, 0.82), 1)
  box(sx, sy, s + 0.03, h, h + 4, d.roof!)
  G.font = '26px system-ui, sans-serif'
  G.textAlign = 'center'
  G.textBaseline = 'middle'
  G.fillText(d.icon || '🏪', sx, sy - h - 16)
}
function drawTower(sx: number, sy: number, d: Def) {
  const s = 0.66
  const h = d.h!
  shadowAt(sx, sy, 0.9)
  const c = box(sx, sy, s, 0, h, d.wall!)
  for (let v = 18; v < h - 8; v += 13)
    for (let i = 0; i < 3; i++) {
      win(c.l, c.b, 0.1 + i * 0.3, 0.3 + i * 0.3, v, v + 7)
      win(c.b, c.r, 0.1 + i * 0.3, 0.3 + i * 0.3, v, v + 7)
    }
  fq(c.l, c.b, 0, 1, 0, 12, '#9aa5b1', 1)
  fq(c.b, c.r, 0.35, 0.65, 0, 12, '#4a5560', 1)
  box(sx, sy, s + 0.03, h, h + 4, d.roof!)
  box(sx - 6, sy - 2, 0.18, h + 4, h + 14, '#c3cad3')
}
function drawSchool(sx: number, sy: number, d: Def) {
  const s = 0.82
  const h = d.h!
  shadowAt(sx, sy, 0.9)
  const c = box(sx, sy, s, 0, h, d.wall!)
  for (let i = 0; i < 4; i++) win(c.l, c.b, 0.07 + i * 0.235, 0.24 + i * 0.235, h * 0.3, h * 0.68)
  fq(c.b, c.r, 0.38, 0.62, 0, h * 0.52, '#7a4a2b', 1)
  win(c.b, c.r, 0.72, 0.9, h * 0.3, h * 0.65)
  win(c.b, c.r, 0.1, 0.28, h * 0.3, h * 0.65)
  gable(sx, sy, s, h, 20, d.roof!, d.wall!)
  if (d.cross) {
    const p = U(L(c.b, c.r, 0.5), h + 8)
    G.fillStyle = '#fff'
    G.beginPath()
    G.arc(p[0], p[1], 9, 0, 7)
    G.fill()
    G.fillStyle = '#e53935'
    G.fillRect(p[0] - 2.5, p[1] - 6, 5, 12)
    G.fillRect(p[0] - 6, p[1] - 2.5, 12, 5)
  } else {
    const p: Pt = [sx, sy - h - 20]
    G.strokeStyle = '#555'
    G.lineWidth = 2
    G.beginPath()
    G.moveTo(p[0], p[1])
    G.lineTo(p[0], p[1] - 26)
    G.stroke()
    const w = Math.sin(T / 250) * 2
    G.fillStyle = '#2e9d4a'
    G.beginPath()
    G.moveTo(p[0], p[1] - 26)
    G.lineTo(p[0] + 18, p[1] - 23 + w)
    G.lineTo(p[0] + 18, p[1] - 13 + w)
    G.lineTo(p[0], p[1] - 16)
    G.fill()
    circle(p[0] + 9, p[1] - 19 + w / 2, 3, '#ffd54f')
  }
}
function drawHall(sx: number, sy: number) {
  shadowAt(sx, sy, 0.95)
  box(sx, sy, 0.94, 0, 5, '#d9d2c3')
  const h = 40
  const c = box(sx, sy, 0.82, 5, h, '#f7f3ea')
  for (let u = 0.08; u < 0.95; u += 0.17) fq(c.l, c.b, u, u + 0.06, 5, h - 4, '#ffffff', 1)
  for (let u = 0.1; u < 0.95; u += 0.17) win(c.l, c.b, u + 0.07, u + 0.13, 14, 26)
  fq(c.b, c.r, 0.35, 0.65, 5, 26, '#8a5a2b', 1)
  fq(c.b, c.r, 0.1, 0.2, 5, h - 4, '#fff', 1)
  fq(c.b, c.r, 0.8, 0.9, 5, h - 4, '#fff', 1)
  box(sx, sy, 0.88, h, h + 6, '#e0d6c2')
  G.beginPath()
  G.ellipse(sx, sy - h - 6, 17, 8.5, 0, 0, Math.PI * 2)
  G.fillStyle = '#cfc4ad'
  G.fill()
  G.beginPath()
  G.arc(sx, sy - h - 8, 15, Math.PI, 0)
  G.fillStyle = '#5a8fd6'
  G.fill()
  G.strokeStyle = 'rgba(0,0,0,.3)'
  G.stroke()
  G.beginPath()
  G.arc(sx - 5, sy - h - 14, 4, 0, 7)
  G.fillStyle = 'rgba(255,255,255,.35)'
  G.fill()
  G.strokeStyle = '#555'
  G.lineWidth = 2
  G.beginPath()
  G.moveTo(sx, sy - h - 23)
  G.lineTo(sx, sy - h - 44)
  G.stroke()
  const w = Math.sin(T / 250) * 2
  G.fillStyle = '#2e9d4a'
  G.fillRect(sx, sy - h - 44 + w * 0.3, 20, 11)
  G.fillStyle = '#ffd54f'
  G.beginPath()
  G.moveTo(sx + 3, sy - h - 38.5 + w * 0.3)
  G.lineTo(sx + 10, sy - h - 42 + w * 0.3)
  G.lineTo(sx + 17, sy - h - 38.5 + w * 0.3)
  G.lineTo(sx + 10, sy - h - 35 + w * 0.3)
  G.fill()
}
function drawTree(sx: number, sy: number, sc = 1, v = 0) {
  G.beginPath()
  G.ellipse(sx + 4, sy + 2, 14 * sc, 6 * sc, 0, 0, 7)
  G.fillStyle = 'rgba(0,0,0,.15)'
  G.fill()
  G.fillStyle = '#7a5230'
  G.fillRect(sx - 2.5 * sc, sy - 14 * sc, 5 * sc, 14 * sc)
  const gr = [['#3f9a2c', '#57b83e', '#8fdc66'], ['#2f8a3a', '#45a84f', '#86d685'], ['#5a9a24', '#78bb35', '#b2e06a']][v % 3]
  circle(sx, sy - 20 * sc, 13 * sc, gr[0])
  circle(sx - 6 * sc, sy - 25 * sc, 10 * sc, gr[1])
  circle(sx + 6 * sc, sy - 28 * sc, 9 * sc, gr[1])
  circle(sx - 3 * sc, sy - 31 * sc, 5 * sc, gr[2])
}
function drawPlaza(sx: number, sy: number) {
  const c = Cn(sx, sy, 0.94)
  P([c.t, c.r, c.b, c.l], '#eadfc4')
  ;[c.t, c.r, c.b, c.l].forEach((p) => {
    const q = L([sx, sy], p, 0.62)
    const k = Cn(q[0], q[1], 0.24)
    P([k.t, k.r, k.b, k.l], '#5cb33a', false)
  })
  G.beginPath()
  G.ellipse(sx, sy, 17, 8.5, 0, 0, 7)
  G.fillStyle = '#b9b2a2'
  G.fill()
  G.beginPath()
  G.ellipse(sx, sy, 13, 6.5, 0, 0, 7)
  G.fillStyle = '#6fc3f0'
  G.fill()
  G.fillStyle = '#b9b2a2'
  G.fillRect(sx - 2, sy - 12, 4, 12)
  const j = Math.sin(T / 200) * 1.5
  G.beginPath()
  G.ellipse(sx, sy - 14 + j, 5, 3, 0, 0, 7)
  G.fillStyle = 'rgba(220,245,255,.95)'
  G.fill()
  const t1 = L([sx, sy], c.t, 0.62)
  const t2 = L([sx, sy], c.r, 0.62)
  drawTree(t1[0], t1[1], 0.55, 1)
  drawTree(t2[0], t2[1], 0.55, 0)
}
function drawFlowers(sx: number, sy: number) {
  const c = Cn(sx, sy, 0.55)
  P([c.t, c.r, c.b, c.l], '#4fa83a')
  const R = rng(hash(sx + ':' + sy))
  const cols = ['#ff5c8a', '#ffd54f', '#ffffff', '#b388ff', '#ff8a50']
  for (let i = 0; i < 14; i++) {
    const u = R() * 2 - 1
    const v = R() * 2 - 1
    if (Math.abs(u) + Math.abs(v) > 0.9) continue
    circle(sx + u * TW * 0.25, sy + v * TH * 0.25 - 2, 2.6, pick(cols, R))
  }
}
export function drawKind(k: string, sx: number, sy: number) {
  const d = DEFS[k]
  switch (d.draw) {
    case 'house': drawHouse(sx, sy, d); break
    case 'shop': drawShop(sx, sy, d); break
    case 'tower': drawTower(sx, sy, d); break
    case 'school': drawSchool(sx, sy, d); break
    case 'hall': drawHall(sx, sy); break
    case 'plaza': drawPlaza(sx, sy); break
    case 'tree': drawTree(sx, sy, 1.05, 0); break
    case 'flowers': drawFlowers(sx, sy); break
  }
}
export function topOf(d: { draw: string; h?: number }) {
  const h = d.h ?? 0
  switch (d.draw) {
    case 'house': return h + 24
    case 'shop': return h + 38
    case 'tower': return h + 14
    case 'school': return h + 30
    case 'hall': return 72
    case 'plaza': return 20
    case 'tree': return 38
    case 'flowers': return 10
  }
  return 30
}
function rr(g: Ctx, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath()
  g.moveTo(x + r, y)
  g.arcTo(x + w, y, x + w, y + h, r)
  g.arcTo(x + w, y + h, x, y + h, r)
  g.arcTo(x, y + h, x, y, r)
  g.arcTo(x, y, x + w, y, r)
  g.closePath()
}
function drawConstruction(sx: number, sy: number, p: number) {
  const c = Cn(sx, sy, 0.75)
  P([c.t, c.r, c.b, c.l], '#b88d55', false)
  box(sx, sy, 0.5, 0, 6 + p * 18, '#d9b77a')
  G.strokeStyle = '#8a6a3a'
  G.lineWidth = 1.5
  const c2 = Cn(sx, sy, 0.6)
  const hh = 30
  ;[c2.l, c2.b, c2.r].forEach((q) => {
    G.beginPath()
    G.moveTo(q[0], q[1])
    G.lineTo(q[0], q[1] - hh)
    G.stroke()
  })
  for (const f of [1, 0.5]) {
    G.beginPath()
    G.moveTo(c2.l[0], c2.l[1] - hh * f)
    G.lineTo(c2.b[0], c2.b[1] - hh * f)
    G.lineTo(c2.r[0], c2.r[1] - hh * f)
    G.stroke()
  }
  const w = 52
  G.fillStyle = '#1b240c'
  rr(G, sx - w / 2, sy - 56, w, 10, 5)
  G.fill()
  G.fillStyle = '#ffcf4a'
  rr(G, sx - w / 2 + 2, sy - 54, Math.max(6, (w - 4) * p), 6, 3)
  G.fill()
  G.font = '16px system-ui'
  G.textAlign = 'center'
  G.textBaseline = 'middle'
  G.fillText('🚧', sx, sy - 68)
}
function pin(sx: number, y: number, kind: 'coin' | 'help') {
  y += Math.sin(T / 300 + sx * 0.05) * 3
  G.fillStyle = '#fff'
  G.beginPath()
  G.moveTo(sx - 6, y + 9)
  G.lineTo(sx, y + 19)
  G.lineTo(sx + 6, y + 9)
  G.fill()
  circle(sx, y, 14, '#fff')
  const g = G.createRadialGradient(sx - 4, y - 4, 2, sx, y, 12)
  if (kind === 'coin') {
    g.addColorStop(0, '#fff3a0')
    g.addColorStop(0.6, '#f4c21b')
    g.addColorStop(1, '#c98a00')
  } else {
    g.addColorStop(0, '#bfe6ff')
    g.addColorStop(0.6, '#2c8fe0')
    g.addColorStop(1, '#145a9c')
  }
  circle(sx, y, 11, g)
  G.fillStyle = kind === 'coin' ? '#7a4f00' : '#fff'
  G.font = '800 15px "Baloo 2",sans-serif'
  G.textAlign = 'center'
  G.textBaseline = 'middle'
  G.fillText(kind === 'coin' ? '$' : '★', sx, y + 1)
}

// ---------- chão ----------

function drawGround(map: Tile[], x: number, y: number, sx: number, sy: number) {
  const t = map[y * N + x]
  const c = Cn(sx, sy, 1)
  if (t.r) {
    P([c.t, c.r, c.b, c.l], '#70737b', false)
    DIRS.forEach(([dx, dy, a, b]) => {
      if (!isRoad(map, x + dx, y + dy)) P([c[a], c[b], L(c[b], [sx, sy], 0.18), L(c[a], [sx, sy], 0.18)], '#d6ccb2', false)
    })
    G.strokeStyle = 'rgba(255,255,255,.85)'
    G.lineWidth = 2
    G.setLineDash([5, 6])
    DIRS.forEach(([dx, dy, a, b]) => {
      if (isRoad(map, x + dx, y + dy)) {
        const m = L(c[a], c[b], 0.5)
        G.beginPath()
        G.moveTo(sx, sy)
        G.lineTo(m[0], m[1])
        G.stroke()
      }
    })
    G.setLineDash([])
  } else {
    const v = (x * 7 + y * 13) % 3
    P([c.t, c.r, c.b, c.l], ['#6cc644', '#66bf3f', '#72cc4a'][v], false)
    if ((x * 31 + y * 17) % 5 === 0) {
      G.strokeStyle = '#4fa83a'
      G.lineWidth = 1.2
      G.beginPath()
      G.moveTo(sx - 8, sy + 3)
      G.lineTo(sx - 6, sy - 2)
      G.moveTo(sx - 5, sy + 3)
      G.lineTo(sx - 4, sy - 3)
      G.stroke()
    }
  }
  G.strokeStyle = 'rgba(0,0,0,.05)'
  G.lineWidth = 1
  G.beginPath()
  G.moveTo(c.t[0], c.t[1])
  G.lineTo(c.r[0], c.r[1])
  G.lineTo(c.b[0], c.b[1])
  G.lineTo(c.l[0], c.l[1])
  G.closePath()
  G.stroke()
  if (x === N - 1) P([c.r, c.b, U(c.b, -14), U(c.r, -14)], '#8a5a2b', false)
  if (y === N - 1) P([c.l, c.b, U(c.b, -14), U(c.l, -14)], '#a86f38', false)
}

// ---------- carrinhos ----------

interface Car { x: number; y: number; tx: number; ty: number; px: number; py: number; col: string; sp: number }
let cars: Car[] = []
export function spawnCars(map: Tile[], n: number) {
  cars = []
  const roads: Pt[] = []
  map.forEach((t, i) => { if (t.r) roads.push([i % N, (i / N) | 0]) })
  if (!roads.length) return
  for (let k = 0; k < n; k++) {
    const r = pick(roads)
    cars.push({ x: r[0], y: r[1], tx: r[0], ty: r[1], px: r[0], py: r[1], col: pick(cfg.carros.cores), sp: rand(0.9, 1.6) })
  }
}
export function updCars(dt: number) {
  const map = curMap()
  cars.forEach((c) => {
    const dx = c.tx - c.x
    const dy = c.ty - c.y
    const d = Math.hypot(dx, dy)
    if (d < 0.02) {
      c.x = c.tx
      c.y = c.ty
      const opts = DIRS.map(([a, b]): Pt => [c.x + a, c.y + b]).filter(([a, b]) => isRoad(map, a, b))
      let ch = opts.filter(([a, b]) => !(a === c.px && b === c.py))
      if (!ch.length) ch = opts
      if (!ch.length) return
      const n = pick(ch)
      c.px = c.x
      c.py = c.y
      c.tx = n[0]
      c.ty = n[1]
    } else {
      const st = Math.min(d, c.sp * dt)
      c.x += (dx / d) * st
      c.y += (dy / d) * st
    }
  })
}
function drawCars() {
  cars.forEach((c) => {
    const dx = c.tx - c.px
    const dy = c.ty - c.py
    const [sx, sy] = iso(c.x - dy * 0.18, c.y + dx * 0.18)
    box(sx, sy + 2, 0.2, 0, 7, c.col)
    box(sx, sy + 2, 0.12, 7, 11, '#cfeaff')
  })
}

// ---------- textos flutuantes ----------

interface Float { sx: number; sy: number; text: string; col: string; t0: number }
let floats: Float[] = []
export function addFloat(x: number, y: number, text: string, col: string, up = 60) {
  const [sx, sy] = iso(x, y)
  floats.push({ sx, sy: sy - up, text, col, t0: performance.now() })
}
function drawFloats() {
  const now = performance.now()
  floats = floats.filter((f) => now - f.t0 < 1300)
  floats.forEach((f) => {
    const k = (now - f.t0) / 1300
    G.globalAlpha = 1 - k * k
    G.font = '800 20px "Baloo 2",sans-serif'
    G.textAlign = 'center'
    G.textBaseline = 'middle'
    G.lineWidth = 4
    G.strokeStyle = 'rgba(0,0,0,.7)'
    G.strokeText(f.text, f.sx, f.sy - k * 40)
    G.fillStyle = f.col
    G.fillText(f.text, f.sx, f.sy - k * 40)
    G.globalAlpha = 1
  })
}

// ---------- câmera e quadro ----------

export const cam = { x: 0, y: 0, z: 1 }
export function centerCam(W: number, H: number) {
  const [, cy] = iso((N - 1) / 2, (N - 1) / 2)
  cam.z = Math.max(0.45, Math.min(1.1, (W / (N * TW)) * 2.2))
  cam.x = W / 2
  cam.y = H / 2 - cy * cam.z + 10
}
const clouds = Array.from({ length: 4 }, (_, i) => ({ x: Math.random() * 1200, y: 60 + i * 140 + Math.random() * 60, s: 0.6 + Math.random() * 0.7, v: 6 + Math.random() * 8 }))

function drawBuilding(b: B, sx: number, sy: number, now: number) {
  const d = DEFS[b.k]
  if (!game.visiting && now < b.builtAt) {
    const p = 1 - (b.builtAt - now) / ((d.build || 4) * 1000 * cfg.time_multiplier)
    drawConstruction(sx, sy, Math.max(0, Math.min(1, p)))
    return
  }
  drawKind(b.k, sx, sy)
  if (game.visiting) {
    if (b.help) pin(sx, sy - topOf(d) - 18, 'help')
  } else if (d.renda && now - b.start >= tempoMs(b.k)) pin(sx, sy - topOf(d) - 18, 'coin')
}

function drawLabels(ctx: Ctx, W: number, H: number, map: Tile[], now: number) {
  if (!game.S.placas || cam.z < 0.38) return
  const cid = cidadeAtual()
  ctx.font = '700 11px "Baloo 2",sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const used: [number, number, number][] = []
  for (let s = 2 * N - 2; s >= 0; s--)
    for (let x = Math.min(N - 1, s); x >= Math.max(0, s - N + 1); x--) {
      const y = s - x
      const t = map[y * N + x]
      if (!t.b) continue
      const nm = nomeDe(t.b, cid)
      if (!nm) continue
      if (!game.visiting && now < t.b.builtAt) continue
      const [wx, wy] = iso(x, y)
      const px = cam.x + wx * cam.z
      const py = cam.y + (wy + TH * 0.36) * cam.z
      if (px < -100 || px > W + 100 || py < -20 || py > H + 20) continue
      const w = Math.min(150, ctx.measureText(nm).width + 14)
      if (used.some((u) => Math.abs(u[0] - px) < (u[1] + w) / 2 + 2 && Math.abs(u[2] - py) < 19)) continue
      used.push([px, w, py])
      ctx.fillStyle = 'rgba(122,90,34,.95)'
      rr(ctx, px - w / 2, py - 8, w, 17, 8)
      ctx.fill()
      ctx.fillStyle = '#fff8e6'
      rr(ctx, px - w / 2 + 1.5, py - 6.5, w - 3, 14, 6.5)
      ctx.fill()
      ctx.fillStyle = '#4a3410'
      ctx.save()
      ctx.beginPath()
      ctx.rect(px - w / 2 + 4, py - 9, w - 8, 18)
      ctx.clip()
      ctx.fillText(nm, px, py + 0.5)
      ctx.restore()
    }
}

export function render(ctx: Ctx, W: number, H: number, DPR: number, t: number) {
  G = ctx
  T = t
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0)
  const bg = ctx.createLinearGradient(0, 0, 0, H)
  bg.addColorStop(0, '#5aa63c')
  bg.addColorStop(1, '#2f6a20')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)
  ctx.save()
  ctx.translate(cam.x, cam.y)
  ctx.scale(cam.z, cam.z)
  const map = curMap()
  const now = Date.now()
  for (let s = 0; s <= 2 * N - 2; s++)
    for (let x = Math.max(0, s - N + 1); x <= Math.min(N - 1, s); x++) {
      const y = s - x
      const [sx, sy] = iso(x, y)
      drawGround(map, x, y, sx, sy)
    }
  const mode = game.mode
  const hv = game.hover
  if (mode.type !== 'none' && hv) {
    const [hx, hy] = hv
    const [sx, sy] = iso(hx, hy)
    const ok = mode.type === 'road' ? !map[hy * N + hx].b : canPlace(hx, hy)
    const c = Cn(sx, sy, 1)
    P([c.t, c.r, c.b, c.l], ok ? 'rgba(120,255,120,.45)' : 'rgba(255,80,80,.45)', false)
  }
  drawCars()
  for (let s = 0; s <= 2 * N - 2; s++)
    for (let x = Math.max(0, s - N + 1); x <= Math.min(N - 1, s); x++) {
      const y = s - x
      const tl = map[y * N + x]
      const [sx, sy] = iso(x, y)
      if (tl.b) drawBuilding(tl.b, sx, sy, now)
      else if (tl.tree) drawTree(sx, sy, 0.85 + ((x * 7 + y * 3) % 4) * 0.09, (x + y) % 3)
      if (mode.type === 'place' && hv && hv[0] === x && hv[1] === y && canPlace(x, y)) {
        G.globalAlpha = 0.65
        drawKind(mode.k, sx, sy)
        G.globalAlpha = 1
      }
    }
  drawFloats()
  ctx.restore()
  drawLabels(ctx, W, H, map, now)
  clouds.forEach((c) => {
    c.x += c.v / 60
    if (c.x > W + 200) c.x = -200
    ctx.globalAlpha = 0.16
    ctx.fillStyle = '#fff'
    for (const [dx, dy, r] of [[0, 0, 40], [35, -10, 32], [70, 0, 36], [30, 12, 30]]) {
      ctx.beginPath()
      ctx.arc(c.x + dx * c.s, c.y + dy * c.s, r * c.s, 0, 7)
      ctx.fill()
    }
    ctx.globalAlpha = 1
  })
}

// ---------- toque ----------

const toWorld = (px: number, py: number): Pt => [(px - cam.x) / cam.z, (py - cam.y) / cam.z]
export function pickTile(px: number, py: number): Pt | null {
  const [wx, wy] = toWorld(px, py)
  const a = wx / (TW / 2)
  const b = wy / (TH / 2)
  const x = Math.round((a + b) / 2)
  const y = Math.round((b - a) / 2)
  return x >= 0 && y >= 0 && x < N && y < N ? [x, y] : null
}
/** Prioriza o objeto desenhado embaixo do dedo (prédio alto, árvore) antes do chão. */
export function pickObj(px: number, py: number): Pt | null {
  const [wx, wy] = toWorld(px, py)
  const map = curMap()
  for (let s = 2 * N - 2; s >= 0; s--)
    for (let x = Math.min(N - 1, s); x >= Math.max(0, s - N + 1); x--) {
      const y = s - x
      const t = map[y * N + x]
      if (!t.b && !t.tree) continue
      const [sx, sy] = iso(x, y)
      const d = t.b ? DEFS[t.b.k] : { draw: 'tree' }
      const top = topOf(d) + 30
      if (wx > sx - TW * 0.32 && wx < sx + TW * 0.32 && wy > sy - top && wy < sy + TH * 0.3) return [x, y]
    }
  return null
}

// ---------- miniaturas e avatares ----------

export function preview(canvas: HTMLCanvasElement, k: string) {
  canvas.width = 240
  canvas.height = 200
  const p = canvas.getContext('2d')!
  const prev = G
  G = p
  p.setTransform(2, 0, 0, 2, 0, 0)
  const d = DEFS[k]
  const top = topOf(d)
  const sc = Math.min(1, 80 / (top + 30))
  p.translate(60, 72 + top * sc * 0.42)
  p.scale(sc, sc)
  const cc = Cn(0, 0, 1)
  P([cc.t, cc.r, cc.b, cc.l], '#6cc644', false)
  drawKind(k, 0, 0)
  G = prev
}

export function avatarSVG(b: Bot) {
  const hairBack = b.long ? `<path d="M10 27 Q10 7 24 7 Q38 7 38 27 L39 40 L9 40Z" fill="${b.hair}"/>` : ''
  return `<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg"><rect width="48" height="48" fill="${b.cor}"/><circle cx="40" cy="8" r="10" fill="rgba(255,255,255,.18)"/>${hairBack}<ellipse cx="24" cy="50" rx="17" ry="13" fill="${shade(b.cor, 0.65)}"/><rect x="20" y="31" width="8" height="8" fill="${b.skin}"/><circle cx="24" cy="23" r="11" fill="${b.skin}"/><path d="M12.5 22 Q13 9.5 24 9.5 Q35 9.5 35.5 22 Q31 14.5 24 15 Q17 14.5 12.5 22Z" fill="${b.hair}"/><circle cx="19.8" cy="24" r="1.6" fill="#222"/><circle cx="28.2" cy="24" r="1.6" fill="#222"/><circle cx="17" cy="28" r="2" fill="rgba(255,120,120,.35)"/><circle cx="31" cy="28" r="2" fill="rgba(255,120,120,.35)"/><path d="M20 28.5 Q24 32 28 28.5" stroke="#5a2a1a" stroke-width="1.6" fill="none" stroke-linecap="round"/></svg>`
}
