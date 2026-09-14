import { describe, expect, it } from 'vitest'
import { makeMatch, simulate, spawnTestUnit } from './helpers'

describe('攻击与战斗', () => {
  it('近战对拼按 DPS 结算（Knight vs Knight）', () => {
    const match = makeMatch()
    // 中路：远离双方公主塔射程，避免塔的干扰
    const a = spawnTestUnit(match, 'knight', 'player', { x: 9, y: 12 })
    const b = spawnTestUnit(match, 'knight', 'enemy', { x: 9, y: 13 })

    simulate(match, 3)
    // 首攻 0.5s，随后每 1.2s：3 秒内每人出手 3 次
    const expectedHits = 3
    expect(b.maxHp - b.hp).toBeCloseTo(202 * expectedHits, -1)
    expect(a.maxHp - a.hp).toBeCloseTo(202 * expectedHits, -1)
  })

  it('远程单位经投射物延时造成伤害（Musketeer）', () => {
    const match = makeMatch()
    const musketeer = spawnTestUnit(match, 'musketeer', 'player', { x: 9, y: 10 })
    const target = spawnTestUnit(match, 'knight', 'enemy', { x: 9, y: 15 })

    // 0.7s 首攻 + 约 0.3s 飞行，1.2s 内应命中
    simulate(match, 1.2)
    expect(target.hp).toBeLessThan(target.maxHp)
    expect(musketeer.hp).toBe(musketeer.maxHp)
  })

  it('Valkyrie 360° 溅射命中多个单位', () => {
    const match = makeMatch()
    spawnTestUnit(match, 'valkyrie', 'player', { x: 9, y: 10 })
    const e1 = spawnTestUnit(match, 'knight', 'enemy', { x: 9, y: 11.2 })
    const e2 = spawnTestUnit(match, 'knight', 'enemy', { x: 10.2, y: 10.4 })

    simulate(match, 1.2)
    expect(e1.hp).toBeLessThan(e1.maxHp)
    expect(e2.hp).toBeLessThan(e2.maxHp)
  })

  it('Bomber 溅射仅对地（对空无伤）', () => {
    const match = makeMatch()
    spawnTestUnit(match, 'bomber', 'player', { x: 9, y: 12 })
    const flyer = spawnTestUnit(match, 'minions', 'enemy', { x: 9, y: 13 })

    simulate(match, 2.5)
    expect(flyer.hp).toBe(flyer.maxHp)
  })

  it('Giant 被部队攻击时不反击（继续走向塔）', () => {
    const match = makeMatch()
    const giant = spawnTestUnit(match, 'giant', 'player', { x: 9, y: 13 })
    const attacker = spawnTestUnit(match, 'knight', 'enemy', { x: 9, y: 14.5 })

    simulate(match, 3)
    expect(attacker.hp).toBe(attacker.maxHp)
    expect(giant.hp).toBeLessThan(giant.maxHp)
  })
})
