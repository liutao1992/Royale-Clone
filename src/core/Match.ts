import { TICK_DT, World, type System } from './World'
import type { MatchState, TeamState } from './types'
import { TOWER_SLOTS, type Team } from './data/arena'
import { DEFAULT_ENEMY_DECK, DEFAULT_PLAYER_DECK, TOWER_CARDS } from './data/cards'
import type { Vec2 } from './math'
import { initDeck } from './systems/CardSystem'
import { ElixirSystem } from './systems/ElixirSystem'
import { MatchSystem } from './systems/MatchSystem'
import { DeploySystem } from './systems/DeploySystem'
import { TargetingSystem } from './systems/TargetingSystem'
import { MovementSystem } from './systems/MovementSystem'
import { CombatSystem } from './systems/CombatSystem'
import { ProjectileSystem } from './systems/ProjectileSystem'
import { BattleAI } from '../ai/BattleAI'

export interface MatchOptions {
  playerDeck?: string[]
  enemyDeck?: string[]
  seed?: number
  /** 兼容快捷项：为敌方开启 AI */
  aiEnabled?: boolean
  /** 显式指定接入 AI 的队伍 */
  aiTeams?: Team[]
}

/**
 * 对局组装器：构建世界状态、六塔、系统管线与可选 AI。
 * 无渲染依赖，可在测试与模拟脚本中完整运行。
 */
export class Match {
  readonly world: World

  private readonly deploy: DeploySystem
  private readonly ais: BattleAI[] = []

  constructor(options: MatchOptions = {}) {
    const matchState: MatchState = {
      phase: 'normal',
      elapsed: 0,
      winner: null,
      teams: {
        player: createTeamState(),
        enemy: createTeamState(),
      },
      events: [],
    }

    this.world = new World(matchState)
    initDeck(matchState.teams.player, options.playerDeck ?? DEFAULT_PLAYER_DECK)
    initDeck(matchState.teams.enemy, options.enemyDeck ?? DEFAULT_ENEMY_DECK)
    installTowers(this.world)

    this.deploy = new DeploySystem()
    const systems: System[] = [
      new MatchSystem(),
      new ElixirSystem(),
      this.deploy,
      new TargetingSystem(),
      new MovementSystem(),
      new CombatSystem(),
      new ProjectileSystem(),
    ]
    for (const system of systems) this.world.register(system)

    const aiTeams = options.aiTeams ?? (options.aiEnabled ? (['enemy'] as Team[]) : [])
    for (const team of aiTeams) {
      const ai = new BattleAI(team, this.deploy, (options.seed ?? 1) + (team === 'player' ? 7919 : 0))
      this.ais.push(ai)
      this.world.register(ai)
    }
  }

  get state(): MatchState {
    return this.world.match
  }

  /** 玩家/AI 统一部署入口 */
  deployCard(team: Team, handIndex: number, pos: Vec2): boolean {
    return this.deploy.request(this.world, team, handIndex, pos)
  }

  step(dt: number): void {
    this.world.step(dt)
  }

  /** 无头推进指定秒数（结束即停止） */
  runFor(seconds: number): void {
    const ticks = Math.round(seconds / TICK_DT)
    for (let i = 0; i < ticks; i++) {
      if (this.world.match.winner !== null) break
      this.world.step(TICK_DT)
    }
  }
}

function createTeamState(): TeamState {
  return {
    elixir: 5,
    crowns: 0,
    kingActivated: false,
    unlockedLanes: { left: false, right: false },
    hand: [],
    queue: [],
    nextCard: '',
  }
}

function installTowers(world: World): void {
  for (const slot of TOWER_SLOTS) {
    const def = slot.kind === 'king' ? TOWER_CARDS['king-tower'] : TOWER_CARDS['princess-tower']
    world.spawn({
      kind: 'tower',
      team: slot.team,
      cardId: def.id,
      pos: { x: slot.x, y: slot.y },
      layer: 'ground',
      radius: def.radius,
      mass: Infinity,
      hp: def.hp,
      maxHp: def.hp,
      state: 'idle',
      removed: false,
      speed: 0,
      jumpRiver: false,
      combat: { ...def.combat },
      targetId: null,
      attackTimer: def.combat.hitSpeed,
      stunTimer: 0,
      deployTimer: 0,
      lifetime: 0,
      projectile: null,
      towerKind: slot.kind,
      activated: slot.kind === 'princess',
    })
  }
}
