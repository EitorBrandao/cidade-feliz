// Todos os números e textos do jogo vêm da pasta data/. Nada de número solto no código.
import configJson from '../../data/config.json'
import buildingsJson from '../../data/buildings.json'
import mapStartJson from '../../data/map_start.json'
import namesJson from '../../data/names.json'
import botsJson from '../../data/bots.json'
import messagesJson from '../../data/messages.json'
import missionsJson from '../../data/missions.json'

export type Draw =
  | 'house' | 'shop' | 'tower' | 'school' | 'hall' | 'plaza' | 'tree' | 'flowers'
  | 'library' | 'campus' | 'station' | 'church' | 'stadium' | 'mall'
  | 'fountain' | 'bench' | 'lamp' | 'palm' | 'playground' | 'gazebo' | 'lake' | 'statue'
export interface Def {
  nome: string
  cat: string
  preco?: number
  moeda?: 'grana'
  renda?: number
  tempo?: number
  pop?: number
  popMax?: number
  /** XP extra em toda coleta, enquanto tiver uma dessas construções pronta (conta uma vez por tipo) */
  xpColeta?: number
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
  /** variação de cor da árvore */
  v?: number
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
export interface Faixa { nivel: number; min: number; max: number }
export interface ModeloDiario { id: string; t: string; k: string; precisa?: string; faixas: Faixa[] }
export type Premio = { ouro?: number; grana?: number; xp?: number }
export interface Missao { id: string; ic: string; titulo: string; fala: string; tarefas: Tarefa[]; premio: Premio }

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
export const DIARIAS = missionsJson.diarias as {
  id: string; ic: string; titulo: string; quantas: number
  modelos: ModeloDiario[]; baus: Premio[]
  falas: { novo: string[]; completo: string[]; resgatado: string[]; folga: string; quebra: string; aviso_novo: string; aviso_completo: string; resgate: string; amanha: string }
}

export const botById = (id: string) => BOTS.find((b) => b.id === id) ?? BOTS[0]
export const NAME_MAX = 24
