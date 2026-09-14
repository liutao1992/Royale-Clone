import type { System, World } from '../World'
import { inAttackRange } from './MovementSystem'
import { applyAreaDamage, applyDamage } from '../damage'
import { spawnProjectile } from './ProjectileSystem'
import type { Entity } from '../types'

/**
 * 攻击系统：
 * - 冷却推进：移动中最多预装填至「首攻」等待值；站定攻击时推进到命中
 * - 近战在命中时刻立即结算；远程生成投射物
 * - 溅射攻击（Valkyrie / Bomber / Baby Dragon）按区域结算
 */
export class CombatSystem implements System {
  readonly name = 'combat'

  step(world: World, dt: number): void {
    for (const e of world.entities) {
      if (e.removed || !e.combat || e.kind === 'projectile') continue
      if (e.state === 'deploying') continue
      if (e.towerKind === 'king' && !world.match.teams[e.team].kingActivated) continue

      if (e.stunTimer > 0) {
        e.stunTimer = Math.max(0, e.stunTimer - dt)
        e.state = 'idle'
        continue
      }

      const target = e.targetId !== null ? world.byId(e.targetId) : undefined
      const inRange = target ? inAttackRange(e, target) : false

      const firstHitWait = Math.max(e.combat.hitSpeed - e.combat.loadTime, 0)
      const floor = e.speed > 0 && !inRange ? firstHitWait : 0
      e.attackTimer = Math.max(e.attackTimer - dt, floor)

      if (inRange && target && e.attackTimer <= 0) {
        performAttack(world, e, target)
        e.attackTimer = e.combat.hitSpeed
      }

      e.state = inRange && target ? 'attacking' : target ? 'moving' : 'idle'
    }
  }
}

function performAttack(world: World, attacker: Entity, target: Entity): void {
  const c = attacker.combat
  if (!c) return

  if (c.projectileSpeed > 0) {
    spawnProjectile(world, {
      team: attacker.team,
      cardId: attacker.cardId,
      from: attacker.pos,
      targetId: target.id,
      targetPos: target.pos,
      speed: c.projectileSpeed,
      damage: c.damage,
      areaRadius: c.areaRadius,
    })
    return
  }

  if (c.areaRadius > 0) {
    applyAreaDamage(world, {
      team: attacker.team,
      targets: c.targets,
      center: { x: target.pos.x, y: target.pos.y },
      radius: c.areaRadius,
      damage: c.damage,
      towerDamage: 0,
    })
    return
  }

  applyDamage(world, target, c.damage)
}
