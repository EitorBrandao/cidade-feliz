// Regras do jogo: estado, economia, vizinhos bots, visitas e missões.
// A interface conversa com isto pelo objeto `fx` (toasts, números flutuando, janelas).
import { ASSESSOR, ATIVAS_MAX, BOTS, botById, cfg, DEFS, NAME_MAX, DIARIAS, MISSOES, MSG, NOMES, PERFIS, START, type Bot, type Missao, type Premio, type Tarefa } from './data'
import { fill, hash, pick, rand, rng } from './util'

export const N = cfg.map_size
const SAVE_KEY = 'cidade-feliz-save-v1'
const VERSION = 5
const MULT = cfg.time_multiplier

export interface B { k: string; builtAt: number; start: number; nome?: string; help?: boolean }
export interface Tile { r: boolean; b: B | null; tree: boolean }
export type EvTipo = 'presente' | 'pedido' | 'fala' | 'visita' | 'nivel'
export interface Ev { id: number; bot: string; tipo: EvTipo; texto: string; t: number; done: boolean; give?: { ouro?: number; energia?: number } }
export interface State {
  version: 5
  map: Tile[]
  ouro: number
  grana: number
  energia: number
  eLast: number
  xp: number
  nivel: number
  feed: Ev[]
  unread: number
  botLv: Record<string, number>
  sent: Record<string, string>
  cidade: string
  placas: boolean
  cnt: Record<string, number>
  claimed: string[]
  mbase: Record<string, Record<string, number>>
  mseen: string[]
  mnotif: string[]
  pending: { at: number; ev: Ev }[]
  lastSeen: number
  // Pedido do Dia
  pedidoDia: string
  pedidoBase: Record<string, number>
  pedidoTarefas: Tarefa[]
  pedidoResgatado: string
  sequencia: number
  folgaUsada: number
  // cartão-postal
  meuNome: string
  postaisVistos: string[]
}
export interface Visit { bot: Bot; map: Tile[]; helps: number; nivel?: number; postal?: { id: string; de: string } }
export type Mode = { type: 'none' } | { type: 'place'; k: string } | { type: 'road' } | { type: 'move'; from: [number, number] | null }
export interface ToastOpts { big?: boolean; bot?: Bot }
export interface AskName { titulo: string; atual: string; dica?: string; sortear?: () => string; ok: (v: string) => void }

export const fx = {
  toast: (_text: string, _o?: ToastOpts) => {},
  float: (_x: number, _y: number, _text: string, _col: string, _up?: number) => {},
  openBuilding: (_b: B) => {},
  askName: (_o: AskName) => {},
  visitChanged: () => {},
  postalAjudado: (_v: Visit) => {},
}

// ---------- utilidades ----------

export const isRoad = (map: Tile[], x: number, y: number) => x >= 0 && y >= 0 && x < N && y < N && map[y * N + x].r
export const DIRS: [number, number, 't' | 'r' | 'b' | 'l', 't' | 'r' | 'b' | 'l'][] = [
  [1, 0, 'r', 'b'], [-1, 0, 'l', 't'], [0, 1, 'b', 'l'], [0, -1, 't', 'r'],
]
const blankMap = (): Tile[] => Array.from({ length: N * N }, () => ({ r: false, b: null, tree: false }))
export const precisaNome = (k: string) => ['comercio', 'comunidade', 'lazer'].includes(DEFS[k].cat)
export const tempoMs = (k: string) => (DEFS[k].tempo ?? 0) * 1000 * MULT
export const buildMs = (k: string) => (DEFS[k].build ?? 4) * 1000 * MULT
export const need = (n: number) => cfg.nivel_xp.base + n * cfg.nivel_xp.por_nivel
export const eMax = (nivel: number) => cfg.energia.max_base + Math.floor(nivel / cfg.energia.mais_um_a_cada_niveis)
const regenMs = cfg.energia.regen_segundos * 1000

export function sugerirNome(k: string, dono?: string, r: () => number = Math.random) {
  const l = NOMES[k] || [DEFS[k].nome]
  const opts = dono ? l : l.filter((s) => !s.includes('{n}'))
  return pick(opts.length ? opts : l, r).replace('{n}', dono || '')
}
export const sugerirCidade = () => pick(NOMES.cidade)
export const nomeDe = (b: B, cidade: string) => (b.k === 'prefeitura' ? `Prefeitura de ${cidade}` : b.nome || '')

// ---------- estado e save ----------

function newState(): State {
  const m = blankMap()
  const at = (x: number, y: number) => m[y * N + x]
  const now = Date.now()
  for (const r of START.ruas)
    for (let y = Math.min(r.from[1], r.to[1]); y <= Math.max(r.from[1], r.to[1]); y++)
      for (let x = Math.min(r.from[0], r.to[0]); x <= Math.max(r.from[0], r.to[0]); x++) at(x, y).r = true
  for (const c of START.construcoes) at(c.x, c.y).b = { k: c.k, builtAt: 0, start: now - c.pronta_ha * 1000, nome: c.nome }
  const R = rng(cfg.arvore.semente)
  const c0 = (N - 1) / 2
  m.forEach((t, i) => {
    const x = i % N
    const y = (i / N) | 0
    const d = Math.max(Math.abs(x - c0), Math.abs(y - c0))
    if (!t.r && !t.b && d > cfg.arvore.distancia_centro && R() < cfg.arvore.chance) t.tree = true
  })
  const botLv: Record<string, number> = {}
  BOTS.forEach((b) => (botLv[b.id] = b.nivel ?? 1))
  return {
    version: VERSION, map: m, ouro: cfg.start.ouro, grana: cfg.start.grana, energia: cfg.start.energia, eLast: now,
    xp: 0, nivel: cfg.start.nivel, feed: [], unread: 0, botLv, sent: {}, cidade: cfg.start.cidade, placas: true,
    cnt: {}, claimed: [], mbase: {}, mseen: [], mnotif: [], pending: [], lastSeen: now,
    ...pedidoVazio(), meuNome: '', postaisVistos: [],
  }
}

