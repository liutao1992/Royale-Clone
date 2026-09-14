import type { Vec2 } from './math'
import type { Team } from './data/arena'

export type EntityKind = 'unit' | 'building' | 'tower' | 'projectile'
export type EntityState = 'deploying' | 'idle' | 'moving' | 'attacking' | 'dying'
export type Layer = 'ground' | 'air'
export type TargetLayer = 'ground' | 'air' | 'both'
export type TargetType = 'any' | 'buildings'

/** 战斗属性（来源于卡牌/塔定义，见 data/cards.ts） */
export interface CombatProfile {
  damage: number
  hitSpeed: number
  /** 首攻时间 = firstHit；装填模型：firstHit = hitSpeed - loadTime */
  firstHit: number
  loadTime: number
  range: number
  sightRange: number
  targets: TargetLayer
  targetType: TargetType
  /** 溅射半径，0 = 单体 */
  areaRadius: number
  /** 投射物速度（tiles/s），0 = 近战立即结算 */
  projectileSpeed: number
}

export interface ProjectileData {
  targetId: number | null
  /** 无目标（法术）或目标消失后的落点 */
  targetPos: Vec2
  speed: number
  damage: number
  areaRadius: number
  /** 法术对塔伤害；0 = 使用 damage */
  towerDamage: number
  ownerTeam: Team
  /** 起飞延迟（秒） */
  delay: number
  /** 命中后眩晕时长（秒） */
  stun: number
  /** 命中后击退距离（tiles） */
  knockback: number
}

export interface Entity {
  id: number
  kind: EntityKind
  team: Team
  cardId: string
  pos: Vec2
  layer: Layer
  radius: number
  /** Infinity 表示不可推动（塔/建筑/投射物） */
  mass: number
  hp: number
  maxHp: number
  state: EntityState
  removed: boolean

  /** tiles/s；0 = 静止 */
  speed: number
  jumpRiver: boolean

  /** 无攻击能力时为 null（投射物亦为 null） */
  combat: CombatProfile | null
  targetId: number | null
  /** 距离下次可命中剩余时间 */
  attackTimer: number
  /** 眩晕剩余时间 */
  stunTimer: number

  /** 部署剩余时间；> 0 时处于 deploying 状态 */
  deployTimer: number
  /** 建筑寿命（秒）；0 = 无 */
  lifetime: number

  /** 仅投射物使用 */
  projectile: ProjectileData | null

  /** 塔专用：'king' 标记用于激活逻辑 */
  towerKind?: 'princess' | 'king'
  /** 国王塔激活标志 */
  activated?: boolean
}

export type MatchPhase = 'normal' | 'double' | 'overtime' | 'tiebreaker' | 'finished'

export interface TeamState {
  elixir: number
  crowns: number
  kingActivated: boolean
  /** 已解锁的可部署对方半场通道（摧毁对方该侧公主塔后） */
  unlockedLanes: { left: boolean; right: boolean }
  hand: string[]
  queue: string[]
  nextCard: string
}

export interface MatchEvent {
  time: number
  type: string
  message: string
}

export interface MatchState {
  phase: MatchPhase
  elapsed: number
  winner: Team | 'draw' | null
  teams: Record<Team, TeamState>
  events: MatchEvent[]
}
