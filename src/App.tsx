import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { ASSESSOR, BOTS, botById, CATS, cfg, DEFS, DIARIAS, MISSOES, MSG, NAME_MAX, PERFIS, type Bot } from './game/data'
import * as S from './game/state'
import { game, type AskName, type B, type Ev, type Visit } from './game/state'
import { addFloat, avatarSVG, cam, centerCam, pickObj, pickTile, preview, render, spawnCars, updCars } from './game/render'
import { ago, fill, fmt } from './game/util'

const MP = MSG.postal

type Info =
  | { kind: 'building'; b: B }
  | { kind: 'name'; o: AskName }
  | { kind: 'quest'; id: string }
  | { kind: 'pedido' }
  | { kind: 'link'; url: string }
  | { kind: 'obrigado'; v: Visit }
  | { kind: 'options' }
  | { kind: 'reset' }
  | { kind: 'welcome'; evs: Ev[]; first: boolean }
interface Toast { id: number; text: string; big?: boolean; bot?: Bot }

S.load()

const Avatar = ({ b, lv, size }: { b: Bot; lv?: number; size?: number }) => (
  <div className="av" style={size ? { width: size, height: size, margin: 0 } : undefined}>
    <span dangerouslySetInnerHTML={{ __html: avatarSVG(b) }} />
    {lv !== undefined && <span className="lv">{lv}</span>}
  </div>
)