const pedidoVazio = () => ({ pedidoDia: '', pedidoBase: {}, pedidoTarefas: [] as Tarefa[], pedidoResgatado: '', sequencia: 0, folgaUsada: -1 })

/** Leva um save antigo até a versão atual, passo a passo. Devolve null se não der pra aproveitar. */
function upgrade(s: any): State | null {
  if (!s || typeof s !== 'object') return null
  if (s.version === 1) s = migrateV1(s)
  if (s.version === 3) Object.assign(s, pedidoVazio(), { version: 4 })
  if (s.version === 4) Object.assign(s, { meuNome: '', postaisVistos: [], version: 5 })
  return s.version === VERSION ? (s as State) : null
}

/** Converte o save da primeira versão (antes do protótipo) sem perder a cidade. */
function migrateV1(old: any): State {
  const s = newState()
  const rename: Record<string, string> = { mercadinho: 'mercado', canteiro: 'flores' }
  s.map = blankMap()
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const t = old.tiles?.[y]?.[x]
      if (!t) continue
      s.map[y * N + x].r = !!t.road
      s.map[y * N + x].tree = !!t.tree
    }
  for (const b of old.buildings ?? []) {
    const k = rename[b.def] ?? b.def
    if (!DEFS[k]) continue
    s.map[b.y * N + b.x].b = { k, builtAt: b.readyAt ?? 0, start: b.lastCollect ?? Date.now(), nome: b.name || undefined }
  }
  s.ouro = old.gold ?? s.ouro
  s.grana = old.grana ?? s.grana
  s.energia = old.energy ?? s.energia
  s.nivel = old.level ?? s.nivel
  s.xp = old.xp ?? 0
  s.cidade = old.cityName || s.cidade
  s.lastSeen = old.savedAt ?? Date.now()
  return s
}

export const game = {
  S: null as unknown as State,
  firstTime: false,
  visiting: null as Visit | null,
  mode: { type: 'none' } as Mode,
  hover: null as [number, number] | null,
  nextEv: Date.now() + rand(6000, 12000),
}

export function load() {
  let s: any = null
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    s = raw ? JSON.parse(raw) : null
  } catch {
    s = null
  }
  s = upgrade(s)
  game.firstTime = !s
  game.S = s ?? newState()
  const S = game.S
  S.pending ??= []
  S.map.forEach((t) => {
    if (t.b && precisaNome(t.b.k) && !t.b.nome) t.b.nome = sugerirNome(t.b.k)
  })
}

export function save() {
  game.S.lastSeen = Date.now()
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(game.S))
  } catch {
    /* sem armazenamento: segue sem salvar */
  }
}

export function reset() {
  game.S = newState()
  game.firstTime = false
  game.visiting = null
  game.mode = { type: 'none' }
  save()
}

export const curMap = () => (game.visiting ? game.visiting.map : game.S.map)
export const cidadeAtual = () => (game.visiting ? game.visiting.bot.cidade ?? '' : game.S.cidade)
export function popNow() {
  let p = 0
  game.S.map.forEach((t) => { if (t.b) p += DEFS[t.b.k].pop ?? 0 })
  return p
}
export function popMax() {
  let p = 0
  game.S.map.forEach((t) => { if (t.b) p += DEFS[t.b.k].popMax ?? 0 })
  return p
}
/** XP extra por coleta: Escola, Biblioteca, Museu e Universidade prontas (cada tipo conta uma vez). */
export function bonusXp(now = Date.now()) {
  const tipos = new Set<string>()
  game.S.map.forEach((t) => { if (t.b && now >= t.b.builtAt && DEFS[t.b.k].xpColeta) tipos.add(t.b.k) })
  let n = 0
  tipos.forEach((k) => { n += DEFS[k].xpColeta! })
  return n
}
export const track = (k: string) => { game.S.cnt[k] = (game.S.cnt[k] || 0) + 1 }

// ---------- energia e XP ----------

export function updEnergy(now = Date.now()) {
  const S = game.S
  const max = eMax(S.nivel)
  while (S.energia < max && now - S.eLast >= regenMs) {
    S.energia++
    S.eLast += regenMs
  }
  if (S.energia >= max) S.eLast = now
}
export const nextEnergyIn = () => Math.max(0, Math.ceil((regenMs - (Date.now() - game.S.eLast)) / 1000))

export function addXP(n: number) {
  const S = game.S
  S.xp += n
  while (S.xp >= need(S.nivel)) {
    S.xp -= need(S.nivel)
    S.nivel++
    S.grana += cfg.grana_por_nivel
    S.energia = eMax(S.nivel)
    fx.toast(`Nível ${S.nivel}! 🎉 +${cfg.grana_por_nivel} Grana e energia cheia`, { big: true })
  }
}

