import { describe, expect, it } from 'vitest'
import { applyDamage } from '../src/core/damage'
import { findTower, makeMatch, simulate, spawnTestUnit } from './helpers'

describe('塔系统', () => {
  it('公主塔攻击射程内敌人', () => {
    const match = makeMatch()
    const intruder = spawnTestUnit(match, 'knight', 'enemy', { x: 3.5, y: 12 })

    simulate(match, 1.5)
    expect(intruder.hp).toBeLessThan(intruder.maxHp)
  })

  it('国王塔初始休眠；受到伤害后激活并开始攻击', () => {
    const match = makeMatch()
    const king = findTower(match, 'enemy', 'king')
    expect(match.state.teams.enemy.kingActivated).toBe(false)

    applyDamage(match.world, king, 100)
    expect(match.state.teams.enemy.kingActivated).toBe(true)
    expect(king.hp).toBe(4824 - 100)

    // 国王塔正后方（公主塔射程外）：只有激活的王塔能打到
    const intruder = spawnTestUnit(match, 'knight', 'player', { x: 9, y: 31.5 })
    simulate(match, 1.2)
    expect(intruder.hp).toBeLessThan(intruder.maxHp)
  })

  it('摧毁公主塔：皇冠 +1、激活本方国王塔、解锁对方半场部署', () => {
    const match = makeMatch()
    const tower = findTower(match, 'enemy', 'princess', 'left')

    applyDamage(match.world, tower, 999999)

    expect(match.state.teams.player.crowns).toBe(1)
    expect(match.state.teams.enemy.kingActivated).toBe(true)
    expect(match.state.teams.player.unlockedLanes.left).toBe(true)
    expect(match.state.teams.player.unlockedLanes.right).toBe(false)
  })

  it('破塔后可在对方半场对应通道部署（pocket）', () => {
    const match = makeMatch()
    expect(match.deployCard('player', 0, { x: 3.5, y: 19 })).toBe(false)

    const tower = findTower(match, 'enemy', 'princess', 'left')
    applyDamage(match.world, tower, 999999)

    match.state.teams.player.elixir = 10
    expect(match.deployCard('player', 0, { x: 3.5, y: 19 })).toBe(true)
    // 另一条通道仍未解锁
    match.state.teams.player.elixir = 10
    expect(match.deployCard('player', 0, { x: 14.5, y: 19 })).toBe(false)
  })

  it('摧毁国王塔立即获胜（3 皇冠）', () => {
    const match = makeMatch()
    const king = findTower(match, 'enemy', 'king')
    applyDamage(match.world, king, 999999)

    expect(match.state.winner).toBe('player')
    expect(match.state.teams.player.crowns).toBeGreaterThanOrEqual(3)
  })

  it('加时阶段先破塔立即获胜', () => {
    const match = makeMatch()
    match.runFor(180.1)
    expect(match.state.phase).toBe('overtime')

    const tower = findTower(match, 'enemy', 'princess', 'left')
    applyDamage(match.world, tower, 999999)
    expect(match.state.winner).toBe('player')
  })
})
