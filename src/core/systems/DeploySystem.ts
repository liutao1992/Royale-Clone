import type { Entity } from '../types'
import type { System, World } from '../World'
import type { Team } from '../data/arena'
import { ARENA_LENGTH, ARENA_WIDTH, RIVER } from '../data/arena'
import type { Vec2 } from '../math'
import { clamp } from '../math'
import { ALL_CARDS, type CardDef } from '../data/cards'
import { cycleHand } from './CardSystem'
import { applyAreaDamage } from '../damage'
import { applyCrowdControlArea, spawnProjectile } from './ProjectileSystem'

/** 破塔后对方半场可部署纵深（pocket）——待校准 #10 */
const POCKET_DEPTH = 5

/**
 * 部署系统：
 * - request() 为玩家/AI 的统一部署入口（校验 → 扣费 → 卡牌循环 → 生成实体/结算法术）
 * - step() 推进部署计时
 */
export class DeploySystem implements System {
  readonly name = 'deploy'

  step(world: World, dt: number): void {
    for (const e of world.entities) {
      if (e.removed || e.state !== 'deploying') continue
      e.deployTimer -= dt
      if (e.deployTimer <= 0) {
        e.deployTimer = 0
        e.state = 'idle'
      }
    }
  }

  request(world: World, team: Team, handIndex: number, pos: Vec2): boolean {
    const m = world.match
    if (m.winner !== null) return false

    const ts = m.teams[team]
    const cardId = ts.hand[handIndex]
    if (!cardId) return false
    const def = ALL_CARDS[cardId]
    if (!def) return false
    if (ts.elixir < def.cost) return false
    if (!isDeployAllowed(world, team, def, pos)) return false

    ts.elixir -= def.cost
    cycleHand(ts, handIndex)
    world.emit(
      'deploy',
      `${team} 部署 ${def.name} @ (${pos.x.toFixed(1)}, ${pos.y.toFixed(1)})`,
    )

    if (def.type === 'spell') {
      castSpell(world, team, def, pos)
    } else {
      spawnTroops(world, team, def, pos)
    }
    return true
  }
}

export function isDeployAllowed(world: World, team: Team, def: CardDef, pos: Vec2): boolean {
  if (pos.x < 0.3 || pos.x > ARENA_WIDTH - 0.3) return false
  if (pos.y < 0.3 || pos.y > ARENA_LENGTH - 0.3) return false

  // 法术可放置于全场任意位置（含河道上空）
  if (def.type === 'spell') return true

  const ownHalf = team === 'player' ? pos.y < RIVER.y0 : pos.y > RIVER.y1
  if (ownHalf) return !blockedByStructure(world, pos)

  // 对方半场：仅已解锁通道的 pocket 区域
  const lane = pos.x < ARENA_WIDTH / 2 ? 'left' : 'right'
  if (!world.match.teams[team].unlockedLanes[lane]) return false

  const inPocket =
    team === 'player'
      ? pos.y >= RIVER.y1 && pos.y <= RIVER.y1 + POCKET_DEPTH
      : pos.y <= RIVER.y0 && pos.y >= RIVER.y0 - POCKET_DEPTH
  const inLane = lane === 'left' ? pos.x < ARENA_WIDTH / 2 : pos.x >= ARENA_WIDTH / 2
  return inPocket && inLane && !blockedByStructure(world, pos)
}

function blockedByStructure(world: World, pos: Vec2): boolean {
  for (const e of world.entities) {
    if (e.removed) continue
    if (e.kind !== 'tower' && e.kind !== 'building') continue
    const half = e.kind === 'tower' ? (e.towerKind === 'king' ? 2 : 1.5) : e.radius + 0.3
    if (Math.abs(pos.x - e.pos.x) < half + 0.3 && Math.abs(pos.y - e.pos.y) < half + 0.3) {
      return true
    }
  }
  return false
}

function spawnTroops(world: World, team: Team, def: CardDef, pos: Vec2): void {
  const c = def.combat
  if (!c) return
  const offsets = def.spawnOffsets.length > 0 ? def.spawnOffsets : [{ x: 0, y: 0 }]

  for (let i = 0; i < def.count; i++) {
    const offset = offsets[i % offsets.length]
    const spawnPos: Vec2 = {
      x: clamp(pos.x + offset.x, 0.3, ARENA_WIDTH - 0.3),
      y: clamp(pos.y + (team === 'player' ? offset.y : -offset.y), 0.3, ARENA_LENGTH - 0.3),
    }

    const entity: Omit<Entity, 'id'> = {
      kind: def.type === 'building' ? 'building' : 'unit',
      team,
      cardId: def.id,
      pos: spawnPos,
      layer: def.layer,
      radius: def.radius,
      mass: def.mass,
      hp: def.hp ?? 0,
      maxHp: def.hp ?? 0,
      state: 'deploying',
      removed: false,
      speed: def.speed,
      jumpRiver: def.jumpRiver,
      combat: { ...c },
      targetId: null,
      // 部署即完成预装填：首次攻击等待 = hitSpeed - loadTime
      attackTimer: Math.max(c.hitSpeed - c.loadTime, 0),
      stunTimer: 0,
      deployTimer: def.deployTime,
      lifetime: def.lifetime,
      projectile: null,
    }
    world.spawn(entity)
  }
}

function castSpell(world: World, team: Team, def: CardDef, pos: Vec2): void {
  const sp = def.spell
  if (!sp) return

  if (sp.projectileSpeed <= 0) {
    // 瞬发法术（Zap）
    applyAreaDamage(world, {
      team,
      targets: 'both',
      center: pos,
      radius: sp.radius,
      damage: sp.damage,
      towerDamage: sp.towerDamage,
    })
    applyCrowdControlArea(world, {
      team,
      center: pos,
      radius: sp.radius,
      stun: sp.stun,
      knockback: sp.knockback,
    })
    return
  }

  // 有弹道的法术：按波次生成（Fireball 1 波 / Arrows 3 波），delay 模拟落地时间
  for (let i = 0; i < sp.waves; i++) {
    spawnProjectile(world, {
      team,
      cardId: def.id,
      from: pos,
      targetPos: pos,
      speed: sp.projectileSpeed,
      damage: sp.damage,
      areaRadius: sp.radius,
      towerDamage: sp.towerDamage,
      delay: sp.firstDelay + i * sp.waveInterval,
      stun: sp.stun,
      knockback: sp.knockback,
    })
  }
}
