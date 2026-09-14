import type { Entity } from '../types'
import type { System, World } from '../World'
import type { Vec2 } from '../math'
import { dist } from '../math'
import { clampToArena, clampToLegalGround, steeringTarget } from '../Navigation'

/** 攻击距离判定：中心距 ≤ range + 双方碰撞半径（边缘距离模型）——待校准 #5 */
export function inAttackRange(a: Entity, b: Entity): boolean {
  if (!a.combat) return false
  return dist(a.pos, b.pos) <= a.combat.range + a.radius + b.radius
}

/**
 * 移动系统：
 * - 有锁定目标 → 追击至攻击范围
 * - 无目标 → 朝最近敌方塔/建筑推进（跨河自动选桥）
 * - 圆形碰撞分离（质量加权推挤；塔/建筑不可推）
 */
export class MovementSystem implements System {
  readonly name = 'movement'

  step(world: World, dt: number): void {
    for (const e of world.entities) {
      if (e.removed || e.kind === 'projectile' || e.speed <= 0) continue
      if (e.state === 'deploying' || e.state === 'dying' || e.stunTimer > 0) continue

      const target = e.targetId !== null ? world.byId(e.targetId) : undefined
      let aim: Vec2 | null = null

      if (target) {
        if (!inAttackRange(e, target)) aim = steeringTarget(e.pos, target.pos, e.jumpRiver)
      } else {
        const goal = nearestGoal(world, e)
        if (goal && !inAttackRange(e, goal)) {
          aim = steeringTarget(e.pos, goal.pos, e.jumpRiver)
        }
      }

      if (aim) {
        const d = dist(e.pos, aim)
        if (d > 0.001) {
          const stepLen = Math.min(e.speed * dt, d)
          e.pos.x += ((aim.x - e.pos.x) / d) * stepLen
          e.pos.y += ((aim.y - e.pos.y) / d) * stepLen
        }
      }

      if (e.layer === 'ground' && !e.jumpRiver) e.pos = clampToLegalGround(e.pos)
      e.pos = clampToArena(e.pos, e.radius)
    }

    resolveCollisions(world)
  }
}

function nearestGoal(world: World, entity: Entity): Entity | null {
  let best: Entity | null = null
  let bestDist = Infinity
  for (const candidate of world.entities) {
    if (candidate.removed) continue
    if (candidate.team === entity.team) continue
    if (candidate.kind !== 'tower' && candidate.kind !== 'building') continue
    const d = dist(entity.pos, candidate.pos)
    if (d < bestDist) {
      bestDist = d
      best = candidate
    }
  }
  return best
}

function resolveCollisions(world: World): void {
  const bodies = world.entities.filter(
    (e) => !e.removed && (e.kind === 'unit' || e.kind === 'building' || e.kind === 'tower'),
  )

  for (let i = 0; i < bodies.length; i++) {
    const a = bodies[i]
    for (let j = i + 1; j < bodies.length; j++) {
      const b = bodies[j]
      if (a.state === 'deploying' || b.state === 'deploying') continue
      if (a.layer !== b.layer) continue

      const dx = b.pos.x - a.pos.x
      const dy = b.pos.y - a.pos.y
      const d = Math.hypot(dx, dy)
      const minDist = a.radius + b.radius
      if (d >= minDist) continue

      const nx = d > 0.0001 ? dx / d : 1
      const ny = d > 0.0001 ? dy / d : 0
      const overlap = minDist - d

      const invA = a.mass === Infinity ? 0 : 1 / a.mass
      const invB = b.mass === Infinity ? 0 : 1 / b.mass
      const totalInv = invA + invB
      if (totalInv === 0) continue

      const push = overlap * 0.9
      a.pos.x -= nx * push * (invA / totalInv)
      a.pos.y -= ny * push * (invA / totalInv)
      b.pos.x += nx * push * (invB / totalInv)
      b.pos.y += ny * push * (invB / totalInv)
    }
  }
}
