import type { System, World } from '../core/World'
import type { Entity } from '../core/types'
import type { Team } from '../core/data/arena'
import { ARENA_WIDTH, RIVER } from '../core/data/arena'
import { ALL_CARDS, type CardDef } from '../core/data/cards'
import type { DeploySystem } from '../core/systems/DeploySystem'
import type { Vec2 } from '../core/math'
import { clamp, dist } from '../core/math'

interface ThreatInfo {
  entity: Entity
  distanceToGoal: number
  dps: number
}

interface Play {
  handIndex: number
  pos: Vec2
}

interface SupportPlan {
  cardId: string
  pos: Vec2
  ticks: number
}

/**
 * 规则型战斗 AI：
 * 1) 威胁识别：追踪进入我方半场的敌方部队，按距塔距离排序
 * 2) 法术响应：集群 >= 3 个敌方单位时使用范围法术
 * 3) 防守响应：按层级匹配 + DPS/费效比评分选择最优防守卡，落点拦截
 * 4) 进攻：无威胁且圣水充足时发动推进（优先建筑目标单位）
 */
export class BattleAI implements System {
  readonly name = 'ai'

  private thinkTimer = 0.4
  private supportPlan: SupportPlan | null = null
  private readonly rng: () => number

  constructor(
    private readonly team: Team,
    private readonly deploy: DeploySystem,
    seed: number,
    private readonly reactionTime = 0.55,
  ) {
    this.rng = mulberry32(seed)
  }

  step(world: World, dt: number): void {
    if (world.match.winner !== null) return

    this.thinkTimer -= dt
    if (this.thinkTimer > 0) return
    this.thinkTimer = this.reactionTime * (0.75 + this.rng() * 0.5)

    const state = world.match
    const ts = state.teams[this.team]
    const threats = this.collectThreats(world)

    // 1) 集群法术
    if (threats.length >= 2) {
      const spell = this.findSpellPlay(ts, threats)
      if (spell) {
        this.deploy.request(world, this.team, spell.handIndex, spell.pos)
        return
      }
    }

    // 2) 防守
    if (threats.length > 0) {
      this.supportPlan = null
      const defense = this.findDefense(world, ts, threats)
      if (defense) {
        this.deploy.request(world, this.team, defense.handIndex, defense.pos)
      }
      return
    }

    // 已排入支援计划：等待执行完毕
    if (this.tickSupportPlan(world, ts)) return

    // 3) 进攻（己方已有单位在敌方半场时持续投入；对方圣水空窗期也出击）
    const pushing = this.isPushing(world)
    const foe = state.teams[this.team === 'player' ? 'enemy' : 'player']
    const window = foe.elixir < 3
    if (ts.elixir >= this.attackThreshold(state.phase, pushing || window)) {
      const attack = this.findAttack(ts)
      if (attack) {
        this.deploy.request(world, this.team, attack.handIndex, attack.pos)
        this.planSupport(ts, attack)
      }
    }
  }

  /** 执行支援计划；返回 true 表示本 tick 已处理（无论是否实际出兵） */
  private tickSupportPlan(world: World, ts: { hand: string[]; elixir: number }): boolean {
    if (!this.supportPlan) return false
    this.supportPlan.ticks -= 1
    if (this.supportPlan.ticks > 0) return true

    const plan = this.supportPlan
    this.supportPlan = null
    const index = ts.hand.indexOf(plan.cardId)
    if (index < 0) return true
    const def = ALL_CARDS[plan.cardId]
    if (!def || def.cost > ts.elixir) return true
    this.deploy.request(world, this.team, index, plan.pos)
    return true
  }

  /** 圣水富裕时安排一张同路支援卡，形成二卡推进 */
  private planSupport(ts: { hand: string[]; elixir: number }, attack: Play): void {
    const played = ALL_CARDS[ts.hand[attack.handIndex]]
    const remaining = ts.elixir - (played?.cost ?? 0)
    if (remaining < 4) return

    for (let i = 0; i < ts.hand.length; i++) {
      if (i === attack.handIndex) continue
      const def = ALL_CARDS[ts.hand[i]]
      if (!def || def.type !== 'troop' || !def.combat) continue
      if (def.cost > remaining) continue
      this.supportPlan = {
        cardId: def.id,
        pos: { x: attack.pos.x, y: attack.pos.y },
        ticks: 1,
      }
      return
    }
  }

  private isPushing(world: World): boolean {
    for (const e of world.entities) {
      if (e.removed || e.kind !== 'unit' || e.team !== this.team) continue
      const acrossRiver = this.team === 'player' ? e.pos.y > RIVER.y1 : e.pos.y < RIVER.y0
      if (acrossRiver) return true
    }
    return false
  }

  // ---------- 威胁 ----------

  private collectThreats(world: World): ThreatInfo[] {
    const myTowers = world.entities.filter(
      (e) => e.kind === 'tower' && e.team === this.team && !e.removed,
    )
    const threats: ThreatInfo[] = []

    for (const e of world.entities) {
      if (e.removed || e.kind !== 'unit' || e.team === this.team) continue
      // 威胁 = 已越过河（含河道）逼近我方半场的单位
      const approaching =
        this.team === 'player' ? e.pos.y < RIVER.y1 : e.pos.y > RIVER.y0
      if (!approaching) continue

      let nearest = Infinity
      for (const tower of myTowers) nearest = Math.min(nearest, dist(e.pos, tower.pos))
      const dps = e.combat ? e.combat.damage / e.combat.hitSpeed : 0
      threats.push({ entity: e, distanceToGoal: nearest, dps })
    }

    threats.sort((a, b) => a.distanceToGoal - b.distanceToGoal)
    return threats
  }

