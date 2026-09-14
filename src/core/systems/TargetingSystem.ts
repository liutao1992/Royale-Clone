import type { Entity } from '../types'
import type { System, World } from '../World'
import { dist } from '../math'

/** 目标脱离视野的额外容忍距离（leash）——待校准 #7 */
const LEASH_MARGIN = 2

/**
 * 索敌系统：
 * - 锁定后不主动切换目标（仅死亡/超视野/无效时重索敌）
 * - 建筑目标单位只锁建筑/塔
 * - 国王塔未激活时不索敌
 */
export class TargetingSystem implements System {
  readonly name = 'targeting'

  step(world: World, _dt: number): void {
    for (const e of world.entities) {
      if (e.removed || !e.combat || e.kind === 'projectile') continue
      if (e.state === 'deploying' || e.stunTimer > 0) continue

      if (e.towerKind === 'king' && !world.match.teams[e.team].kingActivated) {
        e.targetId = null
        continue
      }

      if (e.targetId !== null) {
        const current = world.byId(e.targetId)
        const lost =
          !current ||
          !isValidTarget(e, current) ||
          dist(e.pos, current.pos) > e.combat.sightRange + LEASH_MARGIN
        if (lost) e.targetId = null
      }

      if (e.targetId === null) {
        const found = findNearestTarget(world, e)
        e.targetId = found ? found.id : null
      }
    }
  }
}

export function isValidTarget(attacker: Entity, candidate: Entity): boolean {
  if (candidate.removed) return false
  if (candidate.team === attacker.team) return false
  if (candidate.kind === 'projectile') return false
  const c = attacker.combat
  if (!c) return false
  if (c.targetType === 'buildings' && candidate.kind === 'unit') return false
  if (c.targets === 'ground' && candidate.layer !== 'ground') return false
  if (c.targets === 'air' && candidate.layer !== 'air') return false
  return true
}

function findNearestTarget(world: World, attacker: Entity): Entity | null {
  const c = attacker.combat
  if (!c) return null

  let best: Entity | null = null
  let bestDist = Infinity
  for (const candidate of world.entities) {
    if (!isValidTarget(attacker, candidate)) continue
    const d = dist(attacker.pos, candidate.pos)
    if (d > c.sightRange) continue
    if (d < bestDist) {
      bestDist = d
      best = candidate
    }
  }
  return best
}
