import type { Vec2 } from '../math'
import type { CombatProfile, Layer, TargetLayer, TargetType } from '../types'

/**
 * 卡牌数值（基准：当前游戏锦标赛标准 L11，见 docs/CARDS.md）
 *
 * 单位约定：
 * - speed / projectileSpeed 已转换为 tiles/s（原文 tiles/min ÷ 60）
 * - 时间单位为秒
 */

export type CardType = 'troop' | 'building' | 'spell'

export interface SpellProfile {
  radius: number
  /** 每波伤害 */
  damage: number
  /** 每波对塔伤害；0 = 与 damage 相同 */
  towerDamage: number
  /** 视觉弹道速度（tiles/s）；0 = 瞬发 */
  projectileSpeed: number
  waves: number
  waveInterval: number
  /** 第一波落地延迟（视觉） */
  firstDelay: number
  stun: number
  knockback: number
}

export interface CardDef {
  id: string
  name: string
  cost: number
  type: CardType
  layer: Layer
  count: number
  radius: number
  mass: number
  speed: number
  deployTime: number
  /** 建筑寿命；0 = 无 */
  lifetime: number
  /** 多单位出生间隔（Stage 2 暂同步生成，字段供 Stage 4 动画） */
  spawnInterval: number
  /** 多单位相对部署点的偏移（y 方向对敌方镜像） */
  spawnOffsets: Vec2[]
  jumpRiver: boolean
  /** 单只生命值（法术为 0） */
  hp?: number
  combat: CombatProfile | null
  spell: SpellProfile | null
}

export interface TowerDef {
  id: string
  name: string
  size: number
  radius: number
  hp: number
  combat: CombatProfile
}

interface CombatInput {
  damage: number
  hitSpeed: number
  firstHit: number
  range: number
  sightRange: number
  targets: TargetLayer
  targetType?: TargetType
  areaRadius?: number
  /** tiles/s */
  projectileSpeed?: number
  loadTime?: number
}

function combat(input: CombatInput): CombatProfile {
  return {
    targetType: 'any',
    areaRadius: 0,
    projectileSpeed: 0,
    loadTime: Math.max(input.hitSpeed - input.firstHit, 0),
    ...input,
  }
}

function unit(partial: Partial<CardDef> & Pick<CardDef, 'id' | 'name' | 'cost' | 'combat'>): CardDef {
  return {
    type: 'troop',
    layer: 'ground',
    count: 1,
    radius: 0.5,
    mass: 4,
    speed: 1.0,
    deployTime: 1.0,
    lifetime: 0,
    spawnInterval: 0,
    spawnOffsets: [{ x: 0, y: 0 }],
    jumpRiver: false,
    spell: null,
    ...partial,
  }
}

const SQUARE_4: Vec2[] = [
  { x: -0.55, y: -0.55 },
  { x: 0.55, y: -0.55 },
  { x: -0.55, y: 0.55 },
  { x: 0.55, y: 0.55 },
]

