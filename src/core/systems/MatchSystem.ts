import type { MatchPhase } from '../types'
import type { System, World } from '../World'
import { applyDamage } from '../damage'

export function phaseAt(elapsed: number): MatchPhase {
  if (elapsed < 120) return 'normal'
  if (elapsed < 180) return 'double'
  if (elapsed < 300) return 'overtime'
  return 'tiebreaker'
}

export function formatTime(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

/** 时间轴：常规 3:00（最后 1 分钟双倍）→ 加时 2:00（三倍、先破塔胜）→ 决胜对耗 */
export class MatchSystem implements System {
  readonly name = 'match'

  step(world: World, dt: number): void {
    const m = world.match
    if (m.winner !== null) return

    m.elapsed += dt
    const prev = m.phase
    const next = phaseAt(m.elapsed)

    if (next !== prev && next !== 'finished') {
      m.phase = next
      world.emit('phase', `阶段切换 ${prev} → ${next}（${formatTime(m.elapsed)}）`)

      if (next === 'overtime') {
        const p = m.teams.player.crowns
        const e = m.teams.enemy.crowns
        if (p !== e) {
          world.endMatch(p > e ? 'player' : 'enemy', '常规时间结束（皇冠领先）')
        }
      }

      if (next === 'tiebreaker') {
        for (const entity of world.entities) {
          if (entity.kind === 'unit' || entity.kind === 'building') entity.removed = true
        }
        world.emit('tiebreaker', '决胜阶段：部队退场，塔开始快速对耗')
      }
    }

    if (m.phase === 'tiebreaker') {
      const bleed = 400
      for (const entity of world.entities) {
        if (entity.kind === 'tower' && !entity.removed) {
          applyDamage(world, entity, bleed * dt)
        }
      }
    }
  }
}
