// Regras do jogo. Funções puras que mexem no estado e devolvem o que mostrar.
import { cfg, defs, mapStart, names, NAME_MAX } from './data'
import type { ActionResult, Building, BuildingDef, GameState, Tile } from './types'

const SAVE_KEY = 'cidade-feliz-save-v1'
const N = cfg.map_size

export const now = () => Date.now()
export const cycleMs = (d: BuildingDef) => (d.cycle ?? 0) * 1000 * cfg.time_multiplier
export const buildMs = (d: BuildingDef) => (d.build ?? cfg.construction_seconds) * 1000 * cfg.time_multiplier
export const energyMax = (level: number) =>
  cfg.energy.max_base + Math.floor((level - 1) / cfg.energy.max_plus_every_levels)
export const xpNeed = (level: number) => cfg.level_xp.base + level * cfg.level_xp.per_level
const regenMs = cfg.energy.regen_seconds * 1000

export const inBounds = (x: number, y: number) => x >= 0 && y >= 0 && x < N && y < N
export const isBorder = (x: number, y: number) => x === 0 || y === 0 || x === N - 1 || y === N - 1
export const isRoad = (s: GameState, x: number, y: number) => inBounds(x, y) && s.tiles[y][x].road
export const byUid = (s: GameState, uid: number) => s.buildings.find((b) => b.uid === uid)

const pick = <T,>(list: T[]) => list[Math.floor(Math.random() * list.length)]

export function suggestName(def: BuildingDef): string {
  const list = names[def.id]
  return list?.length ? pick(list) : def.name
}

export function suggestCityName(): string {
  return pick(names.cidade)
}

export const cleanName = (raw: string) => raw.replace(/\s+/g, ' ').trim().slice(0, NAME_MAX)

// Gerador aleatório com semente, para as árvores do começo saírem sempre iguais.
function seeded(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function newGame(t = now()): GameState {
  const tiles: Tile[][] = []
  for (let y = 0; y < N; y++) {
    const row: Tile[] = []
    for (let x = 0; x < N; x++) row.push({ road: false, tree: false, b: 0 })
    tiles.push(row)
  }
  for (const r of mapStart.roads) {
    for (let y = Math.min(r.from[1], r.to[1]); y <= Math.max(r.from[1], r.to[1]); y++)
      for (let x = Math.min(r.from[0], r.to[0]); x <= Math.max(r.from[0], r.to[0]); x++)
        if (inBounds(x, y) && !isBorder(x, y)) tiles[y][x].road = true
  }
  const s: GameState = {
    version: 1,
    cityName: cfg.start.city_name,
    gold: cfg.start.gold,
    grana: cfg.start.grana,
    energy: energyMax(cfg.start.level),
    energyAt: t,
    level: cfg.start.level,
    xp: cfg.start.xp,
    tiles,
    buildings: [],
    nextUid: 1,
    savedAt: t,
  }
  for (const sb of mapStart.buildings) {
    const def = defs[sb.def]
    const b: Building = {
      uid: s.nextUid++, def: def.id, x: sb.x, y: sb.y,
      name: sb.name ?? '',
      readyAt: t,
      lastCollect: t - cycleMs(def), // já começa com moeda pronta
    }
    s.buildings.push(b)
    tiles[sb.y][sb.x].b = b.uid
  }
  const rnd = seeded(cfg.tree.seed)
  let placed = 0
  for (let tries = 0; placed < cfg.tree.count && tries < 2000; tries++) {
    const x = 1 + Math.floor(rnd() * (N - 2))
    const y = 1 + Math.floor(rnd() * (N - 2))
    const tile = tiles[y][x]
    const nearCenter = Math.abs(x - 7) <= 2 && Math.abs(y - 7) <= 2
    if (tile.road || tile.b || tile.tree || nearCenter) continue
    tile.tree = true
    placed++
  }
  return s
}

// ---------- Save ----------

export function save(s: GameState) {
  s.savedAt = now()
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(s))
  } catch {
    /* sem armazenamento: o jogo segue sem salvar */
  }
}

export function load(): GameState {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    if (raw) {
      const s = JSON.parse(raw) as GameState
      if (s.version === 1 && s.tiles?.length === N) return s
    }
  } catch {
    /* save quebrado: começa de novo */
  }
  return newGame()
}

export function resetGame(): GameState {
  try {
    localStorage.removeItem(SAVE_KEY)
  } catch {
    /* ignora */
  }
  return newGame()
}

// ---------- Energia, XP, população ----------

export function syncEnergy(s: GameState, t = now()) {
  const max = energyMax(s.level)
  if (s.energy >= max) {
    s.energyAt = t
    return
  }
  const gained = Math.floor((t - s.energyAt) / regenMs)
  if (gained > 0) {
    s.energy = Math.min(max, s.energy + gained)
    s.energyAt = s.energy >= max ? t : s.energyAt + gained * regenMs
  }
}

/** Segundos até a próxima energia, ou 0 se está cheia. */
export function nextEnergyIn(s: GameState, t = now()) {
  if (s.energy >= energyMax(s.level)) return 0
  return Math.max(0, Math.ceil((s.energyAt + regenMs - t) / 1000))
}

function spendEnergy(s: GameState, t: number): boolean {
  syncEnergy(s, t)
  if (s.energy < 1) return false
  s.energy -= 1
  return true
}

/** Soma XP e devolve o novo nível, se subiu. */
function addXp(s: GameState, amount: number, t: number): number | undefined {
  s.xp += amount
  let up: number | undefined
  while (s.xp >= xpNeed(s.level)) {
    s.xp -= xpNeed(s.level)
    s.level += 1
    s.grana += cfg.grana_per_level
    up = s.level
  }
  if (up) {
    s.energy = energyMax(s.level)
    s.energyAt = t
  }
  return up
}