export const CARD_DEFS: Record<string, CardDef> = {
  knight: unit({
    id: 'knight',
    name: 'Knight',
    cost: 3,
    hp: 1766,
    radius: 0.5,
    mass: 6,
    speed: 1.0,
    combat: combat({
      damage: 202,
      hitSpeed: 1.2,
      firstHit: 0.5,
      range: 1.2,
      sightRange: 5.5,
      targets: 'ground',
    }),
  }),

  valkyrie: unit({
    id: 'valkyrie',
    name: 'Valkyrie',
    cost: 4,
    hp: 1907,
    radius: 0.5,
    mass: 5,
    speed: 1.0,
    combat: combat({
      damage: 266,
      hitSpeed: 1.5,
      firstHit: 0.5,
      range: 1.2,
      sightRange: 5.5,
      targets: 'ground',
      areaRadius: 2.0,
    }),
  }),

  giant: unit({
    id: 'giant',
    name: 'Giant',
    cost: 5,
    hp: 3968,
    radius: 0.75,
    mass: 18,
    speed: 0.75,
    combat: combat({
      damage: 253,
      hitSpeed: 1.5,
      firstHit: 0.5,
      range: 1.2,
      sightRange: 7.5,
      targets: 'ground',
      targetType: 'buildings',
    }),
  }),

  'hog-rider': unit({
    id: 'hog-rider',
    name: 'Hog Rider',
    cost: 4,
    hp: 1697,
    radius: 0.6,
    mass: 4,
    speed: 2.0,
    jumpRiver: true,
    combat: combat({
      damage: 317,
      hitSpeed: 1.6,
      firstHit: 0.6,
      range: 0.8,
      sightRange: 9.5,
      targets: 'ground',
      targetType: 'buildings',
    }),
  }),

  musketeer: unit({
    id: 'musketeer',
    name: 'Musketeer',
    cost: 4,
    hp: 721,
    radius: 0.5,
    mass: 5,
    speed: 1.0,
    combat: combat({
      damage: 217,
      hitSpeed: 1.0,
      firstHit: 0.7,
      range: 6,
      sightRange: 6,
      targets: 'both',
      projectileSpeed: 1000 / 60,
    }),
  }),

  archers: unit({
    id: 'archers',
    name: 'Archers',
    cost: 3,
    hp: 304,
    count: 2,
    radius: 0.5,
    mass: 3,
    speed: 1.0,
    spawnInterval: 0.1,
    spawnOffsets: [
      { x: -0.55, y: 0 },
      { x: 0.55, y: 0 },
    ],
    combat: combat({
      damage: 112,
      hitSpeed: 0.9,
      firstHit: 0.5,
      range: 5,
      sightRange: 5.5,
      targets: 'both',
      projectileSpeed: 600 / 60,
    }),
  }),

  bomber: unit({
    id: 'bomber',
    name: 'Bomber',
    cost: 2,
    hp: 304,
    radius: 0.5,
    mass: 4,
    speed: 1.0,
    combat: combat({
      damage: 225,
      hitSpeed: 1.8,
      firstHit: 0.2,
      range: 4.5,
      sightRange: 5.5,
      targets: 'ground',
      areaRadius: 1.5,
      projectileSpeed: 400 / 60,
    }),
  }),

  minions: unit({
    id: 'minions',
    name: 'Minions',
    cost: 3,
    hp: 230,
    layer: 'air',
    count: 3,
    radius: 0.5,
    mass: 2,
    speed: 1.5,
    spawnInterval: 0.1,
    spawnOffsets: [
      { x: -0.7, y: 0 },
      { x: 0, y: 0 },
      { x: 0.7, y: 0 },
    ],
    combat: combat({
      damage: 107,
      hitSpeed: 1.2,
      firstHit: 0.5,
      range: 2.5,
      sightRange: 5.5,
      targets: 'both',
      projectileSpeed: 1000 / 60,
    }),
  }),

  goblins: unit({
    id: 'goblins',
    name: 'Goblins',
    cost: 2,
    hp: 202,
    count: 4,
    radius: 0.5,
    mass: 2,
    speed: 2.0,
    spawnInterval: 0.2,
    spawnOffsets: SQUARE_4,
    combat: combat({
      damage: 120,
      hitSpeed: 1.1,
      firstHit: 0.6,
      range: 0.5,
      sightRange: 5.5,
      targets: 'ground',
    }),
  }),

  'baby-dragon': unit({
    id: 'baby-dragon',
    name: 'Baby Dragon',
    cost: 4,
    hp: 1152,
    layer: 'air',
    radius: 0.5,
    mass: 5,
    speed: 1.5,
    combat: combat({
      damage: 168,
      hitSpeed: 1.5,
      firstHit: 0.3,
      range: 3.5,
      sightRange: 5.5,
      targets: 'both',
      areaRadius: 1.5,
      projectileSpeed: 1000 / 60,
    }),
  }),

  cannon: unit({
    id: 'cannon',
    name: 'Cannon',
    cost: 3,
    hp: 824,
    type: 'building',
    radius: 0.6,
    mass: Infinity,
    speed: 0,
    lifetime: 30,
    combat: combat({
      damage: 212,
      hitSpeed: 1.0,
      firstHit: 1.0,
      range: 5.5,
      sightRange: 5.5,
      targets: 'ground',
      projectileSpeed: 1000 / 60,
    }),
  }),
}

