// Todos os números e textos do jogo vêm da pasta data/. Nada de número solto no código.
import configJson from '../../data/config.json'
import buildingsJson from '../../data/buildings.json'
import mapStartJson from '../../data/map_start.json'
import namesJson from '../../data/names.json'
import botsJson from '../../data/bots.json'
import messagesJson from '../../data/messages.json'
import missionsJson from '../../data/missions.json'

export type Draw = 'house' | 'shop' | 'tower' | 'school' | 'hall' | 'plaza' | 'tree' | 'flowers'
export interface Def {
  nome: string
  cat: string
  preco?: number
  moeda?: 'grana'
  renda?: number
  tempo?: number
  pop?: number
  popMax?: number
  xp?: number
  build?: number
  req?: number
  draw: Draw
  wall?: string
  roof?: string
  sign?: string
  icon?: string
  h?: number
  floors?: number
  cross?: boolean
}
export interface Bot {
  id: string
  nome: string
  cor: string
  nivel?: number
  perfil?: string
  long: boolean
  hair: string
  skin: string
  cidade?: string
  peso?: number
}
export interface Tarefa { t: string; k?: string; stat?: 'pop'; n: number }
export interface Missao { id: string; ic: string; titulo: string; fala: string; tarefas: Tarefa[]; premio: { ouro?: number; grana?: number; xp?: number } }

export const cfg = configJson
export const DEFS = buildingsJson.construcoes as Record<string, Def>
export const CATS = buildingsJson.categorias as [string, string][]
export const START = mapStartJson as {
  ruas: { from: [number, number]; to: [number, number] }[]
  construcoes: { k: string; x: number; y: number; pronta_ha: number; nome?: string }[]
}
export const NOMES = namesJson as Record<string, string[]>
export const PERFIS = botsJson.perfis as Record<string, { texto: string; pesos: Record<string, number>; sempre_devolve?: boolean }>
export const BOTS = botsJson.bots as Bot[]
export const MSG = messagesJson
export const ASSESSOR = missionsJson.assessor as Bot
export const MISSOES = missionsJson.missoes as Missao[]
export const ATIVAS_MAX = missionsJson.ativas_max

export const botById = (id: string) => BOTS.find((b) => b.id === id) ?? BOTS[0]
export const NAME_MAX = 24