// ---------- ações na própria cidade ----------

export const canPlace = (x: number, y: number) => {
  const t = game.S.map[y * N + x]
  return !!t && !t.r && !t.b
}

export function setMode(m: Mode) {
  game.mode = m
  game.hover = null
}

export function tryPlace(x: number, y: number) {
  const S = game.S
  if (game.mode.type !== 'place') return
  const k = game.mode.k
  const d = DEFS[k]
  if (!canPlace(x, y)) return fx.toast('Esse espaço tá ocupado')
  const moeda = d.moeda === 'grana' ? 'grana' : 'ouro'
  const preco = d.preco ?? 0
  if (S[moeda] < preco) return fx.toast(`Falta ${moeda === 'grana' ? 'Grana' : 'Ouro'} pra isso`)
  if (d.pop && popNow() + d.pop > popMax()) return fx.toast('População no máximo! Constrói uma Escola ou Posto de Saúde 🏫')
  const now = Date.now()
  const tile = S.map[y * N + x]
  tile.tree = false
  S[moeda] -= preco
  const ready = now + buildMs(k)
  const b: B = { k, builtAt: ready, start: ready }
  tile.b = b
  track('construir:' + k)
  track('construir:' + d.cat)
  fx.float(x, y, '-' + preco, moeda === 'grana' ? '#a8ff8f' : '#ffb3a7', 40)
  addXP(d.xp || 5)
  setMode({ type: 'none' })
  if (precisaNome(k)) {
    b.nome = sugerirNome(k)
    fx.askName({
      titulo: 'Como vai se chamar?', atual: b.nome, sortear: () => sugerirNome(k),
      ok: (v) => { b.nome = v; save(); fx.toast(`${v} vem aí! 🚧`) },
    })
  }
  save()
}

export function toggleRoad(x: number, y: number) {
  const S = game.S
  const t = S.map[y * N + x]
  if (t.b) return fx.toast('Tem uma construção aqui')
  if (t.r) {
    t.r = false
    fx.float(x, y, 'removida', '#fff', 30)
  } else {
    if (S.ouro < cfg.rua_custo) return fx.toast('Falta Ouro')
    S.ouro -= cfg.rua_custo
    t.r = true
    t.tree = false
    track('rua')
    fx.float(x, y, '-' + cfg.rua_custo, '#ffb3a7', 30)
  }
  save()
}

// ---------- mover construções ----------

/** Começa a mover a construção `b` (já escolhida). */
export function moveFrom(b: B) {
  const i = game.S.map.findIndex((t) => t.b === b)
  if (i < 0) return
  setMode({ type: 'move', from: [i % N, (i / N) | 0] })
}

/** Toque no modo Mover: primeiro escolhe a construção, depois o lugar novo. Não custa nada. */
export function tapMove(x: number, y: number) {
  const S = game.S
  const m = game.mode
  if (m.type !== 'move') return
  const tile = S.map[y * N + x]
  if (tile.b) {
    if (m.from && m.from[0] === x && m.from[1] === y) { game.mode = { type: 'move', from: null }; return fx.toast('Tudo bem, ficou onde estava') }
    game.mode = { type: 'move', from: [x, y] }
    const nm = nomeDe(tile.b, S.cidade) || DEFS[tile.b.k].nome
    return fx.toast(`${nm}: agora toque no lugar novo`)
  }
  if (!m.from) return fx.toast('Primeiro toque na construção que quer mover')
  if (tile.r) return fx.toast('Aí é rua! Escolhe um espaço de grama')
  const src = S.map[m.from[1] * N + m.from[0]]
  const b = src.b
  if (!b) { game.mode = { type: 'move', from: null }; return }
  tile.tree = false
  tile.b = b
  src.b = null
  track('mover')
  fx.float(x, y, 'mudou!', '#ffffff', 50)
  game.mode = { type: 'move', from: null }
  save()
}

/** Toque num tile da própria cidade, sem modo ativo. */
export function tapCity(x: number, y: number) {
  const S = game.S
  const now = Date.now()
  const tile = S.map[y * N + x]
  if (tile.b) {
    const b = tile.b
    const d = DEFS[b.k]
    if (now < b.builtAt) return fx.toast(`${d.nome} em construção: falta ${Math.ceil((b.builtAt - now) / 1000)}s 🚧`)
    if (d.renda) {
      const left = tempoMs(b.k) - (now - b.start)
      if (left <= 0) {
        const custo = cfg.energia.custo_coleta
        if (S.energia < custo) return fx.toast('Sem energia! ⚡ Espera recarregar ou aceita presente de vizinho')
        S.energia -= custo
        S.ouro += d.renda
        b.start = now
        track('coletar')
        track('coletar:' + d.cat)
        track('coletar:' + b.k)
        const xp = Math.ceil(d.renda / cfg.coleta_xp_divisor) + bonusXp(now)
        fx.float(x, y, '+' + d.renda, '#ffe36b')
        fx.float(x, y, `+${xp} XP`, '#8fd6ff', 90)
        addXP(xp)
        save()
      } else fx.openBuilding(b)
    } else fx.openBuilding(b)
    return
  }
  if (tile.tree) {
    if (S.energia < 1) return fx.toast('Sem energia pra cortar a árvore ⚡')
    S.energia--
    tile.tree = false
    S.ouro += cfg.arvore.ouro
    track('cortar')
    addXP(cfg.arvore.xp)
    fx.float(x, y, '+' + cfg.arvore.ouro, '#ffe36b', 40)
    fx.float(x, y, `+${cfg.arvore.xp} XP`, '#8fd6ff', 70)
    save()
  }
}

