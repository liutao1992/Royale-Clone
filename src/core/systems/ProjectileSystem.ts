import type { Entity } from '../types'
import type { System, World } from '../World'
import type { Team } from '../data/arena'
import type { Vec2 } from '../math'
import { dist } from '../math'
import { applyAreaDamage, applyDamage } from '../damage'

export interface ProjectileSpawnSpec {
  team: Team
  cardId: string
  from: Vec2
  targetId?: number | null
  targetPos: Vec2
  /** tiles/s */
  speed: number
  damage: number
  areaRadius?: number
  towerDamage?: number
  /** 落地延迟（模拟弹道/波次） */
  delay?: number
  stun?: number
  knockback?: number
}

export function spawnProjectile(world: World, spec: ProjectileSpawnSpec): Entity {
  return world.spawn({
    kind: 'projectile',
    team: spec.team,
    cardId: spec.cardId,
    pos: { x: spec.from.x, y: spec.from.y },
    layer: 'ground',
    radius: 0.2,
    mass: Infinity,
    hp: 1,
    maxHp: 1,
    state: 'moving',
    removed: false,
    speed: 0,
    jumpRiver: false,
    combat: null,
    targetId: null,
    attackTimer: 0,
    stunTimer: 0,
    deployTimer: 0,
    lifetime: 0,
    projectile: {
      targetId: spec.targetId ?? null,
      targetPos: { x: spec.targetPos.x, y: spec.targetPos.y },
      speed: spec.speed,
      damage: spec.damage,
      areaRadius: spec.areaRadius ?? 0,
      towerDamage: spec.towerDamage ?? 0,
      ownerTeam: spec.team,
      delay: spec.delay ?? 0,
      stun: spec.stun ?? 0,
      knockback: spec.knockback ?? 0,
    },
  })
}

/**
 * 投射物系统：
 * - 追踪目标当前位置飞行；目标消失则飞向最后已知位置并消散（单体不结算）
 * - 命中时结算单体/区域伤害 + 眩晕/击退
 */
export class ProjectileSystem implements System {
  readonly name = 'projectile'

  step(world: World, dt: number): void {
    for (const p of world.entities) {
      if (p.removed || p.kind !== 'projectile' || !p.projectile) continue
      const pd = p.projectile

      if (pd.delay > 0) {
        pd.delay -= dt
        continue
      }

      const target = pd.targetId !== null ? world.byId(pd.targetId) : undefined
      if (target && !target.removed) {
        pd.targetPos = { x: target.pos.x, y: target.pos.y }
      }

      const d = dist(p.pos, pd.targetPos)
      const stepLen = pd.speed * dt
      const hitDist = p.radius + (target && !target.removed ? target.radius : 0.3)

      if (d <= stepLen + hitDist) {
        p.pos = { x: pd.targetPos.x, y: pd.targetPos.y }
        resolveHit(world, p)
        p.removed = true
      } else if (d > 0.0001) {
        p.pos.x += ((pd.targetPos.x - p.pos.x) / d) * stepLen
        p.pos.y += ((pd.targetPos.y - p.pos.y) / d) * stepLen
      }
    }
  }
}

function resolveHit(world: World, projectile: Entity): void {
  const pd = projectile.projectile
  if (!pd) return
  const target = pd.targetId !== null ? world.byId(pd.targetId) : undefined

  if (pd.areaRadius > 0) {
    applyAreaDamage(world, {
      team: pd.ownerTeam,
      targets: 'both',
      center: { x: pd.targetPos.x, y: pd.targetPos.y },
      radius: pd.areaRadius,
      damage: pd.damage,
      towerDamage: pd.towerDamage,
    })
  } else if (target && !target.removed) {
    applyDamage(world, target, pd.damage)
  }

  if (pd.stun > 0 || pd.knockback > 0) {
    applyCrowdControlArea(world, {
      team: pd.ownerTeam,
      center: { x: pd.targetPos.x, y: pd.targetPos.y },
      radius: Math.max(pd.areaRadius, 0.5),
      stun: pd.stun,
      knockback: pd.knockback,
    })
  }
}

export interface CrowdControlOptions {
  team: Team
  center: Vec2
  radius: number
  stun: number
  knockback: number
}

/** 眩晕 + 击退：重置攻击动画并强制重索敌；塔与建筑免疫 */
export function applyCrowdControlArea(world: World, opts: CrowdControlOptions): void {
  if (opts.stun <= 0 && opts.knockback <= 0) return

  for (const e of world.entities) {
    if (e.removed || e.team === opts.team || e.kind === 'projectile') continue
    if (e.kind === 'tower' || e.kind === 'building') continue
    if (dist(e.pos, opts.center) > opts.radius + e.radius) continue

    if (opts.stun > 0) {
      e.stunTimer = Math.max(e.stunTimer, opts.stun)
      e.targetId = null
      if (e.combat) e.attackTimer = e.combat.hitSpeed
    }

    if (opts.knockback > 0) {
      const d = Math.max(dist(e.pos, opts.center), 0.01)
      e.pos.x += ((e.pos.x - opts.center.x) / d) * opts.knockback
      e.pos.y += ((e.pos.y - opts.center.y) / d) * opts.knockback
    }
  }
}
