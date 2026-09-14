import type { MatchState } from '../core/types'
import { formatTime } from '../core/systems/MatchSystem'

const PHASE_LABEL: Record<string, string> = {
  normal: '',
  double: '双倍圣水',
  overtime: '加时 · 先破塔者胜',
  tiebreaker: '决胜对耗',
  finished: '',
}

/** 顶部 HUD：倒计时、皇冠数、阶段提示 */
export class HUD {
  private readonly timerEl: HTMLElement
  private readonly phaseEl: HTMLElement
  private readonly crownPlayerEl: HTMLElement
  private readonly crownEnemyEl: HTMLElement
  private lastPhase = ''

  constructor() {
    this.timerEl = requireEl('timer')
    this.phaseEl = requireEl('phase-banner')
    this.crownPlayerEl = requireEl('crowns-player')
    this.crownEnemyEl = requireEl('crowns-enemy')
  }

  update(state: MatchState): void {
    const remaining = state.elapsed < 180 ? 180 - state.elapsed : 300 - state.elapsed
    this.timerEl.textContent = formatTime(Math.max(0, remaining))

    this.crownPlayerEl.textContent = String(state.teams.player.crowns)
    this.crownEnemyEl.textContent = String(state.teams.enemy.crowns)

    if (state.phase !== this.lastPhase) {
      this.lastPhase = state.phase
      const label = PHASE_LABEL[state.phase] ?? ''
      this.phaseEl.textContent = label
      this.phaseEl.classList.toggle('visible', label !== '')
      if (label !== '') {
        this.phaseEl.classList.remove('flash')
        void this.phaseEl.offsetWidth
        this.phaseEl.classList.add('flash')
      }
    }
  }
}

function requireEl(id: string): HTMLElement {
  const el = document.getElementById(id)
  if (!el) throw new Error(`缺少 UI 元素 #${id}`)
  return el
}