// ---------- vizinhos bots ----------

const V = cfg.vizinhos
function weighted(obj: Record<string, number>) {
  const ent = Object.entries(obj)
  let r = Math.random() * ent.reduce((a, [, w]) => a + w, 0)
  for (const [k, w] of ent) if ((r -= w) <= 0) return k
  return ent[0][0]
}
const lojasProntas = () =>
  game.S.map.filter((t) => t.b && t.b.nome && DEFS[t.b.k].cat === 'comercio' && Date.now() >= t.b.builtAt).map((t) => t.b!.nome!)

export function genEvent(t = Date.now()): Ev {
  const S = game.S
  let r = Math.random() * BOTS.reduce((a, b) => a + (b.peso ?? 1), 0)
  let bot = BOTS[0]
  for (const b of BOTS) if ((r -= b.peso ?? 1) <= 0) { bot = b; break }
  const tipo = weighted(PERFIS[bot.perfil ?? 'normal'].pesos) as EvTipo
  const n = bot.nome
  const ev: Ev = { id: t + Math.random(), bot: bot.id, tipo, texto: '', t, done: false }
  if (tipo === 'presente') {
    const p = pick(MSG.presente) as { texto: string; energia?: number }
    ev.texto = fill(p.texto, { n })
    ev.give = p.energia ? { energia: p.energia } : { ouro: Math.round(rand(V.presente_ouro[0], V.presente_ouro[1])) }
  } else if (tipo === 'nivel') {
    S.botLv[bot.id] = (S.botLv[bot.id] || bot.nivel || 1) + 1
    ev.texto = fill(MSG.nivel, { n, nivel: S.botLv[bot.id] })
  } else ev.texto = fill(pick(MSG[tipo] as string[]), { n })
  const lojas = lojasProntas()
  if (lojas.length && tipo === 'fala' && Math.random() < MSG.fala_loja_chance)
    ev.texto = fill(pick(MSG.fala_loja), { n, loja: pick(lojas), cidade: S.cidade })
  if (lojas.length && tipo === 'visita' && Math.random() < MSG.visita_loja_chance)
    ev.texto = fill(MSG.visita_loja, { n, loja: pick(lojas), cidade: S.cidade })
  return ev
}

export function pushEvent(ev: Ev, silent = false) {
  const S = game.S
  if (ev.tipo === 'visita') {
    S.ouro += V.visita_ouro
    ev.done = true
  }
  if (ev.tipo === 'fala') ev.done = true
  S.feed.unshift(ev)
  S.feed = S.feed.slice(0, V.feed_max)
  S.unread++
  if (!silent) fx.toast(ev.texto, { bot: botById(ev.bot) })
  save()
}

function schedule(bot: Bot, tipo: EvTipo, texto: string, delay: number, extra: Partial<Ev> = {}) {
  game.S.pending.push({ at: Date.now() + delay, ev: { id: Date.now() + Math.random(), bot: bot.id, tipo, texto, t: 0, done: tipo === 'fala', ...extra } })
}

const isNight = (d: Date) => d.getHours() >= V.madrugada[0] && d.getHours() < V.madrugada[1]

export function tickEvents() {
  const now = Date.now()
  const S = game.S
  const due = S.pending.filter((p) => now >= p.at)
  if (due.length) {
    S.pending = S.pending.filter((p) => now < p.at)
    due.forEach((p) => { p.ev.t = now; pushEvent(p.ev) })
  }
  if (now >= game.nextEv && !game.visiting) {
    pushEvent(genEvent())
    game.nextEv = now + rand(V.evento_segundos[0], V.evento_segundos[1]) * 1000 * (isNight(new Date()) ? V.madrugada_fator : 1)
  }
}

/** "Enquanto você estava fora": eventos que os bots teriam gerado, com teto e sossego de madrugada. */
export function simulateAway(): Ev[] {
  const S = game.S
  const now = Date.now()
  const out: Ev[] = []
  if (game.firstTime) {
    for (let i = 0; i < V.boas_vindas_eventos; i++) out.push(genEvent(now - rand(5, 90) * 60000))
  } else {
    const away = now - (S.lastSeen || now)
    const avg = ((V.evento_segundos[0] + V.evento_segundos[1]) / 2) * 1000
    const n = Math.min(V.fora_max_eventos, Math.floor(away / avg))
    for (let i = 0; i < n; i++) {
      const t = S.lastSeen + Math.random() * away
      if (isNight(new Date(t)) && Math.random() < 0.75) continue
      out.push(genEvent(t))
    }
  }
  // pendências que venceram com o jogo fechado
  const due = S.pending.filter((p) => now >= p.at)
  S.pending = S.pending.filter((p) => now < p.at)
  due.forEach((p) => { p.ev.t = p.at; out.push(p.ev) })
  out.sort((a, b) => a.t - b.t).forEach((ev) => pushEvent(ev, true))
  return out.reverse()
}

