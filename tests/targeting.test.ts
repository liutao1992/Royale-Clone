import { describe, expect, it } from 'vitest'
import { applyDamage } from '../src/core/damage'
import { findTower, makeMatch, simulate, spawnTestUnit } from './helpers'

describe('索敌与仇恨', () => {
  it('锁定视野内最近敌人', () => {
    const match = makeMatch()
    const knight = spawnTestUnit(match, 'knight', 'player', { x: 9, y: 12 })
    const goblin = spawnTestUnit(match, 'goblins', 'enemy', { x: 9, y: 14 })

    simulate(match, 0.2)
    expect(knight.targetId).toBe(goblin.id)
  })

  it('锁定后不因更近的新敌人切换目标', () => {
    const match = makeMatch()
    const knight = spawnTestUnit(match, 'knight', 'player', { x: 9, y: 12 })
    const first = spawnTestUnit(match, 'goblins', 'enemy', { x: 9, y: 14 })

    simulate(match, 0.2)
    expect(knight.targetId).toBe(first.id)

    spawnTestUnit(match, 'goblins', 'enemy', { x: 9.3, y: 12.8 })
    simulate(match, 0.2)
    expect(knight.targetId).toBe(first.id)
  })

  it('目标死亡后重新索敌', () => {
    const match = makeMatch()
    const knight = spawnTestUnit(match, 'knight', 'player', { x: 9, y: 12 })
    const first = spawnTestUnit(match, 'goblins', 'enemy', { x: 9, y: 14 })

    simulate(match, 0.2)
    applyDamage(match.world, first, 99999)

    const second = spawnTestUnit(match, 'goblins', 'enemy', { x: 8, y: 14 })
    simulate(match, 0.2)
    expect(knight.targetId).toBe(second.id)
  })

  it('建筑目标单位只锁建筑（无视近旁部队）', () => {
    const match = makeMatch()
    const giant = spawnTestUnit(match, 'giant', 'player', { x: 3.5, y: 19 })
    spawnTestUnit(match, 'knight', 'enemy', { x: 3.5, y: 20.5 })

    simulate(match, 0.5)
    const target = match.world.byId(giant.targetId!)
    expect(target?.kind).toBe('tower')
  })

  it('目标脱离视野（超出 leash）后重新索敌', () => {
    const match = makeMatch()
    const knight = spawnTestUnit(match, 'knight', 'player', { x: 9, y: 12 })
    const runner = spawnTestUnit(match, 'goblins', 'enemy', { x: 9, y: 14 })

    simulate(match, 0.2)
    expect(knight.targetId).toBe(runner.id)

    // 远处另有一个目标，把原目标瞬移出视野
    const far = spawnTestUnit(match, 'goblins', 'enemy', { x: 4, y: 13 })
    runner.pos.x = 17
    runner.pos.y = 14
    simulate(match, 0.1)
    expect(knight.targetId).toBe(far.id)
  })

  it('公主塔锁定射程内最近单位；国王塔休眠时不索敌', () => {
    const match = makeMatch()
    const tower = findTower(match, 'player', 'princess', 'left')
    const near = spawnTestUnit(match, 'knight', 'enemy', { x: 3.5, y: 13 })
    spawnTestUnit(match, 'knight', 'enemy', { x: 10, y: 10 })

    simulate(match, 0.2)
    expect(tower.targetId).toBe(near.id)

    const king = findTower(match, 'player', 'king')
    const intruder = spawnTestUnit(match, 'knight', 'enemy', { x: 9, y: 0.8 })
    simulate(match, 0.2)
    expect(king.targetId).toBeNull()
    expect(king.activated).toBe(false)
    expect(intruder.hp).toBe(intruder.maxHp)
  })
})