  // ---------- 法术 ----------

  private findSpellPlay(
    ts: { hand: string[]; elixir: number },
    threats: ThreatInfo[],
  ): Play | null {
    const spellSlots: number[] = []
    for (let i = 0; i < ts.hand.length; i++) {
      const def = ALL_CARDS[ts.hand[i]]
      if (def?.type === 'spell' && def.cost <= ts.elixir) spellSlots.push(i)
    }
    if (spellSlots.length === 0) return null

    let best: { center: Vec2; count: number; hp: number } | null = null
    for (const anchor of threats) {
      let count = 0
      let hp = 0
      let sx = 0
      let sy = 0
      for (const other of threats) {
        if (dist(anchor.entity.pos, other.entity.pos) <= 2.4) {
          count += 1
          hp += other.entity.hp
          sx += other.entity.pos.x
          sy += other.entity.pos.y
        }
      }
      if (!best || count > best.count || (count === best.count && hp > best.hp)) {
        best = { center: { x: sx / count, y: sy / count }, count, hp }
      }
    }

    if (!best || best.count < 3 || best.hp < 350) return null
    return { handIndex: spellSlots[0], pos: best.center }
  }

  // ---------- 防守 ----------

  private findDefense(world: World, ts: { hand: string[]; elixir: number }, threats: ThreatInfo[]): Play | null {
    const target = threats[0].entity
    let best: { play: Play; score: number } | null = null

    for (let i = 0; i < ts.hand.length; i++) {
      const def = ALL_CARDS[ts.hand[i]]
      if (!def || def.cost > ts.elixir) continue
      if (def.type === 'spell' || !def.combat) continue

      let score: number
      let pos: Vec2
      if (def.type === 'building') {
        // 建筑防守：固定 4-3 拉扯位
        score = 55
        pos = this.buildingDefenseSpot()
      } else {
        score = scoreDefender(def, target)
        if (score <= 0) continue
        pos = this.interceptPoint(world, target)
      }

      if (!best || score > best.score) {
        best = { play: { handIndex: i, pos }, score }
      }
    }

    return best?.play ?? null
  }

  private buildingDefenseSpot(): Vec2 {
    const y = this.team === 'player' ? RIVER.y0 - 4 : RIVER.y1 + 4
    const x = this.rng() < 0.5 ? 6.5 : 11.5
    return { x, y }
  }

  private interceptPoint(world: World, threat: Entity): Vec2 {
    const myTowers = world.entities.filter(
      (e) => e.kind === 'tower' && e.team === this.team && !e.removed,
    )
    let nearest: Entity | null = null
    let nearestDist = Infinity
    for (const tower of myTowers) {
      const d = dist(threat.pos, tower.pos)
      if (d < nearestDist) {
        nearestDist = d
        nearest = tower
      }
    }

    let pos: Vec2
    if (!nearest || nearestDist < 2.5) {
      pos = { x: threat.pos.x, y: threat.pos.y }
    } else {
      const t = 2.5 / nearestDist
      pos = {
        x: threat.pos.x + (nearest.pos.x - threat.pos.x) * t,
        y: threat.pos.y + (nearest.pos.y - threat.pos.y) * t,
      }
    }

    // 必须落在己方半场的合法部署区
    if (this.team === 'player') pos.y = Math.min(pos.y, RIVER.y0 - 0.8)
    else pos.y = Math.max(pos.y, RIVER.y1 + 0.8)
    pos.x = clamp(pos.x, 1, ARENA_WIDTH - 1)
    return pos
  }

  // ---------- 进攻 ----------

  private findAttack(ts: { hand: string[]; elixir: number }): Play | null {
    let bestSlot = -1
    let bestScore = -Infinity

    for (let i = 0; i < ts.hand.length; i++) {
      const def = ALL_CARDS[ts.hand[i]]
      if (!def || def.cost > ts.elixir) continue
      if (def.type === 'spell' || def.type === 'building' || !def.combat) continue

      let score = (def.combat.damage / def.combat.hitSpeed) * 0.5 - def.cost * 6
      if (def.combat.targetType === 'buildings') score += 120

      if (score > bestScore) {
        bestScore = score
        bestSlot = i
      }
    }

    if (bestSlot < 0) return null

    const laneX = this.rng() < 0.5 ? 3.5 : 14.5
    return {
      handIndex: bestSlot,
      pos: {
        x: laneX + (this.rng() - 0.5) * 1.2,
        y: this.team === 'player' ? 13 : 19,
      },
    }
  }

  private attackThreshold(phase: string, pushing: boolean): number {
    let base: number
    if (phase === 'overtime' || phase === 'tiebreaker') base = 4
    else if (phase === 'double') base = 4.5
    else base = 5.5 + this.rng() * 1.5
    // 持续推进时降低门槛，形成连续压制
    if (pushing) base = Math.min(base, 3.5)
    return base
  }
}

function scoreDefender(def: CardDef, threat: Entity): number {
  const c = def.combat
  if (!c) return -1

  const threatIsAir = threat.layer === 'air'
  if (threatIsAir && c.targets === 'ground') return -1
  if (!threatIsAir && c.targets === 'air') return -1
  if (c.targetType === 'buildings') return -1

  const defDps = c.damage / c.hitSpeed
  let score = defDps

  if (threat.maxHp > 2000) score += defDps * 0.6
  if (threat.maxHp < 400 && threat.radius <= 0.5 && c.areaRadius > 0) score += 120

  return score * 0.5 + (score / Math.max(def.cost, 1)) * 1.5
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