export function actOnEvent(id: number) {
  const S = game.S
  const ev = S.feed.find((e) => e.id === id)
  if (!ev || ev.done) return
  ev.done = true
  const b = botById(ev.bot)
  if (ev.tipo === 'presente' && ev.give) {
    if (ev.give.energia) {
      S.energia = Math.min(eMax(S.nivel) + cfg.energia.presente_teto_extra, S.energia + ev.give.energia)
      fx.toast(`+${ev.give.energia} energia ⚡`)
    } else {
      S.ouro += ev.give.ouro ?? 0
      fx.toast(`+${ev.give.ouro} de ouro 🪙`)
    }
  } else if (ev.tipo === 'pedido') {
    addXP(V.ajudar_pedido_xp)
    fx.toast(`Você ajudou ${b.nome} (+${V.ajudar_pedido_xp} XP)`)
    schedule(b, 'fala', fill(MSG.agradece_ajuda, { n: b.nome }), rand(V.agradece_segundos[0], V.agradece_segundos[1]) * 1000)
  } else if (ev.tipo === 'nivel') addXP(V.curtir_xp)
  save()
}

const today = () => new Date().toDateString()
export const giftSentToday = (id: string) => game.S.sent[id] === today()
export function sendGift(b: Bot) {
  const S = game.S
  S.sent[b.id] = today()
  track('presente')
  fx.toast(`Presente enviado pra ${b.nome}! 🎁`, { bot: b })
  schedule(b, 'fala', fill(pick(MSG.agradece_presente), { n: b.nome }), rand(V.agradece_segundos[0], V.agradece_segundos[1]) * 1000)
  if (PERFIS[b.perfil ?? 'normal'].sempre_devolve || Math.random() < V.presente_volta_chance)
    schedule(b, 'presente', fill(MSG.presente_volta, { n: b.nome }), rand(V.presente_volta_segundos[0], V.presente_volta_segundos[1]) * 1000, {
      give: { ouro: Math.round(rand(V.presente_volta_ouro[0], V.presente_volta_ouro[1])) },
    })
  save()
}

// ---------- visitar cidade de bot ----------

function genBotCity(b: Bot): Tile[] {
  const R = rng(hash(b.id))
  const lv = game.S.botLv[b.id]
  const m = blankMap()
  const at = (x: number, y: number) => m[y * N + x]
  const rows = [7]
  const cols = [7]
  if (lv >= 8) rows.push(11)
  if (lv >= 12) cols.push(11)
  if (lv >= 18) rows.push(3)
  if (lv >= 20) cols.push(3)
  rows.forEach((y) => { for (let x = 1; x <= 14; x++) at(x, y).r = true })
  cols.forEach((x) => { for (let y = 1; y <= 14; y++) at(x, y).r = true })
  at(8, 8).b = { k: 'prefeitura', builtAt: 0, start: 0 }
  const near: [number, number][] = []
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const t = at(x, y)
      if (t.r || t.b) continue
      if (DIRS.some(([dx, dy]) => isRoad(m, x + dx, y + dy))) near.push([x, y])
    }
  for (let i = near.length - 1; i > 0; i--) {
    const j = Math.floor(R() * (i + 1))
    ;[near[i], near[j]] = [near[j], near[i]]
  }
  const pool = ['casa', 'casa', 'chale', 'lanchonete', 'banca']
  if (lv >= 3) pool.push('sobrado', 'padaria', 'sobrado', 'cafe', 'casaverde')
  if (lv >= 5) pool.push('pizzaria', 'lanhouse', 'biblioteca', 'geminada')
  if (lv >= 6) pool.push('mercado', 'escola', 'farmacia', 'academia')
  if (lv >= 8) pool.push('cinema', 'igreja', 'petshop', 'creche')
  if (lv >= 10) pool.push('predio', 'sorveteria', 'predio', 'hotel', 'banco', 'hospital')
  if (lv >= 14) pool.push('posto', 'predio', 'universidade', 'shopping', 'estadio', 'bombeiros', 'mansao', 'museu')
  const count = Math.min(near.length, 6 + Math.round(lv * 1.8))
  const placed: B[] = []
  for (let i = 0; i < count; i++) {
    const [x, y] = near[i]
    const k = R() < 0.14 ? pick(['praca', 'flores', 'fonte', 'poste', 'palmeira', 'coreto', 'banquinho', 'ipe'], R) : pick(pool, R)
    const bb: B = { k, builtAt: 0, start: 0 }
    if (precisaNome(k)) bb.nome = sugerirNome(k, b.nome, R)
    at(x, y).b = bb
    if (DEFS[k].renda) placed.push(bb)
  }
  for (let i = placed.length - 1; i > 0; i--) {
    const j = Math.floor(R() * (i + 1))
    ;[placed[i], placed[j]] = [placed[j], placed[i]]
  }
  placed.slice(0, V.ajudas_por_visita).forEach((bb) => (bb.help = true))
  m.forEach((t) => { if (!t.r && !t.b && R() < 0.3) t.tree = true })
  return m
}

