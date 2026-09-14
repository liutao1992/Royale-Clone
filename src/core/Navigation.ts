import { RIVER, BRIDGES, ARENA_WIDTH, ARENA_LENGTH } from './data/arena'
import type { Vec2 } from './math'
import { clamp, dist } from './math'

const RIVER_MID = (RIVER.y0 + RIVER.y1) / 2

export function isInRiver(pos: Vec2): boolean {
  return pos.y > RIVER.y0 && pos.y < RIVER.y1
}

export function isOnBridge(pos: Vec2): boolean {
  if (!isInRiver(pos)) return false
  return BRIDGES.some((b) => pos.x >= b.x0 && pos.x <= b.x1)
}

function sideOf(y: number): 'south' | 'north' | 'river' {
  if (y < RIVER.y0) return 'south'
  if (y > RIVER.y1) return 'north'
  return 'river'
}

function nearestBridge(x: number) {
  return Math.abs(x - BRIDGES[0].centerX) <= Math.abs(x - BRIDGES[1].centerX) ? BRIDGES[0] : BRIDGES[1]
}

function nearBridgeCrossing(pos: Vec2): boolean {
  if (Math.abs(pos.y - RIVER_MID) > 2.2) return false
  return BRIDGES.some((b) => pos.x >= b.x0 - 0.6 && pos.x <= b.x1 + 0.6)
}

function chooseBridge(from: Vec2, to: Vec2) {
  let best: (typeof BRIDGES)[number] = BRIDGES[0]
  let bestCost = Infinity
  for (const b of BRIDGES) {
    const entryY = from.y < RIVER.y0 ? RIVER.y0 - 0.6 : RIVER.y1 + 0.6
    const exitY = to.y < RIVER.y0 ? RIVER.y0 : RIVER.y1
    const cost = dist(from, { x: b.centerX, y: entryY }) + dist({ x: b.centerX, y: exitY }, to)
    if (cost < bestCost) {
      bestCost = cost
      best = b
    }
  }
  return best
}

/**
 * 计算单位当前应朝哪个点移动（处理过河与桥选择）。
 * jumpRiver 单位（Hog Rider）直线前往。
 */
export function steeringTarget(from: Vec2, to: Vec2, jumpRiver: boolean): Vec2 {
  if (jumpRiver) return to

  const fromSide = sideOf(from.y)
  const toSide = sideOf(to.y)
  if (fromSide === toSide && fromSide !== 'river') return to

  const bridge = nearBridgeCrossing(from) ? nearestBridge(from.x) : chooseBridge(from, to)
  const exitY = toSide === 'north' ? RIVER.y1 + 0.6 : RIVER.y0 - 0.6

  if (fromSide === 'river' || nearBridgeCrossing(from)) {
    return { x: bridge.centerX, y: exitY }
  }

  // 尚未靠近桥：先走向桥入口
  const entryY = fromSide === 'south' ? RIVER.y0 - 0.6 : RIVER.y1 + 0.6
  return { x: bridge.centerX, y: entryY }
}

/** 地面单位的位置硬约束：不可处于河里（桥面除外） */
export function clampToLegalGround(pos: Vec2): Vec2 {
  if (!isInRiver(pos) || isOnBridge(pos)) return pos

  const b = nearestBridge(pos.x)
  const nearBridgeX = pos.x > b.x0 - 2 && pos.x < b.x1 + 2
  if (nearBridgeX) {
    return { x: clamp(pos.x, b.x0 + 0.15, b.x1 - 0.15), y: pos.y }
  }
  const y = pos.y < RIVER_MID ? RIVER.y0 - 0.05 : RIVER.y1 + 0.05
  return { x: pos.x, y }
}

export function clampToArena(pos: Vec2, radius: number): Vec2 {
  return {
    x: clamp(pos.x, radius, ARENA_WIDTH - radius),
    y: clamp(pos.y, radius, ARENA_LENGTH - radius),
  }
}
