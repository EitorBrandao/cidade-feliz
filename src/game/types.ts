export type Category = 'casas' | 'comercio' | 'comunidade' | 'decoracao' | 'inicial'
export type Shape = 'house' | 'shop' | 'tower' | 'civic' | 'plaza' | 'tree' | 'bed'

export interface Look {
  shape: Shape
  color: string
  roof?: string
  accent?: string
  h: number
  k: number
  extra?: 'cross' | 'clock'
}

export interface BuildingDef {
  id: string
  name: string
  category: Category
  price?: { gold?: number; grana?: number }
  income?: number
  cycle?: number
  pop?: number
  popMax?: number
  level?: number
  build?: number
  xp?: number
  named: 'required' | 'optional' | 'none'
  look: Look
}

export interface Building {
  uid: number
  def: string
  x: number
  y: number
  name: string
  /** Quando a obra termina (ms). */
  readyAt: number
  /** Início do ciclo de produção atual (ms). */
  lastCollect: number
}

export interface Tile {
  road: boolean
  tree: boolean
  /** uid da construção neste tile, 0 se vazio. */
  b: number
}

export interface GameState {
  version: 1
  cityName: string
  gold: number
  grana: number
  energy: number
  energyAt: number
  level: number
  xp: number
  tiles: Tile[][]
  buildings: Building[]
  nextUid: number
  savedAt: number
}

export interface Float {
  wx: number
  wy: number
  text: string
  color: string
  t0: number
}

/** Resultado de uma ação: o que mostrar na tela. */
export interface ActionResult {
  ok: boolean
  msg?: string
  floats?: { text: string; color: string }[]
  levelUp?: number
  uid?: number
}