export function startVisit(b: Bot) {
  setMode({ type: 'none' })
  game.visiting = { bot: b, map: genBotCity(b), helps: 0 }
  fx.visitChanged()
}
export function endVisit() {
  game.visiting = null
  fx.visitChanged()
}
export function tapVisit(x: number, y: number) {
  const v = game.visiting!
  const tile = v.map[y * N + x]
  if (tile.b && tile.b.help) {
    tile.b.help = false
    v.helps++
    track('ajudar')
    game.S.ouro += V.ajuda_ouro
    addXP(V.ajuda_xp)
    fx.float(x, y, '+' + V.ajuda_ouro, '#ffe36b')
    fx.float(x, y, `+${V.ajuda_xp} XP`, '#8fd6ff', 90)
    if (v.helps === V.ajudas_por_visita) {
      fx.toast(`Você ajudou bastante! ${v.bot.nome} vai adorar ❤️`, { bot: v.bot })
      if (v.postal) fx.postalAjudado(v)
      else schedule(v.bot, 'fala', fill(MSG.agradece_visita, { n: v.bot.nome }), rand(8000, 16000))
    }
    save()
  } else if (tile.b && v.helps >= V.ajudas_por_visita) fx.toast('Você já ajudou o máximo hoje nessa cidade')
  else if (tile.b) fx.toast(nomeDe(tile.b, cidadeAtual()) || DEFS[tile.b.k].nome)
}

// ---------- missões ----------

export function ativas(): Missao[] {
  const S = game.S
  const a = MISSOES.filter((m) => !S.claimed.includes(m.id)).slice(0, ATIVAS_MAX)
  a.forEach((m) => { if (!S.mbase[m.id]) S.mbase[m.id] = { ...S.cnt } })
  return a
}
export function prog(m: Missao, t: Tarefa) {
  const S = game.S
  if (t.stat === 'pop') return Math.min(t.n, popNow())
  return Math.min(t.n, (S.cnt[t.k!] || 0) - ((S.mbase[m.id] || {})[t.k!] || 0))
}
export const completa = (m: Missao) => m.tarefas.every((t) => prog(m, t) >= t.n)
export const premioTxt = (p: Premio) =>
  [p.ouro ? `$ ${p.ouro}` : '', p.grana ? `G ${p.grana}` : '', p.xp ? `${p.xp} XP` : ''].filter(Boolean)

/** Avisa quando uma missão fica completa (uma vez só). */
export function checkMissions() {
  const S = game.S
  for (const m of ativas())
    if (completa(m) && !S.mnotif.includes(m.id)) {
      S.mnotif.push(m.id)
      fx.toast(`Missão completa: ${m.titulo}! Toque no ícone pra resgatar`, { bot: ASSESSOR })
    }
  checkPedido()
}

export function claim(id: string) {
  const S = game.S
  const m = MISSOES.find((x) => x.id === id)
  if (!m || !completa(m) || S.claimed.includes(id)) return
  S.claimed.push(id)
  const p = m.premio
  if (p.ouro) S.ouro += p.ouro
  if (p.grana) S.grana += p.grana
  fx.toast(`Missão cumprida! +${premioTxt(p).join(' +')}`, { big: true })
  if (p.xp) addXP(p.xp)
  const nova = ativas().find((x) => !S.mseen.includes(x.id))
  if (nova) setTimeout(() => fx.toast(`Nova missão: ${nova.titulo} ${nova.ic}`, { bot: ASSESSOR }), 2700)
  save()
}

// ---------- Pedido do Dia ----------

const F = DIARIAS.falas
const hoje = () => new Date().toDateString()
/** Dia local como número inteiro (1 = 2/1/1970), sem pegadinha de horário de verão. */
const diaNum = (ds: string) => {
  const d = new Date(ds)
  return Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000)
}
/** Segunda-feira da semana do dia (semana do calendário, de segunda a domingo). */
const semanaDe = (n: number) => n - ((n + 3) % 7)
const qtdArvores = () => game.S.map.filter((t) => t.tree).length
const tem = (x: string) => game.S.map.some((t) => t.b && Date.now() >= t.b.builtAt && (t.b.k === x || DEFS[t.b.k].cat === x))

function possivel(m: { k: string; precisa?: string }, f: { max: number }) {
  const S = game.S
  const [acao, alvo] = m.k.split(':')
  if (alvo && DEFS[alvo]?.req && S.nivel < DEFS[alvo].req!) return false
  if (acao === 'presente' && f.max > BOTS.length) return false
  if (m.precisa === 'arvores') return qtdArvores() >= f.max
  return !m.precisa || tem(m.precisa)
}

