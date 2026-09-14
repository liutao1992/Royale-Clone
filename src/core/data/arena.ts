/**
 * 竞技场几何常量（依据 docs/MECHANICS.md §1）
 *
 * 坐标系：tile 坐标 (x, y)，(0, 0) 位于玩家侧左下角。
 * x ∈ [0, 18] 从左到右；y ∈ [0, 32] 从玩家底线指向敌方底线。
 * 3D 映射：tile (x, y) → Three.js (x, height, y)。
 */

export const ARENA_WIDTH = 18
export const ARENA_LENGTH = 32

/** 河流：横贯全宽，y ∈ [15, 17]（宽 2 tiles） */
export const RIVER = { y0: 15, y1: 17 } as const

/** 双桥：宽 2 tiles，中心 x = 3.5 / 14.5 */
export const BRIDGES = [
  { x0: 2.5, x1: 4.5, centerX: 3.5 },
  { x0: 13.5, x1: 15.5, centerX: 14.5 },
] as const

export type Team = 'player' | 'enemy'
export type TowerKind = 'princess' | 'king'

export interface TowerSlot {
  id: string
  kind: TowerKind
  team: Team
  x: number
  y: number
}

/** 六座塔位（玩家侧 y 小；敌方侧由 mirrorY 镜像） */
export const TOWER_SLOTS: readonly TowerSlot[] = [
  { id: 'player-princess-left', kind: 'princess', team: 'player', x: 3.5, y: 6.5 },
  { id: 'player-princess-right', kind: 'princess', team: 'player', x: 14.5, y: 6.5 },
  { id: 'player-king', kind: 'king', team: 'player', x: 9, y: 3 },
  { id: 'enemy-princess-left', kind: 'princess', team: 'enemy', x: 3.5, y: mirrorY(6.5) },
  { id: 'enemy-princess-right', kind: 'princess', team: 'enemy', x: 14.5, y: mirrorY(6.5) },
  { id: 'enemy-king', kind: 'king', team: 'enemy', x: 9, y: mirrorY(3) },
]

export const TEAM_COLORS: Record<Team, number> = {
  player: 0x3d8bfd,
  enemy: 0xe0454f,
}

export function mirrorY(y: number): number {
  return ARENA_LENGTH - y
}
