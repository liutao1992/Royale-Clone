/** Immersive spectator camera. Combat continues; deployment resumes on exit. */
export class ImmersiveView {
  active = false
  private readonly button = document.createElement('button')
  private readonly hint = document.createElement('div')

  constructor(private readonly onChange: (active: boolean) => void) {
    this.button.id = 'immersive-toggle'
    this.button.type = 'button'
    this.button.textContent = '沉浸视角 · I'
    this.button.setAttribute('aria-pressed', 'false')
    this.button.addEventListener('click', () => this.setActive(!this.active))
    this.hint.id = 'immersive-hint'
    this.hint.textContent = '拖动旋转 · 滚轮 / 双指缩放 · Esc 返回对战（战斗继续）'
    this.hint.hidden = true
    document.body.append(this.button, this.hint)
    window.addEventListener('keydown', event => {
      if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return
      const target = event.target
      if (target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return
      if (event.key === 'Escape' && this.active) { event.preventDefault(); this.setActive(false) }
      else if (event.key.toLowerCase() === 'i') { event.preventDefault(); this.setActive(!this.active) }
    })
  }

  setActive(active: boolean): void {
    if (active === this.active) return
    this.active = active
    document.body.classList.toggle('immersive', active)
    this.button.textContent = active ? '退出沉浸 · Esc' : '沉浸视角 · I'
    this.button.setAttribute('aria-pressed', String(active))
    this.hint.hidden = !active
    this.onChange(active)
  }
}
