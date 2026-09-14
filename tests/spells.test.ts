import { describe, expect, it } from 'vitest'
import { findTower, makeMatch, simulate, spawnTestUnit } from './helpers'

/** 法术全部在初始手牌的卡组 */
const SPELL_DECK = ['fireball', 'zap', 'arrows', 'knight', 'archers', 'giant', 'musketeer', 'minions']

function makeSpellMatch() {
  return makeMatch({ playerDeck: SPELL_DECK })
}

function deploySpell(match: ReturnType<typeof makeSpellMatch>, cardId: string, pos: { x: number; y: number }): void {
  const team = match.state.teams.player
  const index = team.hand.indexOf(cardId)
  if (index < 0) throw new Error(`手牌中没有法术：${cardId}`)
  team.elixir = 10
  const ok = match.deployCard('player', index, pos)
  if (!ok) throw new Error(`法术部署失败：${cardId}`)
}

describe('法术系统', () => {
  it('Fireball：范围内单位受到 688 伤害', () => {
    const match = makeSpellMatch()
    const knight = spawnTestUnit(match, 'knight', 'enemy', { x: 9, y: 20 })

    deploySpell(match, 'fireball', { x: 9, y: 20 })
    simulate(match, 1.0)

    expect(knight.hp).toBe(1766 - 688)
  })

  it('Fireball：对塔伤害 207（独立数值）', () => {
    const match = makeSpellMatch()
    const tower = findTower(match, 'enemy', 'princess', 'right')

    deploySpell(match, 'fireball', { x: tower.pos.x, y: tower.pos.y })
    simulate(match, 1.0)

    expect(tower.hp).toBe(3052 - 207)
  })

  it('Fireball：范围外单位不受伤害', () => {
    const match = makeSpellMatch()
    const outside = spawnTestUnit(match, 'knight', 'enemy', { x: 14, y: 20 })

    deploySpell(match, 'fireball', { x: 9, y: 20 })
    simulate(match, 1.0)

    expect(outside.hp).toBe(1766)
  })

  it('Zap：瞬发眩晕 0.5s', () => {
    const match = makeSpellMatch()
    const knight = spawnTestUnit(match, 'knight', 'enemy', { x: 9, y: 20 })

    deploySpell(match, 'zap', { x: 9, y: 20 })
    simulate(match, 0.1)

    expect(knight.hp).toBe(1766 - 192)
    expect(knight.stunTimer).toBeGreaterThan(0.3)
  })

  it('Arrows：3 波分次结算（总伤 366）', () => {
    const match = makeSpellMatch()
    const knight = spawnTestUnit(match, 'knight', 'enemy', { x: 9, y: 20 })

    deploySpell(match, 'arrows', { x: 9, y: 20 })
    simulate(match, 2.0)

    expect(knight.hp).toBe(1766 - 366)
  })

  it('法术可放置于河道', () => {
    const match = makeSpellMatch()
    const team = match.state.teams.player
    const index = team.hand.indexOf('fireball')
    team.elixir = 10
    expect(match.deployCard('player', index, { x: 9, y: 16 })).toBe(true)
  })
})