function Modal({ title, onClose, children }: { title: ReactNode; onClose: () => void; children: ReactNode }) {
  return (
    <div className="modal open" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="panel">
        <h2>
          <span>{title}</span>
          <button className="x" onClick={onClose} aria-label="Fechar">✕</button>
        </h2>
        {children}
      </div>
    </div>
  )
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [, setTick] = useState(0)
  const refresh = useCallback(() => setTick((v) => v + 1), [])
  const [toasts, setToasts] = useState<Toast[]>([])
  const [shop, setShop] = useState(false)
  const [shopCat, setShopCat] = useState('casas')
  const [feed, setFeed] = useState(false)
  const [nb, setNb] = useState<string | null>(null)
  const [info, setInfo] = useState<Info | null>(null)
  const size = useRef({ W: 0, H: 0 })

  const toast = useCallback((text: string, o: { big?: boolean; bot?: Bot } = {}) => {
    const id = Date.now() + Math.random()
    setToasts((l) => [...l, { id, text, ...o }].slice(-3))
    setTimeout(() => setToasts((l) => l.filter((t) => t.id !== id)), o.big ? 2600 : 2800)
  }, [])

  // liga as ações do jogo à interface
  useEffect(() => {
    S.fx.toast = toast
    S.fx.float = addFloat
    S.fx.openBuilding = (b) => setInfo({ kind: 'building', b })
    S.fx.askName = (o) => setInfo({ kind: 'name', o })
    S.fx.postalAjudado = (v) => setInfo({ kind: 'obrigado', v })
    S.fx.visitChanged = () => {
      const { W, H } = size.current
      spawnCars(S.curMap(), game.visiting ? cfg.carros.na_visita : cfg.carros.na_cidade)
      centerCam(W, H)
      refresh()
    }
    // avisa uma vez quando o jogo abriu numa versão nova
    try {
      const k = 'cidade-feliz-versao'
      const antes = localStorage.getItem(k)
      if (antes && antes !== __VERSAO__) setTimeout(() => toast(fill(MSG.atualizado, { v: __VERSAO__ }), { bot: ASSESSOR }), 1500)
      localStorage.setItem(k, __VERSAO__)
    } catch { /* sem armazenamento: sem aviso */ }
    const evs = S.simulateAway()
    if (game.firstTime || evs.length) setInfo({ kind: 'welcome', evs, first: game.firstTime })
    S.save()
  }, [toast, refresh])

  /** Abre um link de cartão-postal ou de obrigado (do endereço ou colado nas opções). */
  const abrirLink = useCallback(async (txt: string) => {
    const l = S.lerLink(txt)
    if (!l) { toast(MP.erro); return false }
    if (l.tipo === 'obrigado') { S.abrirObrigado(l.codigo); refresh(); return true }
    const p = await S.decodePostal(l.codigo)
    if (!p) { toast(MP.erro); return false }
    setShop(false); setFeed(false); setNb(null)
    S.startPostal(p)
    toast(fill(MP.joaquim_chegou, { de: p.de }), { bot: ASSESSOR })
    return true
  }, [toast, refresh])

  // link com #postal= ou #obrigado=: abre e limpa o endereço
  useEffect(() => {
    const ver = () => {
      const h = location.hash
      if (!/^#(postal|obrigado)=/.test(h)) return
      history.replaceState(null, '', location.pathname + location.search)
      abrirLink(h)
    }
    ver()
    window.addEventListener('hashchange', ver)
    return () => window.removeEventListener('hashchange', ver)
  }, [abrirLink])

  /** Compartilha pelo menu do celular; sem ele, copia; sem cópia, mostra o link pra copiar na mão. */
  const compartilhar = useCallback(async (url: string, title: string, text: string) => {
    if (navigator.share) {
      try { await navigator.share({ title, text, url }); return } catch (e) {
        if ((e as Error).name === 'AbortError') return
      }
    }
    try { await navigator.clipboard.writeText(url); toast(MP.copiado); return } catch { /* segue pro manual */ }
    setInfo({ kind: 'link', url })
  }, [toast])

  const mandarPostal = useCallback(() => {
    const enviar = async () => {
      let url = ''
      try { url = await S.exportPostal() } catch { return toast(MP.sem_suporte) }
      const v = { de: game.S.meuNome, cidade: game.S.cidade }
      compartilhar(url, fill(MP.titulo, v), fill(MP.texto, v))
    }
    if (game.S.meuNome) return enviar()
    setInfo({ kind: 'name', o: { titulo: MP.pergunta_nome, atual: '', dica: MP.pergunta_dica, ok: (v) => { game.S.meuNome = v; S.save(); enviar() } } })
  }, [compartilhar, toast])

  // canvas: laço do jogo e gestos
  useEffect(() => {
    const cv = canvasRef.current!
    const ctx = cv.getContext('2d')!
    let DPR = 1
    const resize = () => {
      DPR = Math.min(2, window.devicePixelRatio || 1)
      const W = window.innerWidth
      const H = window.innerHeight
      size.current = { W, H }
      cv.width = W * DPR
      cv.height = H * DPR
      cv.style.width = W + 'px'
      cv.style.height = H + 'px'
    }
    resize()
    centerCam(size.current.W, size.current.H)
    spawnCars(game.S.map, cfg.carros.na_cidade)
    window.addEventListener('resize', resize)

    let raf = 0
    let last = performance.now()
    let hudT = 0
    const frame = (t: number) => {
      const dt = Math.min(0.05, (t - last) / 1000)
      last = t
      S.updEnergy()
      updCars(dt)
      S.tickEvents()
      render(ctx, size.current.W, size.current.H, DPR, t)
      if (t - hudT > 400) {
        hudT = t
        S.checkMissions()
        refresh()
      }
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    const autosave = setInterval(S.save, cfg.autosave_seconds * 1000)
    const onHide = () => S.save()
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('pagehide', onHide)

    const tap = (px: number, py: number) => {
      const m = game.mode
      if (m.type === 'place' || m.type === 'road') {
        const t = pickTile(px, py)
        if (!t) return
        game.hover = t
        if (m.type === 'place') S.tryPlace(t[0], t[1])
        else S.toggleRoad(t[0], t[1])
        refresh()
        return
      }
      const t = pickObj(px, py) || pickTile(px, py)
      if (!t) return
      if (game.visiting) S.tapVisit(t[0], t[1])
      else S.tapCity(t[0], t[1])
      refresh()
    }

    const ptrs = new Map<number, { x: number; y: number }>()
    let drag: { sx: number; sy: number; cx: number; cy: number; moved: boolean } | null = null
    let pinch: { d: number; z: number; mx: number; my: number; cx: number; cy: number } | null = null
    const down = (e: PointerEvent) => {
      cv.setPointerCapture(e.pointerId)
      ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY })
      if (ptrs.size === 1) drag = { sx: e.clientX, sy: e.clientY, cx: cam.x, cy: cam.y, moved: false }
      else if (ptrs.size === 2) {
        const [a, b] = [...ptrs.values()]
        pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), z: cam.z, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, cx: cam.x, cy: cam.y }
        if (drag) drag.moved = true
      }
    }
    const move = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' && game.mode.type !== 'none') game.hover = pickTile(e.clientX, e.clientY)
      if (!ptrs.has(e.pointerId)) return
      ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY })
      if (pinch && ptrs.size === 2) {
        const [a, b] = [...ptrs.values()]
        const z = Math.max(cfg.camera.zoom_min, Math.min(cfg.camera.zoom_max, (pinch.z * Math.hypot(a.x - b.x, a.y - b.y)) / pinch.d))
        const wx = (pinch.mx - pinch.cx) / pinch.z
        const wy = (pinch.my - pinch.cy) / pinch.z
        const mx = (a.x + b.x) / 2
        const my = (a.y + b.y) / 2
        cam.z = z
        cam.x = mx - wx * z
        cam.y = my - wy * z
      } else if (drag) {
        const dx = e.clientX - drag.sx
        const dy = e.clientY - drag.sy
        if (Math.hypot(dx, dy) > 8) drag.moved = true
        if (drag.moved) {
          cam.x = drag.cx + dx
          cam.y = drag.cy + dy
        }
      }
    }
    const end = (e: PointerEvent) => {
      ptrs.delete(e.pointerId)
      if (ptrs.size < 2 && pinch) {
        pinch = null
        if (ptrs.size === 1) {
          const p = [...ptrs.values()][0]
          drag = { sx: p.x, sy: p.y, cx: cam.x, cy: cam.y, moved: true }
        }
        return
      }
      if (ptrs.size === 0) {
        if (drag && !drag.moved && e.type === 'pointerup') {
          // o click sintetizado do toque cairia no modal recém-aberto sob o dedo (ex.: "Confirmar"); engole-o
          const swallow = (ev: Event) => { ev.stopPropagation(); ev.preventDefault() }
          document.addEventListener('click', swallow, { capture: true, once: true })
          setTimeout(() => document.removeEventListener('click', swallow, true), 400)
          tap(e.clientX, e.clientY)
        }
        drag = null
      }
    }
    const wheel = (e: WheelEvent) => {
      e.preventDefault()
      const z = Math.max(cfg.camera.zoom_min, Math.min(cfg.camera.zoom_max, cam.z * (e.deltaY < 0 ? 1.1 : 0.9)))
      const wx = (e.clientX - cam.x) / cam.z
      const wy = (e.clientY - cam.y) / cam.z
      cam.z = z
      cam.x = e.clientX - wx * z
      cam.y = e.clientY - wy * z
    }
    cv.addEventListener('pointerdown', down)
    cv.addEventListener('pointermove', move)
    cv.addEventListener('pointerup', end)
    cv.addEventListener('pointercancel', end)
    cv.addEventListener('wheel', wheel, { passive: false })
    return () => {
      cancelAnimationFrame(raf)
      clearInterval(autosave)
      window.removeEventListener('resize', resize)
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('pagehide', onHide)
      cv.removeEventListener('pointerdown', down)
      cv.removeEventListener('pointermove', move)
      cv.removeEventListener('pointerup', end)
      cv.removeEventListener('pointercancel', end)
      cv.removeEventListener('wheel', wheel)
    }
  }, [refresh])

  const st = game.S
  const vis = game.visiting
  const max = S.eMax(st.nivel)
  const pop = S.popNow()
  const popMax = S.popMax()
  const mode = game.mode

  const setMode = (m: S.Mode) => {
    S.setMode(m)
    refresh()
  }
  const renameCity = () =>
    setInfo({
      kind: 'name',
      o: {
        titulo: 'Nome da sua cidade', atual: st.cidade, sortear: S.sugerirCidade,
        ok: (v) => { st.cidade = v; S.save(); toast(`Bem-vinda a ${v}! 🏙️`) },
      },
    })

  return (
    <>
      <canvas ref={canvasRef} />

      <div className="hud">
        <div className="pill"><span className="ico gold">$</span><span>{fmt(st.ouro)}</span></div>
        <div className="pill"><span className="ico cash">G</span><span>{fmt(st.grana)}</span></div>
        <div className="pill">
          <span className="ico bolt">⚡</span>
          <div>
            <div>{st.energia}/{max}</div>
            <div className="bar"><i style={{ width: `${Math.min(100, (st.energia / max) * 100)}%` }} /></div>
          </div>
          {st.energia < max && <span className="small">+1 em 0:{String(S.nextEnergyIn()).padStart(2, '0')}</span>}
        </div>
        <div className="pill">
          <span className="ico lvl">{st.nivel}</span>
          <div>
            <div className="small">Nível</div>
            <div className="bar xp"><i style={{ width: `${(st.xp / S.need(st.nivel)) * 100}%` }} /></div>
          </div>
        </div>
        <div className="pill"><span className="ico pop">👥</span><span>{pop}/{popMax}</span></div>
        <div className="pill city" onClick={() => !vis && renameCity()} title="Renomear cidade">
          <span className="ico city">🏙️</span><span>{st.cidade}</span>
        </div>
        <button className="gear" onClick={() => setInfo({ kind: 'options' })} title="Opções">⚙</button>
      </div>

      {!vis && (
        <div className="quests">
          {S.ativas().map((m) => {
            const ok = S.completa(m)
            const tot = m.tarefas.reduce((s, t) => s + t.n, 0)
            const fe = m.tarefas.reduce((s, t) => s + S.prog(m, t), 0)
            return (
              <div key={m.id} className={`q ${ok ? 'ready' : ''} ${!st.mseen.includes(m.id) ? 'novo' : ''}`} onClick={() => {
                if (!st.mseen.includes(m.id)) { st.mseen.push(m.id); S.save() }
                setInfo({ kind: 'quest', id: m.id })
              }}>
                {m.ic}
                <span className="qp">{ok ? '✓' : `${fe}/${tot}`}</span>
              </div>
            )
          })}
          {(() => {
            const ts = S.pedido()
            const feito = S.pedidoResgatado()
            const ok = !feito && S.pedidoCompleto()
            const tot = ts.reduce((s, t) => s + t.n, 0)
            const fe = ts.reduce((s, t) => s + S.progDia(t), 0)
            return (
              <div className={`q dia ${ok ? 'ready' : ''} ${!S.pedidoVisto() ? 'novo' : ''} ${feito ? 'feito' : ''}`} onClick={() => {
                S.verPedido()
                setInfo({ kind: 'pedido' })
              }}>
                {DIARIAS.ic}
                <span className="qp">{feito || ok ? '✓' : `${fe}/${tot}`}</span>
              </div>
            )
          })()}
        </div>
      )}

      {vis ? (
        <div className="banner on">
          <Avatar b={vis.bot} size={34} />
          <div>
            {vis.postal
              ? fill(MP.banner, { cidade: vis.bot.cidade ?? '', de: vis.postal.de, nivel: vis.nivel ?? 1 })
              : `${vis.bot.cidade} · ${vis.bot.nome}, nível ${st.botLv[vis.bot.id]}`}
            <div className="small" style={{ opacity: 0.75 }}>Toque nas estrelas pra ajudar ({vis.helps}/{cfg.vizinhos.ajudas_por_visita})</div>
          </div>
          <button className="btn sm red" onClick={S.endVisit}>Voltar</button>
        </div>
      ) : mode.type === 'place' ? (
        <div className="banner on">
          <div>Toque num espaço vazio pra construir: <b>{DEFS[mode.k].nome}</b></div>
          <button className="btn sm red" onClick={() => setMode({ type: 'none' })}>Cancelar</button>
        </div>
      ) : mode.type === 'road' ? (
        <div className="banner on">
          <div>Toque pra colocar ou tirar rua ({cfg.rua_custo} ouro)</div>
          <button className="btn sm" onClick={() => setMode({ type: 'none' })}>Pronto</button>
        </div>
      ) : null}

      <div id="toasts">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.big ? 'big' : ''} ${t.bot ? '' : 'plain'}`}>
            {t.bot && <div className="mini" dangerouslySetInnerHTML={{ __html: avatarSVG(t.bot) }} />}
            <span>{t.text}</span>
          </div>
        ))}
      </div>

      <div className="bottom">
        <div className="neighbors">
          {BOTS.map((b) => (
            <div className="nb" key={b.id} onClick={() => setNb(b.id)}>
              <Avatar b={b} lv={st.botLv[b.id]} />
              <div className="nm">{b.nome}</div>
            </div>
          ))}
          <div className="nb add" onClick={() => toast('Logo dá pra criar quantos vizinhos bots quiser 🙂')}>
            <div className="av">+</div>
            <div className="nm">Convidar</div>
          </div>
        </div>
        <div className="actions">
          <button className="btn orange" disabled={!!vis} onClick={() => { setShop(true); setMode({ type: 'none' }) }}>🏪 Loja</button>
          <button className="btn" disabled={!!vis} onClick={() => setMode(mode.type === 'road' ? { type: 'none' } : { type: 'road' })}>🛣️ Ruas</button>
          <button className="btn blue" onClick={() => { st.unread = 0; S.save(); setFeed(true) }}>
            📰 Mural{st.unread > 0 && <span className="badge on">{st.unread}</span>}
          </button>
        </div>
      </div>

      {shop && (
        <Modal title="Loja" onClose={() => setShop(false)}>
          <div className="tabs">
            {CATS.map(([k, n]) => (
              <button key={k} className={`tab ${k === shopCat ? 'on' : ''}`} onClick={() => setShopCat(k)}>{n}</button>
            ))}
          </div>
          <div className="grid">
            {Object.entries(DEFS).filter(([, d]) => d.cat === shopCat).map(([k, d]) => {
              const moeda = d.moeda === 'grana' ? 'grana' : 'ouro'
              const lock = !!d.req && st.nivel < d.req
              const afford = st[moeda] >= (d.preco ?? 0)
              const det = d.renda
                ? `+${d.renda} a cada ${S.tempoMs(k) / 1000}s` + (d.pop ? ` · ${d.pop} moradores` : '')
                : d.popMax ? `+${d.popMax} de população máx.` : `+${d.xp} XP · enfeita a cidade`
              return (
                <div key={k} className={`card ${!afford || lock ? 'off' : ''}`} onClick={() => {
                  if (lock) return toast(`Libera no nível ${d.req}`)
                  if (!afford) return toast(`Falta ${moeda === 'grana' ? 'Grana' : 'Ouro'} pra isso`)
                  setShop(false)
                  setMode({ type: 'place', k })
                }}>
                  <canvas ref={(c) => { if (c && !c.dataset.k) { c.dataset.k = k; preview(c, k) } }} />
                  <b>{d.nome}</b>
                  <div className="det">{det}</div>
                  <span className={`price ${moeda === 'grana' ? 'g' : ''}`}>{moeda === 'grana' ? 'G ' : '$ '}{fmt(d.preco ?? 0)}</span>
                  {lock && <div className="lock">🔒 Nível {d.req}</div>}
                </div>
              )
            })}
          </div>
        </Modal>
      )}

      {feed && (
        <Modal title="Mural dos vizinhos" onClose={() => setFeed(false)}>
          <div className="feed">
            {!st.feed.length && <div className="empty">Nada por aqui ainda. Os vizinhos já já aparecem!</div>}
            {st.feed.map((ev) => {
              let act: ReactNode = null
              if (!ev.done) {
                const go = () => { S.actOnEvent(ev.id); refresh() }
                if (ev.tipo === 'presente') act = <button className="btn sm" onClick={go}>Aceitar</button>
                else if (ev.tipo === 'pedido') act = <button className="btn sm blue" onClick={go}>Ajudar</button>
                else if (ev.tipo === 'nivel') act = <button className="btn sm orange" onClick={go}>Curtir</button>
              } else if (ev.tipo !== 'fala' && ev.tipo !== 'visita') act = <span className="ok">✓ feito</span>
              return <Post key={ev.id} ev={ev} act={act} />
            })}
          </div>
        </Modal>
      )}

      {nb && (() => {
        const b = botById(nb)
        const sent = S.giftSentToday(b.id)
        return (
          <Modal title={b.nome} onClose={() => setNb(null)}>
            <div className="body">
              <div className="prof">
                <Avatar b={b} lv={st.botLv[b.id]} />
                <div><h3>{b.nome}</h3><div>Nível {st.botLv[b.id]} · {PERFIS[b.perfil ?? 'normal'].texto}</div></div>
              </div>
              <div className="row">
                <button className="btn blue" onClick={() => { setNb(null); S.startVisit(b) }}>🏘️ Visitar cidade</button>
                <button className="btn orange" disabled={sent} onClick={() => { setNb(null); S.sendGift(b); refresh() }}>
                  {sent ? 'Presente enviado hoje' : '🎁 Mandar presente'}
                </button>
              </div>
            </div>
          </Modal>
        )
      })()}

      {info && <InfoModal info={info} close={() => setInfo(null)} open={setInfo} renameCity={renameCity} toast={toast} refresh={refresh}
        abrirLink={abrirLink} mandarPostal={mandarPostal} compartilhar={compartilhar} />}
    </>
  )
}

function Post({ ev, act }: { ev: Ev; act?: ReactNode }) {
  return (
    <div className="post">
      <div className="mini" dangerouslySetInnerHTML={{ __html: avatarSVG(botById(ev.bot)) }} />
      <div className="tx">{ev.texto}<div className="tm">{ago(ev.t)}</div></div>
      {act}
    </div>
  )
}

function NameForm({ o, close, toast }: { o: AskName; close: () => void; toast: (t: string) => void }) {
  const [v, setV] = useState(o.atual)
  const done = () => {
    const val = v.trim().slice(0, NAME_MAX)
    if (!val) return toast('Escreve um nome 🙂')
    close()
    o.ok(val)
  }
  return (
    <div className="body">
      <input className="nameIn" maxLength={NAME_MAX} value={v} autoFocus onFocus={(e) => e.target.select()}
        onChange={(e) => setV(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && done()} />
      <div className="hint">{o.dica ?? `Até ${NAME_MAX} letras. Aparece na placa embaixo do prédio.`}</div>
      <div className="row">
        {o.sortear && <button className="btn sm orange" onClick={() => setV(o.sortear!())}>🎲 Sortear</button>}
        <button className="btn" onClick={done}>Confirmar</button>
      </div>
    </div>
  )
}

function ColarPostal({ abrir, close }: { abrir: (t: string) => Promise<boolean>; close: () => void }) {
  const [v, setV] = useState('')
  const ir = async () => { if (await abrir(v)) close() }
  return (
    <div className="colar">
      <b>{MP.colar_titulo}</b>
      <div className="hint">{MP.colar_dica}</div>
      <div className="row">
        <input className="nameIn" value={v} placeholder="https://...#postal=..." onChange={(e) => setV(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && ir()} />
        <button className="btn sm blue" onClick={ir}>{MP.colar_botao}</button>
      </div>
    </div>
  )
}

function InfoModal(p: {
  info: Info; close: () => void; open: (i: Info) => void; renameCity: () => void; toast: (t: string, o?: { big?: boolean; bot?: Bot }) => void; refresh: () => void
  abrirLink: (t: string) => Promise<boolean>; mandarPostal: () => void; compartilhar: (url: string, title: string, text: string) => Promise<void>
}) {
  const { info, close } = p
  const st = game.S
  if (info.kind === 'name') {
    return <Modal title={info.o.titulo} onClose={close}><NameForm o={info.o} close={close} toast={p.toast} /></Modal>
  }
  if (info.kind === 'building') {
    const b = info.b
    const d = DEFS[b.k]
    const now = Date.now()
    const nm = S.nomeDe(b, st.cidade) || d.nome
    let status = ''
    if (d.renda) {
      const left = S.tempoMs(b.k) - (now - b.start)
      status = left > 0 ? `Pronto em ${Math.ceil(left / 1000)}s` : 'Pronto pra coletar!'
    }
    const linhas = [
      ['Tipo', d.nome], d.renda ? ['Rende', `${d.renda} ouro a cada ${S.tempoMs(b.k) / 1000}s`] : null,
      d.pop ? ['Moradores', d.pop] : null, d.popMax ? ['População máxima', `+${d.popMax}`] : null, status ? ['Status', status] : null,
    ].filter(Boolean) as [string, string | number][]
    return (
      <Modal title={nm} onClose={close}>
        <div className="body">
          {linhas.map(([a, v]) => <div className="stat" key={a}><span>{a}</span><b>{v}</b></div>)}
          <div className="row">
            <button className="btn sm orange" onClick={() => {
              if (b.k === 'prefeitura') return p.renameCity()
              p.open({ kind: 'name', o: { titulo: 'Renomear', atual: b.nome || d.nome, sortear: () => S.sugerirNome(b.k), ok: (v) => { b.nome = v; S.save(); p.toast(`Agora se chama ${v} ✨`) } } })
            }}>✏️ {b.k === 'prefeitura' ? 'Renomear cidade' : 'Renomear'}</button>
            <button className="btn sm" onClick={close}>Fechar</button>
          </div>
        </div>
      </Modal>
    )
  }
  if (info.kind === 'quest') {
    const m = MISSOES.find((x) => x.id === info.id)!
    const ok = S.completa(m)
    return (
      <Modal title={m.titulo} onClose={close}>
        <div className="body">
          <div className="giver">
            <Avatar b={ASSESSOR} />
            <div className="balao"><b>{ASSESSOR.nome}, assessor:</b> {ok ? 'Mandou bem demais! Aqui tá sua recompensa.' : m.fala}</div>
          </div>
          {m.tarefas.map((t) => {
            const pr = S.prog(m, t)
            return (
              <div key={t.t} className={`task ${pr >= t.n ? 'ok' : ''}`}>
                {pr >= t.n ? '✅' : '⬜'} {t.t} <b style={{ float: 'right' }}>{pr}/{t.n}</b>
                <div className="tb"><i style={{ width: `${(pr / t.n) * 100}%` }} /></div>
              </div>
            )
          })}
          <div className="reward">{S.premioTxt(m.premio).map((x) => <span key={x}>{x}</span>)}</div>
          <div className="row">
            {ok
              ? <button className="btn orange" onClick={() => { close(); S.claim(m.id); p.refresh() }}>🎁 Resgatar</button>
              : <button className="btn sm" onClick={close}>Bora!</button>}
          </div>
        </div>
      </Modal>
    )
  }
  if (info.kind === 'pedido') {
    const ts = S.pedido()
    const feito = S.pedidoResgatado()
    const ok = !feito && S.pedidoCompleto()
    const { degrau, folga, quebra } = S.degrauHoje()
    const F = DIARIAS.falas
    return (
      <Modal title={DIARIAS.titulo} onClose={close}>
        <div className="body">
          <div className="giver">
            <Avatar b={ASSESSOR} />
            <div className="balao">
              <b>{ASSESSOR.nome}, assessor:</b> {S.falaPedido()}
              {!feito && folga && <div className="small">{F.folga}</div>}
              {!feito && quebra && <div className="small">{F.quebra}</div>}
            </div>
          </div>
          {ts.map((t) => {
            const pr = S.progDia(t)
            return (
              <div key={t.k} className={`task ${pr >= t.n ? 'ok' : ''}`}>
                {pr >= t.n ? '✅' : '⬜'} {t.t} <b style={{ float: 'right' }}>{pr}/{t.n}</b>
                <div className="tb"><i style={{ width: `${(pr / t.n) * 100}%` }} /></div>
              </div>
            )
          })}
          <div className="baus">
            {DIARIAS.baus.map((b, i) => {
              const n = i + 1
              return (
                <div key={n} className={`bau ${n === degrau ? 'hoje' : ''} ${n < degrau || (feito && n === degrau) ? 'foi' : ''}`}>
                  <div className="d">Dia {n}</div>
                  <div className="ic">{n < degrau || (feito && n === degrau) ? '✅' : b.grana ? '💎' : '🎁'}</div>
                  <div className="v">{S.premioTxt(b).map((x) => <span key={x}>{x}</span>)}</div>
                </div>
              )
            })}
          </div>
          <div className="row">
            {ok
              ? <button className="btn orange" onClick={() => { close(); S.resgatarPedido(); p.refresh() }}>🎁 Resgatar</button>
              : feito
                ? <><span className="hint">{F.amanha}</span><button className="btn sm" onClick={close}>Fechar</button></>
                : <button className="btn sm" onClick={close}>Bora!</button>}
          </div>
        </div>
      </Modal>
    )
  }
  if (info.kind === 'options') {
    return (
      <Modal title="Opções" onClose={close}>
        <div className="body">
          <p>Os vizinhos são bots que agem sozinhos, mesmo com o jogo fechado. Sua cidade fica salva só neste aparelho.</p>
          <p><b>Dicas:</b> arraste pra mover o mapa, use pinça (ou a roda do mouse) pra zoom, toque nas moedas pra coletar e nas árvores pra cortar.</p>
          {!game.visiting && (
            <div className="row">
              <button className="btn" onClick={() => { close(); p.mandarPostal() }}>{MP.botao}</button>
              {st.meuNome && (
                <span className="hint">{fill(MP.assinatura, { de: st.meuNome })} · <a href="#" onClick={(e) => {
                  e.preventDefault()
                  p.open({ kind: 'name', o: { titulo: MP.pergunta_nome, atual: st.meuNome, dica: MP.pergunta_dica, ok: (v) => { st.meuNome = v; S.save() } } })
                }}>{MP.trocar}</a></span>
              )}
            </div>
          )}
          <ColarPostal abrir={p.abrirLink} close={close} />
          <div className="hint versao">{fill(MSG.versao, { v: __VERSAO__, data: __BUILD__ })}</div>
          <div className="row">
            <button className="btn sm orange" onClick={() => { st.placas = !st.placas; S.save(); close() }}>🏷️ {st.placas ? 'Esconder placas' : 'Mostrar placas'}</button>
            <button className="btn sm" onClick={() => { centerCam(window.innerWidth, window.innerHeight); close() }}>Centralizar mapa</button>
            <button className="btn sm red" onClick={() => p.open({ kind: 'reset' })}>Recomeçar do zero</button>
          </div>
        </div>
      </Modal>
    )
  }
  if (info.kind === 'link') {
    return (
      <Modal title={MP.link_titulo} onClose={close}>
        <div className="body">
          <p>{MP.copiar_manual}</p>
          <textarea className="nameIn linkTxt" readOnly value={info.url} onFocus={(e) => e.target.select()} />
          <div className="row"><button className="btn sm" onClick={close}>Fechar</button></div>
        </div>
      </Modal>
    )
  }
  if (info.kind === 'obrigado') {
    const cidade = info.v.bot.cidade ?? ''
    const enviar = () => p.compartilhar(S.linkObrigado(info.v), fill(MP.obrigado_titulo, { de: st.meuNome }), fill(MP.obrigado_texto, { de: st.meuNome, cidade }))
    return (
      <Modal title={MP.ajudou_titulo} onClose={close}>
        <div className="body">
          <p>{fill(MP.ajudou, { de: info.v.bot.nome, cidade })}</p>
          <div className="row">
            <button className="btn orange" onClick={() => {
              if (st.meuNome) { close(); enviar(); return }
              p.open({ kind: 'name', o: { titulo: MP.pergunta_nome, atual: '', dica: MP.pergunta_dica, ok: (v) => { st.meuNome = v; S.save(); enviar() } } })
            }}>{MP.obrigado_botao}</button>
            <button className="btn sm" onClick={close}>Fechar</button>
          </div>
        </div>
      </Modal>
    )
  }
  if (info.kind === 'reset') {
    return (
      <Modal title="Opções" onClose={close}>
        <div className="body">
          <p>Apagar a cidade e começar de novo?</p>
          <div className="row">
            <button className="btn sm red" onClick={() => {
              S.reset()
              spawnCars(game.S.map, cfg.carros.na_cidade)
              close()
              p.toast('Cidade nova! 🏙️')
              p.refresh()
            }}>Sim, recomeçar</button>
            <button className="btn sm" onClick={close}>Não</button>
          </div>
        </div>
      </Modal>
    )
  }
  // boas-vindas
  return (
    <Modal title={info.first ? 'Bem-vinda à Cidade Feliz!' : 'Bem-vinda de volta, prefeita!'} onClose={close}>
      <div className="body">
        <p>{info.first ? 'Uma cidade só sua, no estilo dos jogos de 2010. Os vizinhos já estão se mexendo por aqui.' : 'Sua cidade continuou rendendo enquanto você estava fora.'}</p>
        {info.evs.length > 0 && <p><b>Enquanto você estava fora:</b></p>}
        {info.evs.map((ev) => <Post key={ev.id} ev={ev} />)}
        <div className="row"><button className="btn orange" onClick={close}>Bora jogar!</button></div>
      </div>
    </Modal>
  )
}
