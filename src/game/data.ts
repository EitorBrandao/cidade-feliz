// Todos os números e textos do jogo vêm da pasta data/. Nada de número solto no código.
import configJson from '../../data/config.json'
import buildingsJson from '../../data/buildings.json'
import mapStartJson from '../../data/map_start.json'
import namesJson from '../../data/names.json'
import type { BuildingDef } from './types'

export const cfg = configJson
export const defList = buildingsJson as BuildingDef[]
export const defs: Record<string, BuildingDef> = Object.fromEntries(defList.map((d) => [d.id, d]))
export const mapStart = mapStartJson as {
  roads: { from: [number, number]; to: [number, number] }[]
  buildings: { def: string; x: number; y: number; name?: string }[]
}
export const names = namesJson as Record<string, string[]>

export const CATEGORIES: { id: BuildingDef['category']; label: string }[] = [
  { id: 'casas', label: 'Casas' },
  { id: 'comercio', label: 'Comércio' },
  { id: 'comunidade', label: 'Comunidade' },
  { id: 'decoracao', label: 'Decoração' },
]

export const NAME_MAX = 24
