import { useCallback, useEffect, useRef, useState } from 'react'
import { CATEGORIES, cfg, defList, defs, NAME_MAX } from './game/data'
import * as G from './game/state'
import { drawPreview, drawWorld, iso, mapBounds, toTile, topOf, type Cam } from './game/render'
import type { ActionResult, BuildingDef, Float } from './game/types'
import { Bolt, Cash, Coin, People, Star } from './icons'

type Dialog =
  | { kind: 'name'; uid: number; value: string; isNew: boolean }
  | { kind: 'city'; value: string }
  | { kind: 'reset' }
  | null

const fmtTime = (sec: number) => {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return m > 0 ? `${m}:${String(s).padStart(2, '0')}` : `${s}s`
}

export default function App() {
  const gs = useRef(G.load())
  const cam = useRef<Cam>({ x: 0, y: 0, zoom: 0.7 })
  const floats = useRef<Float[]>([])
  const hover = useRef<{ x: number; y: number } | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const [, setTick] = useState(0)
  const rerender = useCallback(() => setTick((v) => v + 1), [])
  const [placing, setPlacing] = useState<string | null>(null)
  const [roadMode, setRoadMode] = useState(false)
  const [shopOpen, setShopOpen] = useState(false)
  const [popup, setPopup] = useState<number | null>(null)
  const [dialog, setDialog] = useState<Dialog>(null)
  const [toast, setToast] = useState<{ text: string; id: number } | null>(null)
  const mode = useRef({ placing, roadMode })
  mode.current = { placing, roadMode }

  const commit = useCallback(() => {
    G.save(gs.current)
    rerender()
  }, [rerender])

  const say = useCallback((text: string) => {
    const id = Date.now()
    setToast({ text, id })
    setTimeout(() => setToast((t) => (t?.id === id ? null : t)), 2600)
  }, [])

  // relógio da interface + save automático
  useEffect(() => {
    const tick = setInterval(() => {
      G.syncEnergy(gs.current)
      rerender()
    }, 1000)
    const autosave = setInterval(() => G.save(gs.current), cfg.autosave_seconds * 1000)
    const onHide = () => G.save(gs.current)
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('pagehide', onHide)
    return () => {
      clearInterval(tick)
      clearInterval(autosave)
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('pagehide', onHide)
    }
  }, [rerender])

  const handleResult = useCallback(
    (r: ActionResult, tx: number, ty: number, lift = 30) => {
      if (r.msg) say(r.msg)
      if (r.floats) {
        const c = iso(tx, ty)
        r.floats.forEach((f, i) =>
          floats.current.push({ wx: c.x, wy: c.y - lift - i * 20, text: f.text, color: f.color, t0: performance.now() + i * 120 }),
        )
        floats.current = floats.current.filter((f) => performance.now() - f.t0 < 1500)
      }
      if (r.levelUp) {
        const news = G.unlockedAt(r.levelUp).map((d) => d.name)
        say(`Subiu pro nível ${r.levelUp}! +${cfg.grana_per_level} Grana${news.length ? ` · Liberou: ${news.join(', ')}` : ''}`)
      }
    },
    [say],
  )

  // toque no mapa
  const onTap = useCallback(
    (tx: number, ty: number) => {
      const s = gs.current
      const t = G.now()
      G.syncEnergy(s, t)
      if (!G.inBounds(tx, ty)) return
      const { placing: pl, roadMode: rm } = mode.current

      if (rm) {
        const r = G.toggleRoad(s, tx, ty, t)
        handleResult(r, tx, ty, 6)
        if (r.ok) commit()
        return
      }
      if (pl) {
        const d = defs[pl]
        const r = G.place(s, d, tx, ty, t)
        if (!r.ok) {
          say(r.msg ?? 'Não dá pra construir aqui')
          return
        }
        handleResult(r, tx, ty)
        setPlacing(null)
        hover.current = null
        const b = r.uid ? G.byUid(s, r.uid) : undefined
        if (b && d.named === 'required') setDialog({ kind: 'name', uid: b.uid, value: b.name, isNew: true })
        commit()
        return
      }
      const tile = s.tiles[ty][tx]
      if (tile.b) {
        const b = G.byUid(s, tile.b)
        if (!b) return
        if (G.isReady(b, t)) {
          const r = G.collect(s, b, t)
          handleResult(r, tx, ty, topOf(defs[b.def]))
          if (r.ok) commit()
          return
        }
        setPopup(b.uid)
        return
      }
      if (tile.tree) {
        const r = G.cutTree(s, tx, ty, t)
        handleResult(r, tx, ty, 34)
        if (r.ok) commit()
      }
    },
    [commit, handleResult, say],
  )
  const tapRef = useRef(onTap)
  tapRef.current = onTap

  // canvas: desenho, câmera e gestos
  useEffect(() => {
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    let W = 0
    let H = 0
    let first = true
    const bounds = mapBounds()

    const keepInside = () => {
      const c = cam.current
      c.x = Math.min(bounds.right, Math.max(bounds.left, c.x))
      c.y = Math.min(bounds.bottom, Math.max(bounds.top, c.y))
    }
    const resize = () => {
      const dpr = window.devicePixelRatio || 1
      W = canvas.clientWidth
      H = canvas.clientHeight
      canvas.width = Math.round(W * dpr)
      canvas.height = Math.round(H * dpr)
      if (first) {
        first = false
        const p = iso(7.5, 7.5)
        cam.current = { x: p.x, y: p.y - 20, zoom: Math.min(0.9, Math.max(0.45, W / (cfg.tile_w * 8))) }
      }
    }
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)
    resize()

    let raf = 0
    const frame = () => {
      const dpr = window.devicePixelRatio || 1
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const { placing: pl, roadMode: rm } = mode.current
      const hv = hover.current
      let ghost = null
      if (hv && (pl || rm)) {
        const ok = pl ? !G.placeProblem(gs.current, defs[pl], hv.x, hv.y) : G.inBounds(hv.x, hv.y) && !G.isBorder(hv.x, hv.y)
        ghost = { def: pl ?? 'road', x: hv.x, y: hv.y, ok }
      }
      // os floats usam o relógio do performance; o resto usa Date.now()
      const pnow = performance.now()
      const fl = floats.current.map((f) => ({ ...f, t0: Date.now() - (pnow - f.t0) }))
      drawWorld(ctx, W, H, cam.current, gs.current, { ghost, roadMode: rm, floats: fl }, Date.now())
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)

    const toWorld = (sx: number, sy: number) => {
      const c = cam.current
      return { x: c.x + (sx - W / 2) / c.zoom, y: c.y + (sy - H / 2) / c.zoom }
    }
    const tileAt = (sx: number, sy: number) => {
      const w = toWorld(sx, sy)
      return toTile(w.x, w.y)
    }
    const zoomAt = (f: number, sx: number, sy: number) => {
      const c = cam.current
      const before = toWorld(sx, sy)
      c.zoom = Math.min(cfg.camera.zoom_max, Math.max(cfg.camera.zoom_min, c.zoom * f))
      c.x = before.x - (sx - W / 2) / c.zoom
      c.y = before.y - (sy - H / 2) / c.zoom
      keepInside()
    }
    const pan = (dx: number, dy: number) => {
      cam.current.x -= dx / cam.current.zoom
      cam.current.y -= dy / cam.current.zoom
      keepInside()
    }

    const pts = new Map<number, { x: number; y: number }>()
    let start = { x: 0, y: 0 }
    let moved = false
    let pinch = 0
    const local = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect()
      return { x: e.clientX - r.left, y: e.clientY - r.top }
    }
    const dist = () => {
      const [a, b] = [...pts.values()]
      return Math.hypot(a.x - b.x, a.y - b.y)
    }
    const mid = () => {
      const [a, b] = [...pts.values()]
      return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
    }

    const down = (e: PointerEvent) => {
      canvas.setPointerCapture(e.pointerId)
      const p = local(e)
      pts.set(e.pointerId, p)
      if (pts.size === 1) {
        start = p
        moved = false
        if (e.pointerType !== 'mouse') hover.current = tileAt(p.x, p.y)
      } else if (pts.size === 2) {
        moved = true
        pinch = dist()
      }
    }
    const move = (e: PointerEvent) => {
      const p = local(e)
      if (!pts.has(e.pointerId)) {
        if (e.pointerType === 'mouse') hover.current = tileAt(p.x, p.y)
        return
      }
      const prev = pts.get(e.pointerId)!
      if (pts.size === 1) {
        if (!moved && Math.hypot(p.x - start.x, p.y - start.y) > 8) moved = true
        if (moved) pan(p.x - prev.x, p.y - prev.y)
        pts.set(e.pointerId, p)
      } else if (pts.size === 2) {
        const m0 = mid()
        pts.set(e.pointerId, p)
        const m1 = mid()
        const d = dist()
        if (pinch > 0 && d > 0) zoomAt(d / pinch, m1.x, m1.y)
        pan(m1.x - m0.x, m1.y - m0.y)
        pinch = d
      }
    }
    const up = (e: PointerEvent) => {
      if (!pts.has(e.pointerId)) return
      const p = local(e)
      if (pts.size === 1 && !moved) {
        const tl = tileAt(p.x, p.y)
        if (e.pointerType === 'mouse') hover.current = tl
        tapRef.current(tl.x, tl.y)
      }
      pts.delete(e.pointerId)
      if (pts.size < 2) pinch = 0
      if (pts.size === 1) {
        start = [...pts.values()][0]
      }
    }
    const wheel = (e: WheelEvent) => {
      e.preventDefault()
      const r = canvas.getBoundingClientRect()
      const f = e.ctrlKey ? Math.exp(-e.deltaY / 100) : e.deltaY < 0 ? 1.1 : 1 / 1.1
      zoomAt(f, e.clientX - r.left, e.clientY - r.top)
    }
    const leave = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' && !pts.size) hover.current = null
    }

    canvas.addEventListener('pointerdown', down)
    canvas.addEventListener('pointermove', move)
    canvas.addEventListener('pointerup', up)
    canvas.addEventListener('pointercancel', up)
    canvas.addEventListener('pointerleave', leave)
    canvas.addEventListener('wheel', wheel, { passive: false })
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      canvas.removeEventListener('pointerdown', down)
      canvas.removeEventListener('pointermove', move)
      canvas.removeEventListener('pointerup', up)
      canvas.removeEventListener('pointercancel', up)
      canvas.removeEventListener('pointerleave', leave)
      canvas.removeEventListener('wheel', wheel)
    }
  }, [])

  // ---------- interface ----------

  const s = gs.current
  const t = Date.now()
  const pop = G.population(s)
  const eMax = G.energyMax(s.level)
  const eNext = G.nextEnergyIn(s, t)
  const need = G.xpNeed(s.level)
  const popupB = popup ? G.byUid(s, popup) : undefined

  const startPlacing = (d: BuildingDef) => {
    setShopOpen(false)
    setRoadMode(false)
    setPlacing(d.id)
    say('Toque num espaço livre')
  }

  return (
    <div className="app">
      <canvas ref={canvasRef} className="world" />

      <header className="hud">
        <button className="pill city" onClick={() => setDialog({ kind: 'city', value: s.cityName })}>
          {s.cityName}
        </button>
        <div className="pill level" title={`${s.xp} de ${need} XP`}>
          <Star />
          <b>{s.level}</b>
          <span className="xpbar">
            <i style={{ width: `${(s.xp / need) * 100}%` }} />
          </span>
        </div>
        <div className="pill"><Coin /><b>{s.gold.toLocaleString('pt-BR')}</b></div>
        <div className="pill"><Cash /><b>{s.grana}</b></div>
        <div className="pill">
          <Bolt />
          <b>{s.energy}/{eMax}</b>
          {eNext > 0 && <small>{fmtTime(eNext)}</small>}
        </div>
        <div className="pill"><People /><b>{pop.pop}/{pop.max}</b></div>
      </header>

      {(placing || roadMode) && (
        <div className="banner">
          {placing ? defs[placing].name : `Ruas · ${cfg.road_cost} ouro`}
          <button onClick={() => { setPlacing(null); setRoadMode(false); hover.current = null }}>
            {roadMode ? 'Pronto' : 'Cancelar'}
          </button>
        </div>
      )}

      <nav className="dock">
        <button className="big orange" onClick={() => { setShopOpen(true); setRoadMode(false); setPlacing(null) }}>Loja</button>
        <button className={`big green ${roadMode ? 'on' : ''}`} onClick={() => { setPlacing(null); setRoadMode(!roadMode); hover.current = null }}>Ruas</button>
        <button className="small" onClick={() => setDialog({ kind: 'reset' })} aria-label="Opções">⋯</button>
      </nav>

      {toast && <div className="toast" key={toast.id}>{toast.text}</div>}

      {shopOpen && (
        <Shop
          level={s.level}
          canAfford={(d) => G.canAfford(s, d)}
          onPick={startPlacing}
          onClose={() => setShopOpen(false)}
        />
      )}

      {popupB && (
        <div className="sheet-wrap" onClick={() => setPopup(null)}>
          <div className="sheet small-sheet" onClick={(e) => e.stopPropagation()}>
            <BuildingInfo
              b={popupB}
              cityName={s.cityName}
              onRename={() => {
                if (popupB.def === 'prefeitura') setDialog({ kind: 'city', value: s.cityName })
                else setDialog({ kind: 'name', uid: popupB.uid, value: popupB.name || G.suggestName(defs[popupB.def]), isNew: false })
                setPopup(null)
              }}
              onClose={() => setPopup(null)}
            />
          </div>
        </div>
      )}

      {dialog && dialog.kind !== 'reset' && (
        <NameDialog
          title={dialog.kind === 'city' ? 'Nome da cidade' : dialog.isNew ? `Dê um nome: ${defs[G.byUid(s, dialog.uid)?.def ?? 'casa'].name}` : 'Renomear'}
          value={dialog.value}
          onSuggest={() =>
            dialog.kind === 'city' ? G.suggestCityName() : G.suggestName(defs[G.byUid(s, dialog.uid)?.def ?? 'casa'])
          }
          onSave={(v) => {
            const clean = G.cleanName(v)
            if (dialog.kind === 'city') {
              if (clean) s.cityName = clean
            } else {
              const b = G.byUid(s, dialog.uid)
              const d = b ? defs[b.def] : undefined
              if (b && d && (clean || d.named !== 'required')) G.rename(b, clean)
            }
            setDialog(null)
            commit()
          }}
          onCancel={() => setDialog(null)}
        />
      )}

      {dialog?.kind === 'reset' && (
        <div className="sheet-wrap" onClick={() => setDialog(null)}>
          <div className="sheet small-sheet" onClick={(e) => e.stopPropagation()}>
            <h2>Opções</h2>
            <p>Começar uma cidade nova apaga a atual neste aparelho. Não dá pra desfazer.</p>
            <div className="row">
              <button className="btn" onClick={() => setDialog(null)}>Voltar</button>
              <button
                className="btn danger"
                onClick={() => {
                  gs.current = G.resetGame()
                  setDialog(null)
                  commit()
                  say('Cidade nova criada!')
                }}
              >
                Começar de novo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ---------- componentes ----------

function Preview({ d }: { d: BuildingDef }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    if (ref.current) drawPreview(ref.current, d)
  }, [d])
  return <canvas ref={ref} className="preview" />
}

function Shop(props: { level: number; canAfford: (d: BuildingDef) => boolean; onPick: (d: BuildingDef) => void; onClose: () => void }) {
  const [tab, setTab] = useState<BuildingDef['category']>('casas')
  const items = defList.filter((d) => d.category === tab)
  return (
    <div className="sheet-wrap" onClick={props.onClose}>
      <div className="sheet shop" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h2>Loja</h2>
          <button className="x" onClick={props.onClose} aria-label="Fechar">×</button>
        </div>
        <div className="tabs">
          {CATEGORIES.map((c) => (
            <button key={c.id} className={tab === c.id ? 'on' : ''} onClick={() => setTab(c.id)}>{c.label}</button>
          ))}
        </div>
        <div className="grid">
          {items.map((d) => {
            const locked = (d.level ?? 1) > props.level
            const afford = props.canAfford(d)
            return (
              <button key={d.id} className={`card ${locked ? 'locked' : ''}`} disabled={locked} onClick={() => props.onPick(d)}>
                <Preview d={d} />
                <strong>{d.name}</strong>
                <span className="info">
                  {d.income ? `Rende ${d.income} a cada ${G.cycleMs(d) / 1000}s` : d.popMax ? `+${d.popMax} pop. máxima` : 'Enfeita a cidade'}
                </span>
                {d.pop ? <span className="info">+{d.pop} moradores</span> : null}
                {locked ? (
                  <span className="price lock">Nível {d.level}</span>
                ) : (
                  <span className={`price ${afford ? '' : 'short'}`}>
                    {d.price?.grana ? <Cash /> : <Coin />}
                    {d.price?.grana ?? d.price?.gold}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function BuildingInfo(props: { b: import('./game/types').Building; cityName: string; onRename: () => void; onClose: () => void }) {
  const { b } = props
  const d = defs[b.def]
  const t = Date.now()
  const building = G.isBuilding(b, t)
  const title = d.id === 'prefeitura' ? `Prefeitura de ${props.cityName}` : b.name || d.name
  let status = ''
  let progress = 0
  if (building) {
    status = `Em obra: fica pronto em ${fmtTime(Math.ceil((b.readyAt - t) / 1000))}`
    progress = G.buildProgress(b, t)
  } else if (d.income) {
    const left = Math.ceil((G.cycleMs(d) - (t - b.lastCollect)) / 1000)
    status = left > 0 ? `Próxima moeda em ${fmtTime(left)} · rende ${d.income}` : `Pronto pra coletar ${d.income}!`
    progress = G.cycleProgress(b, t)
  } else if (d.popMax) {
    status = `Aumenta a população máxima em ${d.popMax}`
  } else {
    status = 'Deixa a cidade mais bonita'
  }
  return (
    <>
      <div className="sheet-head">
        <div>
          <h2>{title}</h2>
          {b.name && d.id !== 'prefeitura' && <small className="sub">{d.name}</small>}
        </div>
        <button className="x" onClick={props.onClose} aria-label="Fechar">×</button>
      </div>
      <p>{status}</p>
      {(building || d.income) ? <div className="progress"><i style={{ width: `${progress * 100}%` }} /></div> : null}
      {d.pop ? <p className="muted">{d.pop} moradores</p> : null}
      <div className="row">
        {(d.named !== 'none' || d.id === 'prefeitura') && (
          <button className="btn" onClick={props.onRename}>{d.id === 'prefeitura' ? 'Renomear cidade' : 'Renomear'}</button>
        )}
        <button className="btn primary" onClick={props.onClose}>OK</button>
      </div>
    </>
  )
}

function NameDialog(props: { title: string; value: string; onSuggest: () => string; onSave: (v: string) => void; onCancel: () => void }) {
  const [v, setV] = useState(props.value)
  return (
    <div className="sheet-wrap">
      <form
        className="sheet small-sheet"
        onSubmit={(e) => {
          e.preventDefault()
          props.onSave(v)
        }}
      >
        <h2>{props.title}</h2>
        <div className="name-row">
          <input value={v} maxLength={NAME_MAX} onChange={(e) => setV(e.target.value)} autoFocus aria-label="Nome" />
          <button type="button" className="btn" onClick={() => setV(props.onSuggest())}>Sortear</button>
        </div>
        <small className="muted">{v.length}/{NAME_MAX} letras</small>
        <div className="row">
          <button type="button" className="btn" onClick={props.onCancel}>Cancelar</button>
          <button type="submit" className="btn primary">Salvar</button>
        </div>
      </form>
    </div>
  )
}