export const SPELL_DEFS: Record<string, CardDef> = {
  fireball: {
    id: 'fireball',
    name: 'Fireball',
    cost: 4,
    type: 'spell',
    layer: 'ground',
    count: 1,
    radius: 0,
    mass: Infinity,
    speed: 0,
    deployTime: 0,
    lifetime: 0,
    spawnInterval: 0,
    spawnOffsets: [],
    jumpRiver: false,
    combat: null,
    spell: {
      radius: 2.5,
      damage: 688,
      towerDamage: 207,
      projectileSpeed: 600 / 60,
      waves: 1,
      waveInterval: 0,
      firstDelay: 0.6,
      stun: 0,
      knockback: 1.0,
    },
  },

  arrows: {
    id: 'arrows',
    name: 'Arrows',
    cost: 3,
    type: 'spell',
    layer: 'ground',
    count: 1,
    radius: 0,
    mass: Infinity,
    speed: 0,
    deployTime: 0,
    lifetime: 0,
    spawnInterval: 0,
    spawnOffsets: [],
    jumpRiver: false,
    combat: null,
    spell: {
      radius: 3.5,
      damage: 122,
      towerDamage: 31,
      projectileSpeed: 1100 / 60,
      waves: 3,
      waveInterval: 0.3,
      firstDelay: 0.2,
      stun: 0,
      knockback: 0,
    },
  },

  zap: {
    id: 'zap',
    name: 'Zap',
    cost: 2,
    type: 'spell',
    layer: 'ground',
    count: 1,
    radius: 0,
    mass: Infinity,
    speed: 0,
    deployTime: 0,
    lifetime: 0,
    spawnInterval: 0,
    spawnOffsets: [],
    jumpRiver: false,
    combat: null,
    spell: {
      radius: 2.5,
      damage: 192,
      towerDamage: 58,
      projectileSpeed: 0,
      waves: 1,
      waveInterval: 0,
      firstDelay: 0,
      stun: 0.5,
      knockback: 0,
    },
  },
}

export const ALL_CARDS: Record<string, CardDef> = { ...CARD_DEFS, ...SPELL_DEFS }

export const TOWER_CARDS: Record<'princess-tower' | 'king-tower', TowerDef> = {
  'princess-tower': {
    id: 'princess-tower',
    name: 'Princess Tower',
    size: 3,
    radius: 1.0,
    hp: 3052,
    combat: combat({
      damage: 109,
      hitSpeed: 0.8,
      firstHit: 0.8,
      range: 7.5,
      sightRange: 7.5,
      targets: 'both',
      projectileSpeed: 600 / 60,
    }),
  },
  'king-tower': {
    id: 'king-tower',
    name: 'King Tower',
    size: 4,
    radius: 1.4,
    hp: 4824,
    combat: combat({
      damage: 109,
      hitSpeed: 1.0,
      firstHit: 0.5,
      range: 7,
      sightRange: 7,
      targets: 'both',
      projectileSpeed: 1000 / 60,
    }),
  },
}

export const DEFAULT_PLAYER_DECK = [
  'knight',
  'archers',
  'giant',
  'musketeer',
  'minions',
  'fireball',
  'arrows',
  'cannon',
]

export const DEFAULT_ENEMY_DECK = [
  'goblins',
  'bomber',
  'baby-dragon',
  'valkyrie',
  'hog-rider',
  'zap',
  'archers',
  'knight',
]
