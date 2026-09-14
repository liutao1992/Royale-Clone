import { Match } from '../src/core/Match'
import { formatTime } from '../src/core/systems/MatchSystem'

declare const process: { argv: string[] }

const seed = Number(process.argv[2] ?? 2026)
const match = new Match({ seed, aiTeams: ['player', 'enemy'] })
const maxSeconds = 360
let nextReport = 20

console.log('=== Royale Clone — 无头对局模拟 ===')
console.log(
  `玩家手牌: ${match.state.teams.player.hand.join(', ')} | 下一张: ${match.state.teams.player.nextCard}`,
)
console.log(
  `敌方手牌: ${match.state.teams.enemy.hand.join(', ')} | 下一张: ${match.state.teams.enemy.nextCard}`,
)
console.log('')

while (match.world.match.winner === null && match.world.time < maxSeconds) {
  match.step(1 / 60)
  if (match.world.time >= nextReport) {
    report(match)
    nextReport += 20
  }
}

const m = match.state
console.log('')
console.log('=== 对局结束 ===')
console.log(`最终时间: ${formatTime(m.elapsed)} | 阶段: ${m.phase} | 结果: ${m.winner ?? '达到模拟上限'}`)
console.log(`皇冠 — 玩家 ${m.teams.player.crowns} : ${m.teams.enemy.crowns} 敌方`)
console.log(
  `存活实体: ${match.world.entities.length}（塔 ${match.world.entities.filter((e) => e.kind === 'tower').length}/6）`,
)

const interesting = m.events.filter((e) => e.type !== 'deploy')
console.log('--- 关键事件 ---')
for (const ev of interesting.slice(-30)) {
  console.log(`[${formatTime(ev.time)}] ${ev.message}`)
}

function report(match: Match): void {
  const m = match.state
  const towers = match.world.entities.filter((e) => e.kind === 'tower').length
  console.log(
    `[${formatTime(m.elapsed)}] ${m.phase.padEnd(10)} 圣水 ${m.teams.player.elixir.toFixed(1)}/${m.teams.enemy.elixir.toFixed(1)} | 皇冠 ${m.teams.player.crowns}:${m.teams.enemy.crowns} | 塔 ${towers}/6 | 实体 ${match.world.entities.length}`,
  )
}