export function population(s: GameState) {
  let pop = 0
  let max = 0
  for (const b of s.buildings) {
    const d = defs[b.def]
    pop += d.pop ?? 0
    max += d.popMax ?? 0
  }
  return { pop, max }
}

export const unlockedAt = (level: number) =>
  Object.values(defs).filter((d) => d.category !== 'inicial' && (d.level ?? 1) === level)

// ---------- Construções ----------

export const isBuilding = (b: Building, t = now()) => t < b.readyAt
export const isReady = (b: Building, t = now()) => {
  const d = defs[b.def]
  return !!d.income && t >= b.readyAt && t - b.lastCollect >= cycleMs(d)
}
/** 0 a 1: quanto falta para a próxima moeda. */
export const cycleProgress = (b: Building, t = now()) => {
  const d = defs[b.def]
  if (!d.income) return 0
  return Math.min(1, Math.max(0, (t - b.lastCollect) / cycleMs(d)))
}
export const buildProgress = (b: Building, t = now()) => {
  const total = buildMs(defs[b.def])
  return total <= 0 ? 1 : Math.min(1, 1 - (b.readyAt - t) / total)
}

export function priceText(d: BuildingDef) {
  if (d.price?.grana) return `${d.price.grana} Grana`
  return `${d.price?.gold ?? 0} ouro`
}

export function canAfford(s: GameState, d: BuildingDef) {
  return s.gold >= (d.price?.gold ?? 0) && s.grana >= (d.price?.grana ?? 0)
}

/** Motivo de não poder construir aqui, ou null se pode. */
export function placeProblem(s: GameState, d: BuildingDef, x: number, y: number): string | null {
  if (!inBounds(x, y) || isBorder(x, y)) return 'Fora do terreno'
  const tile = s.tiles[y][x]
  if (tile.road) return 'Tem rua aqui'
  if (tile.tree) return 'Corte a árvore primeiro'
  if (tile.b) return 'Já tem construção aqui'
  if ((d.level ?? 1) > s.level) return `Libera no nível ${d.level}`
  if (!canAfford(s, d)) return d.price?.grana ? 'Falta Grana' : 'Falta ouro'
  if (d.pop) {
    const { pop, max } = population(s)
    if (pop + d.pop > max) return 'Sem espaço pra moradores: construa Escola ou Posto'
  }
  return null
}

export function place(s: GameState, d: BuildingDef, x: number, y: number, t = now()): ActionResult {
  const problem = placeProblem(s, d, x, y)
  if (problem) return { ok: false, msg: problem }
  s.gold -= d.price?.gold ?? 0
  s.grana -= d.price?.grana ?? 0
  const readyAt = t + buildMs(d)
  const b: Building = {
    uid: s.nextUid++, def: d.id, x, y,
    name: d.named === 'required' ? suggestName(d) : '',
    readyAt, lastCollect: readyAt,
  }
  s.buildings.push(b)
  s.tiles[y][x].b = b.uid
  const xp = d.xp ?? cfg.xp.build
  const levelUp = addXp(s, xp, t)
  const floats = [{ text: d.price?.grana ? `-${d.price.grana} Grana` : `-${d.price?.gold ?? 0}`, color: '#ffd84d' }, { text: `+${xp} XP`, color: '#7fd3ff' }]
  return { ok: true, uid: b.uid, floats, levelUp }
}

export function collect(s: GameState, b: Building, t = now()): ActionResult {
  if (!isReady(b, t)) return { ok: false }
  if (!spendEnergy(s, t)) return { ok: false, msg: 'Sem energia! Ela volta sozinha com o tempo.' }
  const d = defs[b.def]
  s.gold += d.income ?? 0
  b.lastCollect = t
  const levelUp = addXp(s, cfg.xp.collect, t)
  return { ok: true, levelUp, floats: [{ text: `+${d.income}`, color: '#ffd84d' }, { text: `+${cfg.xp.collect} XP`, color: '#7fd3ff' }] }
}

export function cutTree(s: GameState, x: number, y: number, t = now()): ActionResult {
  const tile = s.tiles[y][x]
  if (!tile.tree) return { ok: false }
  if (!spendEnergy(s, t)) return { ok: false, msg: 'Sem energia pra cortar a árvore.' }
  tile.tree = false
  s.gold += cfg.tree.gold
  const levelUp = addXp(s, cfg.tree.xp, t)
  return { ok: true, levelUp, floats: [{ text: `+${cfg.tree.gold}`, color: '#ffd84d' }, { text: `+${cfg.tree.xp} XP`, color: '#7fd3ff' }] }
}

export function toggleRoad(s: GameState, x: number, y: number, t = now()): ActionResult {
  if (!inBounds(x, y) || isBorder(x, y)) return { ok: false, msg: 'Fora do terreno' }
  const tile = s.tiles[y][x]
  if (tile.road) {
    tile.road = false
    return { ok: true }
  }
  if (tile.b) return { ok: false, msg: 'Já tem construção aqui' }
  if (tile.tree) return { ok: false, msg: 'Corte a árvore primeiro' }
  if (s.gold < cfg.road_cost) return { ok: false, msg: 'Falta ouro' }
  s.gold -= cfg.road_cost
  tile.road = true
  const levelUp = addXp(s, cfg.xp.road, t)
  return { ok: true, levelUp, floats: [{ text: `-${cfg.road_cost}`, color: '#ffd84d' }] }
}

export function rename(b: Building, raw: string) {
  b.name = cleanName(raw)
}
