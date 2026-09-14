import type { Entity, MatchState } from './types'

export const TICK_RATE = 60
export const TICK_DT = 1 / TICK_RATE

export interface System {
  name: string
  step(world: World, dt: number): void
}

/**
 * 世界容器：实体注册表 + 固定 60Hz tick + 系统调度。
 * 纯逻辑层，不依赖 Three.js（可无头运行与测试）。
 */
export class World {
  tick = 0
  time = 0
  entities: Entity[] = []
  readonly match: MatchState

  private nextId = 1
  private readonly systems: System[] = []
  private readonly entityById = new Map<number, Entity>()
  private accumulator = 0

  constructor(match: MatchState) {
    this.match = match
  }

  register(system: System): void {
    this.systems.push(system)
  }

  spawn(spec: Omit<Entity, 'id'>): Entity {
    const entity: Entity = { ...spec, id: this.nextId++ }
    this.entities.push(entity)
    this.entityById.set(entity.id, entity)
    return entity
  }

  byId(id: number): Entity | undefined {
    return this.entityById.get(id)
  }

  emit(type: string, message: string): void {
    this.match.events.push({ time: this.time, type, message })
  }

  endMatch(winner: 'player' | 'enemy' | 'draw', reason: string): void {
    if (this.match.winner !== null) return
    this.match.winner = winner
    this.match.phase = 'finished'
    const label = winner === 'draw' ? '平局' : winner === 'player' ? '玩家获胜' : '敌方获胜'
    this.emit('end', `对局结束：${label}（${reason}）`)
  }

  /** 按渲染帧步进（内部固定 tick，兼容可变帧率） */
  step(dt: number): void {
    this.accumulator += dt
    while (this.accumulator >= TICK_DT) {
      this.tickOnce(TICK_DT)
      this.accumulator -= TICK_DT
    }
  }

  /** 无头模式：直接推进指定秒数 */
  runSeconds(seconds: number): void {
    const ticks = Math.round(seconds / TICK_DT)
    for (let i = 0; i < ticks; i++) this.tickOnce(TICK_DT)
  }

  private tickOnce(dt: number): void {
    this.time += dt
    this.tick += 1
    for (const system of this.systems) system.step(this, dt)
    this.cleanup()
  }

  private cleanup(): void {
    if (!this.entities.some((e) => e.removed)) return
    const alive: Entity[] = []
    for (const e of this.entities) {
      if (e.removed) this.entityById.delete(e.id)
      else alive.push(e)
    }
    this.entities = alive
  }
}
