import { Match, type MatchOptions } from '../src/core/Match'
import { ALL_CARDS } from '../src/core/data/cards'
import type { Team } from '../src/core/data/arena'
import type { Entity } from '../src/core/types'
import type { Vec2 } from '../src/core/math'

export const PLAYER_DECK = [
  'knight',
  'archers',
  'giant',
  'musketeer',
  'minions',
  'fireball',
  'arrows',
  'cannon',
]

export const ENEMY_DECK = [
  'goblins',
  'knight',
  'giant',
  'musketeer',
  'minions',
  'fireball',
  'arrows',
  'cannon',
]

export function makeMatch(options: MatchOptions = {}): Match {
  return new Match({
    playerDeck: PLAYER_DECK,
    enemyDeck: ENEMY_DECK,
    aiEnabled: false,
    ...options,
  })
}

/** 测试场景直造实体（绕过部署校验，便于构造任意局面） */
export function spawnTestUnit(match: Match, cardId: string, team: Team, pos: Vec2): Entity {
  const def = ALL_CARDS[cardId]
  if (!def || !def.combat) throw new Error(`无效卡牌：${cardId}`)
  const c = def.combat
  return match.world.spawn({
    kind: def.type === 'building' ? 'building' : 'unit',
    team,
    cardId,
    pos: { x: pos.x, y: pos.y },
    layer: def.layer,
    radius: def.radius,
    mass: def.mass,
    hp: def.hp ?? 0,
    maxHp: def.hp ?? 0,
    state: 'idle',
    removed: false,
    speed: def.speed,
    jumpRiver: def.jumpRiver,
    combat: { ...c },
    targetId: null,
    attackTimer: Math.max(c.hitSpeed - c.loadTime, 0),
    stunTimer: 0,
    deployTimer: 0,
    lifetime: def.lifetime,
    projectile: null,
  })
}

export function findUnit(match: Match, cardId: string, team?: Team): Entity {
  const entity = match.world.entities.find(
    (e) => e.cardId === cardId && (!team || e.team === team),
  )
  if (!entity) throw new Error(`未找到单位：${cardId}`)
  return entity
}

export function findTower(
  match: Match,
  team: Team,
  kind: 'princess' | 'king',
  side?: 'left' | 'right',
): Entity {
  const entity = match.world.entities.find(
    (e) =>
      e.kind === 'tower' &&
      e.team === team &&
      e.towerKind === kind &&
      (!side || (side === 'left' ? e.pos.x < 9 : e.pos.x > 9)),
  )
  if (!entity) throw new Error(`未找到塔：${team} ${kind}`)
  return entity
}

export function simulate(match: Match, seconds: number, onTick?: (m: Match) => void): void {
  const ticks = Math.round(seconds * 60)
  for (let i = 0; i < ticks; i++) {
    if (match.state.winner !== null) return
    match.step(1 / 60)
    onTick?.(match)
  }
}
