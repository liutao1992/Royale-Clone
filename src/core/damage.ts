import type { Entity, TargetLayer } from './types'
import type { Team } from './data/arena'
import type { Vec2 } from './math'
import { dist } from './math'
import type { World } from './World'
import { ARENA_WIDTH } from './data/arena'

/** 结算单体伤害；目标死亡时触发摧毁流程 */
export function applyDamage(world: World, target: Entity, damage: number): void {
  if (target.removed) return
  target.hp -= damage

  if (target.kind === 'tower' && target.towerKind === 'king') {
    const ts = world.match.teams[target.team]
    if (!ts.kingActivated) {
      ts.kingActivated = true
      world.emit('king-activate', `${target.team} 国王塔激活`)
    }
  }

  if (target.hp <= 0) destroyEntity(world, target)
}

export interface AreaDamageOptions {
  team: Team
  targets: TargetLayer
  center: Vec2
  radius: number
  damage: number
  /** 对塔的独立伤害；0 = 使用 damage */
  towerDamage: number
}

/** 区域伤害（溅射 / 法术）；按层级过滤，命中含半径外扩 */
export function applyAreaDamage(world: World, opts: AreaDamageOptions): void {
  const hits: Entity[] = []
  for (const e of world.entities) {
    if (e.removed || e.team === opts.team) continue
    if (e.kind === 'projectile') continue
    if (opts.targets === 'ground' && e.layer !== 'ground') continue
    if (opts.targets === 'air' && e.layer !== 'air') continue
    if (dist(e.pos, opts.center) > opts.radius + e.radius) continue
    hits.push(e)
  }
  for (const e of hits) {
    const dmg = e.kind === 'tower' && opts.towerDamage > 0 ? opts.towerDamage : opts.damage
    applyDamage(world, e, dmg)
  }
}

/** 摧毁实体：塔的皇冠/激活/部署区解锁/加时与决胜判定全部在此收口 */
export function destroyEntity(world: World, entity: Entity): void {
  if (entity.removed) return
  entity.removed = true
  entity.hp = 0
  const foe: Team = entity.team === 'player' ? 'enemy' : 'player'

  if (entity.kind === 'tower') {
    if (world.match.phase === 'tiebreaker') {
      world.endMatch(foe, '决胜对耗')
      return
    }
    if (entity.towerKind === 'king') {
      world.match.teams[foe].crowns += 3
      world.endMatch(foe, '国王塔被摧毁')
      return
    }
    world.match.teams[foe].crowns += 1
    world.match.teams[entity.team].kingActivated = true
    const lane = entity.pos.x < ARENA_WIDTH / 2 ? 'left' : 'right'
    world.match.teams[foe].unlockedLanes[lane] = true
    world.emit(
      'crown',
      `${foe} 摧毁 ${lane === 'left' ? '左' : '右'}公主塔（皇冠 ${world.match.teams[foe].crowns}，解锁对方半场部署）`,
    )
    if (world.match.phase === 'overtime') {
      world.endMatch(foe, '加时阶段先破塔')
    }
    return
  }

  world.emit('destroy', `${entity.cardId}(${entity.team}) 阵亡`)
}
