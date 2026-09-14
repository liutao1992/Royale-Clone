import type { System, World } from '../World'

const TEAMS = ['player', 'enemy'] as const

/** 圣水：1 / 2.8s；双倍 1 / 1.4s；加时与决胜 1 / 0.933s */
export class ElixirSystem implements System {
  readonly name = 'elixir'

  step(world: World, dt: number): void {
    const m = world.match
    if (m.winner !== null) return

    const rate =
      m.phase === 'overtime' || m.phase === 'tiebreaker'
        ? 1 / 0.933
        : m.phase === 'double'
          ? 1 / 1.4
          : 1 / 2.8

    for (const team of TEAMS) {
      const ts = m.teams[team]
      ts.elixir = Math.min(10, ts.elixir + rate * dt)
    }
  }
}