/** Sorteia as tarefas do dia. A semente é a data, então o mesmo dia sempre dá o mesmo pedido. */
function sortearPedido(dia: string): Tarefa[] {
  const S = game.S
  const R = rng(hash(dia))
  const pool = DIARIAS.modelos
    .map((m) => ({ m, f: [...m.faixas].reverse().find((f) => f.nivel <= S.nivel) }))
    .filter((x) => x.f && possivel(x.m, x.f))
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(R() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  return pool.slice(0, DIARIAS.quantas).map(({ m, f }) => {
    const n = f!.min + Math.floor(R() * (f!.max - f!.min + 1))
    return { t: fill(m.t, { n }), k: m.k, n }
  })
}

/** Pedido de hoje. Vira o dia: sorteia o novo e marca o ponto de partida dos contadores. */
export function pedido() {
  const S = game.S
  const dia = hoje()
  if (S.pedidoDia !== dia) {
    S.pedidoDia = dia
    S.pedidoBase = { ...S.cnt }
    S.pedidoTarefas = sortearPedido(dia)
    S.mseen = S.mseen.filter((x) => !x.startsWith('dia:'))
    S.mnotif = S.mnotif.filter((x) => !x.startsWith('dia:'))
  }
  return S.pedidoTarefas
}
export const progDia = (t: Tarefa) => Math.max(0, Math.min(t.n, (game.S.cnt[t.k!] || 0) - (game.S.pedidoBase[t.k!] || 0)))
export const pedidoResgatado = () => game.S.pedidoResgatado === hoje()
export const pedidoCompleto = () => pedido().every((t) => progDia(t) >= t.n)
export const pedidoVisto = () => game.S.mseen.includes('dia:' + hoje())
export function verPedido() {
  if (!pedidoVisto()) { game.S.mseen.push('dia:' + hoje()); save() }
}

/**
 * Degrau do baú de hoje (1 a 7). Dia seguido sobe um; uma folga por semana do calendário não quebra;
 * sumir mais que isso volta um degrau, nunca zera. Depois do 7 recomeça no 1.
 */
export function degrauHoje() {
  const S = game.S
  if (pedidoResgatado()) return { degrau: S.sequencia, folga: false, quebra: false }
  if (!S.pedidoResgatado || S.sequencia < 1) return { degrau: 1, folga: false, quebra: false }
  const d = diaNum(hoje())
  const gap = d - diaNum(S.pedidoResgatado)
  const sobe = (S.sequencia % DIARIAS.baus.length) + 1
  if (gap <= 1) return { degrau: sobe, folga: false, quebra: false }
  if (gap === 2 && S.folgaUsada !== semanaDe(d - 1)) return { degrau: sobe, folga: true, quebra: false }
  return { degrau: Math.max(1, S.sequencia - 1), folga: false, quebra: true }
}

/** Fala do Seu Joaquim, sorteada uma vez por dia. */
export function falaPedido() {
  const l = pedidoResgatado() ? F.resgatado : pedidoCompleto() ? F.completo : F.novo
  return pick(l, rng(hash('fala' + hoje())))
}

export function resgatarPedido() {
  const S = game.S
  if (pedidoResgatado() || !pedidoCompleto()) return
  const { degrau, folga } = degrauHoje()
  if (folga) S.folgaUsada = semanaDe(diaNum(hoje()) - 1)
  S.sequencia = degrau
  S.pedidoResgatado = hoje()
  const p = DIARIAS.baus[degrau - 1]
  if (p.ouro) S.ouro += p.ouro
  if (p.grana) S.grana += p.grana
  fx.toast(fill(F.resgate, { dia: degrau, premio: premioTxt(p).join(' +') }), { big: true })
  if (p.xp) addXP(p.xp)
  setTimeout(() => fx.toast(pick(F.resgatado), { bot: ASSESSOR }), 2700)
  save()
}

function checkPedido() {
  const S = game.S
  pedido()
  const id = 'dia:' + hoje()
  if (!pedidoVisto() && !S.mnotif.includes(id + ':novo')) {
    S.mnotif.push(id + ':novo')
    fx.toast(fill(F.aviso_novo, { ic: DIARIAS.ic }), { bot: ASSESSOR })
  }
  if (!pedidoResgatado() && pedidoCompleto() && !S.mnotif.includes(id)) {
    S.mnotif.push(id)
    fx.toast(fill(F.aviso_completo, { ic: DIARIAS.ic }), { bot: ASSESSOR })
  }
}

// ---------- cartão-postal ----------
// A cidade viaja dentro do link, depois do "#" (que não vai pra servidor nenhum).
// Visitar um postal não grava nada no save, fora XP, ouro e o contador das ajudas.

const P = cfg.postal
const MP = MSG.postal
type PostalTile = number | [number, string, string?]
export interface Postal { v: 1; id: string; de: string; cidade: string; nivel: number; t: PostalTile[] }

function toB64u(b: Uint8Array) {
  let s = ''
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i])
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
function fromB64u(s: string) {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(bin, (c) => c.charCodeAt(0))
}
/** Passa os bytes por um CompressionStream/DecompressionStream, parando se passar do limite. */
async function viaStream(bytes: Uint8Array, ts: TransformStream<Uint8Array, Uint8Array>, limite = Infinity) {
  const rd = new Blob([bytes]).stream().pipeThrough(ts).getReader()
  const parts: Uint8Array[] = []
  let n = 0
  for (;;) {
    const { done, value } = await rd.read()
    if (done) break
    n += value.length
    if (n > limite) { rd.cancel().catch(() => {}); throw new Error('grande demais') }
    parts.push(value)
  }
  const out = new Uint8Array(n)
  let o = 0
  for (const p of parts) { out.set(p, o); o += p.length }
  return out
}
const temZip = () => typeof CompressionStream !== 'undefined' && typeof DecompressionStream !== 'undefined'

