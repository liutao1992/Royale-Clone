import type { TeamState } from '../types'

/** 初始化卡组：前 4 张入手，第 5 张为下一张，其余进入队列 */
export function initDeck(team: TeamState, deck: string[]): void {
  if (deck.length !== 8) throw new Error('卡组必须为 8 张')
  team.hand = deck.slice(0, 4)
  team.nextCard = deck[4]
  team.queue = deck.slice(5)
}

/** 打出手牌后循环：出牌进队尾，补位与预览同步推进 */
export function cycleHand(team: TeamState, handIndex: number): string {
  const played = team.hand[handIndex]
  if (!played) throw new Error(`无效手牌位：${handIndex}`)
  team.hand[handIndex] = team.nextCard
  team.nextCard = team.queue.shift() ?? team.nextCard
  team.queue.push(played)
  return played
}
