import type { MatchState } from '../core/types'

/** 对局结算画面 */
export class MatchEnd {
  private readonly el: HTMLElement
  private readonly titleEl: HTMLElement
  private readonly detailEl: HTMLElement
  private readonly buttonEl: HTMLElement
  private restartHandler: (() => void) | null = null

  constructor() {
    this.el = requireEl('match-end')
    this.titleEl = requireEl('match-end-title')
    this.detailEl = requireEl('match-end-detail')
    this.buttonEl = requireEl('match-end-restart')
    this.buttonEl.addEventListener('click', () => {
      this.hide()
      this.restartHandler?.()
    })
  }

  onRestart(handler: () => void): void {
    this.restartHandler = handler
  }

  show(state: MatchState): void {
    const winner = state.winner
    this.titleEl.textContent =
      winner === 'player' ? '胜利' : winner === 'enemy' ? '失败' : '平局'
    this.titleEl.className = winner === 'player' ? 'win' : winner === 'enemy' ? 'lose' : 'draw'
    this.detailEl.textContent = `👑 ${state.teams.player.crowns} : ${state.teams.enemy.crowns}`
    this.el.classList.remove('hidden')
  }

  hide(): void {
    this.el.classList.add('hidden')
  }
}

function requireEl(id: string): HTMLElement {
  const el = document.getElementById(id)
  if (!el) throw new Error(`缺少 UI 元素 #${id}`)
  return el
}