/** Monta o link do cartão-postal com a cidade dentro. Código: "z" + deflate ou "j" + JSON puro. */
export async function exportPostal() {
  const S = game.S
  const t: PostalTile[] = S.map.map((tile) => {
    const f = (tile.r ? 1 : 0) | (tile.tree ? 2 : 0)
    if (!tile.b) return f
    return tile.b.nome ? [f, tile.b.k, tile.b.nome] : [f, tile.b.k]
  })
  const dados: Postal = { v: 1, id: Math.random().toString(36).slice(2, 10), de: S.meuNome, cidade: S.cidade, nivel: S.nivel, t }
  const bytes = new TextEncoder().encode(JSON.stringify(dados))
  const codigo = temZip()
    ? 'z' + toB64u(await viaStream(bytes, new CompressionStream('deflate-raw')))
    : 'j' + toB64u(bytes)
  return P.url + '#postal=' + codigo
}

/** Aceita o link inteiro, só o "#postal=..." ou só o código. */
export function lerLink(txt: string): { tipo: 'postal' | 'obrigado'; codigo: string } | null {
  const s = txt.trim()
  if (!s) return null
  const m = s.match(/(postal|obrigado)=([^\s&#]*)/)
  if (m) return { tipo: m[1] as 'postal' | 'obrigado', codigo: m[2] }
  return { tipo: 'postal', codigo: s }
}

const nomeOk = (x: unknown) => typeof x === 'string' && x.trim().length > 0 && x.length <= NAME_MAX
const has = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k)

/** Decodifica e confere tudo que veio do link. Qualquer coisa estranha: null. */
export async function decodePostal(codigo: string): Promise<Postal | null> {
  try {
    if (codigo.length < 2 || codigo.length > P.max_codigo || !/^[zj][A-Za-z0-9_-]+$/.test(codigo)) return null
    let bytes = fromB64u(codigo.slice(1))
    if (codigo[0] === 'z') {
      if (!temZip()) return null
      bytes = await viaStream(bytes, new DecompressionStream('deflate-raw'), P.max_json)
    } else if (bytes.length > P.max_json) return null
    const d = JSON.parse(new TextDecoder().decode(bytes))
    if (!d || typeof d !== 'object' || d.v !== 1) return null
    if (typeof d.id !== 'string' || !/^[a-z0-9]{1,16}$/.test(d.id)) return null
    if (!nomeOk(d.de) || !nomeOk(d.cidade)) return null
    if (!Number.isInteger(d.nivel) || d.nivel < 1 || d.nivel > P.nivel_max) return null
    if (!Array.isArray(d.t) || d.t.length !== N * N) return null
    const flagOk = (f: unknown) => Number.isInteger(f) && (f as number) >= 0 && (f as number) <= 3
    for (const x of d.t) {
      if (flagOk(x)) continue
      if (!Array.isArray(x) || x.length < 2 || x.length > 3 || !flagOk(x[0])) return null
      if (typeof x[1] !== 'string' || !has(DEFS, x[1])) return null
      if (x.length === 3 && !nomeOk(x[2])) return null
    }
    return { v: 1, id: d.id, de: d.de.trim(), cidade: d.cidade.trim(), nivel: d.nivel, t: d.t }
  } catch {
    return null
  }
}

/** Entra na cidade do postal como numa visita a bot. Nada disso vai pro save. */
export function startPostal(p: Postal) {
  setMode({ type: 'none' })
  const map: Tile[] = p.t.map((x) => {
    if (typeof x === 'number') return { r: !!(x & 1), tree: !(x & 1) && !!(x & 2), b: null }
    const b: B = { k: x[1], builtAt: 0, start: 0 }
    if (x[2]) b.nome = x[2].trim()
    return { r: false, tree: false, b }
  })
  const rendem = map.map((t) => t.b).filter((b): b is B => !!b && !!DEFS[b.k].renda)
  for (let i = rendem.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[rendem[i], rendem[j]] = [rendem[j], rendem[i]]
  }
  rendem.slice(0, V.ajudas_por_visita).forEach((b) => (b.help = true))
  const bot: Bot = { id: 'postal', nome: p.de, cidade: p.cidade, nivel: p.nivel, ...MP.avatar }
  game.visiting = { bot, map, helps: 0, nivel: p.nivel, postal: { id: p.id, de: p.de } }
  fx.visitChanged()
}

/** Link de agradecimento: #obrigado=<id>.<nome de quem ajudou> */
export function linkObrigado(v: Visit) {
  const nome = game.S.meuNome ? '.' + toB64u(new TextEncoder().encode(game.S.meuNome)) : ''
  return P.url + '#obrigado=' + v.postal!.id + nome
}

/** Quem abre o obrigado ganha um presente, uma vez só por cartão. */
export function abrirObrigado(codigo: string) {
  const S = game.S
  const [id, nb] = codigo.split('.')
  if (!/^[a-z0-9]{1,16}$/.test(id || '')) return fx.toast(MP.erro)
  let de = MP.obrigado_alguem
  try {
    const n = nb ? new TextDecoder('utf-8', { fatal: true }).decode(fromB64u(nb)) : ''
    if (nomeOk(n)) de = n.trim()
  } catch { /* nome quebrado: fica "Um vizinho" */ }
  if (S.postaisVistos.includes(id)) return fx.toast(MP.obrigado_repetido)
  S.postaisVistos = [...S.postaisVistos, id].slice(-P.vistos_max)
  S.ouro += P.obrigado_ouro
  fx.toast(fill(MP.obrigado_ganhou, { de, ouro: P.obrigado_ouro }), { big: true })
  save()
}
