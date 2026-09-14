import { describe, expect, it } from 'vitest'
import { initDeck } from '../src/core/systems/CardSystem'
import type { TeamState } from '../src/core/types'
import { ALL_CARDS, CARD_DEFS, TOWER_CARDS } from '../src/core/data/cards'

function makeTeamState(): TeamState {
  return {
    elixir: 0,
    crowns: 0,
    kingActivated: false,
    unlockedLanes: { left: false, right: false },
    hand: [],
    queue: [],
    nextCard: '',
  }
}

describe('卡牌数据', () => {
  it('部队/建筑 11 张 + 法术 3 张', () => {
    expect(Object.keys(CARD_DEFS)).toHaveLength(11)
    expect(Object.keys(ALL_CARDS)).toHaveLength(14)
  })

  it('DPS 与 docs/CARDS.md 一致（抽样）', () => {
    expect(CARD_DEFS.knight.combat!.damage / CARD_DEFS.knight.combat!.hitSpeed).toBeCloseTo(168.3, 1)
    expect(CARD_DEFS.musketeer.combat!.damage / CARD_DEFS.musketeer.combat!.hitSpeed).toBeCloseTo(217, 0)
    expect(CARD_DEFS['hog-rider'].combat!.damage / CARD_DEFS['hog-rider'].combat!.hitSpeed).toBeCloseTo(198.1, 1)
    expect(CARD_DEFS.cannon.combat!.damage / CARD_DEFS.cannon.combat!.hitSpeed).toBeCloseTo(212, 0)
  })

  it('首攻时间 = hitSpeed - loadTime', () => {
    for (const def of Object.values(CARD_DEFS)) {
      const c = def.combat!
      expect(c.loadTime).toBeCloseTo(c.hitSpeed - c.firstHit, 5)
    }
  })

  it('塔数值（L11）', () => {
    expect(TOWER_CARDS['princess-tower'].hp).toBe(3052)
    expect(TOWER_CARDS['princess-tower'].combat.damage).toBe(109)
    expect(TOWER_CARDS['king-tower'].hp).toBe(4824)
    expect(TOWER_CARDS['king-tower'].combat.range).toBe(7)
  })

  it('卡组循环：初始手牌 4 张、下一张 1 张、队列 3 张', () => {
    const team = makeTeamState()
    const deck = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
    initDeck(team, deck)
    expect(team.hand).toEqual(['a', 'b', 'c', 'd'])
    expect(team.nextCard).toBe('e')
    expect(team.queue).toEqual(['f', 'g', 'h'])
  })

  it('卡组必须为 8 张', () => {
    const team = makeTeamState()
    expect(() => initDeck(team, ['a', 'b'])).toThrow()
  })
})
