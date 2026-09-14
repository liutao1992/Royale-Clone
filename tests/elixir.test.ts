import { describe, expect, it } from 'vitest'
import { makeMatch } from './helpers'

describe('圣水系统', () => {
  it('开局 5 点、基础速率 1/2.8s', () => {
    const match = makeMatch()
    expect(match.state.teams.player.elixir).toBe(5)

    match.state.teams.player.elixir = 0
    match.runFor(2.8)
    expect(match.state.teams.player.elixir).toBeCloseTo(1, 1)

    match.state.teams.player.elixir = 0
    match.runFor(5.6)
    expect(match.state.teams.player.elixir).toBeCloseTo(2, 1)
  })

  it('上限 10', () => {
    const match = makeMatch()
    match.runFor(60)
    expect(match.state.teams.player.elixir).toBe(10)
    expect(match.state.teams.enemy.elixir).toBe(10)
  })

  it('2:00 后进入双倍速率（1/1.4s）', () => {
    const match = makeMatch()
    match.runFor(120.1)
    expect(match.state.phase).toBe('double')

    match.state.teams.player.elixir = 0
    match.runFor(1.4)
    expect(match.state.teams.player.elixir).toBeCloseTo(1, 1)
  })

  it('加时阶段三倍速率（约 1/0.933s）', () => {
    const match = makeMatch()
    match.runFor(180.1)
    expect(match.state.phase).toBe('overtime')

    match.state.teams.player.elixir = 0
    match.runFor(0.94)
    expect(match.state.teams.player.elixir).toBeCloseTo(1, 1)
  })
})
