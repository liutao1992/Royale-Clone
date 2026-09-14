import { describe, expect, it } from 'vitest'
import { Match } from '../src/core/Match'
import { makeMatch } from './helpers'

describe('对局与胜负', () => {
  it('AI 完整对局：可跑到结束且状态自洽', () => {
    const match = new Match({ seed: 2026, aiEnabled: true })
    let guard = 0

    while (match.state.winner === null && match.world.time < 360 && guard < 60 * 400) {
      match.step(1 / 60)
      guard++
    }

    expect(match.world.time).toBeGreaterThan(60)
    expect(['player', 'enemy', 'draw', null]).toContain(match.state.winner)
    expect(match.state.events.length).toBeGreaterThan(0)
  })

  it('时间轴：3:00 常规结束、皇冠相同进加时、5:00 后决胜', () => {
    const match = makeMatch()
    match.runFor(300.2)
    expect(match.state.phase).toBe('tiebreaker')
  })

  it('常规时间结束皇冠领先即获胜', () => {
    const match = makeMatch()
    match.state.teams.player.crowns = 1
    match.runFor(180.5)
    expect(match.state.winner).toBe('player')
  })

  it('加时结束无人破塔进入决胜并分出结果', () => {
    const match = makeMatch()
    match.runFor(360)
    expect(match.state.winner).not.toBeNull()
  })
})
