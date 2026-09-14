import type { Vec2 } from '../core/math'

export interface DragDeployOptions {
  /** 该手牌位当前是否可开始拖拽（费用检查等） */
  canStart: (handIndex: number) => boolean
  /** 屏幕坐标 → tile 坐标 */
  screenToTile: (clientX: number, clientY: number) => Vec2 | null
  /** 目标位置是否合法（区域 + 费用） */
  canDeploy: (handIndex: number, tile: Vec2) => boolean
  onDeploy: (handIndex: number, tile: Vec2) => void
  onDragStart: (handIndex: number) => void
  onDragEnd: () => void
  onPreview: (handIndex: number, tile: Vec2 | null, valid: boolean) => void
}

/**
 * 拖拽部署交互：
 * 手牌上按下 → 浮层跟随指针 → 地面预览（合法绿/非法红）→ 松开部署。
 */
export class DragDeploy {
  private readonly handEl: HTMLElement
  private readonly opts: DragDeployOptions

  private dragIndex = -1
  private floatEl: HTMLElement | null = null

  constructor(handEl: HTMLElement, opts: DragDeployOptions) {
    this.handEl = handEl
    this.opts = opts

    this.handEl.addEventListener('pointerdown', this.onPointerDown)
    window.addEventListener('pointermove', this.onPointerMove)
    window.addEventListener('pointerup', this.onPointerUp)
    window.addEventListener('pointercancel', this.onPointerUp)
  }

  get isDragging(): boolean {
    return this.dragIndex >= 0
  }

  private readonly onPointerDown = (event: PointerEvent): void => {
    const target = (event.target as HTMLElement).closest<HTMLElement>('.card[data-slot]')
    if (!target) return
    const index = Number(target.dataset.slot)
    if (!Number.isInteger(index) || index < 0) return
    if (!this.opts.canStart(index)) return

    event.preventDefault()
    this.dragIndex = index

    const float = target.cloneNode(true) as HTMLElement
    float.classList.add('drag-float')
    float.style.width = `${target.offsetWidth}px`
    float.style.height = `${target.offsetHeight}px`
    document.body.appendChild(float)
    this.floatEl = float
    target.classList.add('dragging-source')

    this.moveFloat(event.clientX, event.clientY)
    this.opts.onDragStart(index)
    this.updatePreview(event.clientX, event.clientY)
  }

  private readonly onPointerMove = (event: PointerEvent): void => {
    if (this.dragIndex < 0) return
    this.moveFloat(event.clientX, event.clientY)
    this.updatePreview(event.clientX, event.clientY)
  }

  private readonly onPointerUp = (event: PointerEvent): void => {
    if (this.dragIndex < 0) return
    const index = this.dragIndex
    const tile = this.opts.screenToTile(event.clientX, event.clientY)

    this.cleanup()

    if (tile && this.opts.canDeploy(index, tile)) {
      this.opts.onDeploy(index, tile)
    }
    this.opts.onPreview(index, null, false)
    this.opts.onDragEnd()
  }

  private updatePreview(clientX: number, clientY: number): void {
    const tile = this.opts.screenToTile(clientX, clientY)
    const valid = tile ? this.opts.canDeploy(this.dragIndex, tile) : false
    this.opts.onPreview(this.dragIndex, tile, valid)
  }

  private moveFloat(clientX: number, clientY: number): void {
    if (!this.floatEl) return
    // 浮层放在指针上方，避免遮挡落点预览（触屏同理：卡片在手指上方）
    const w = this.floatEl.offsetWidth
    const h = this.floatEl.offsetHeight
    const left = Math.min(Math.max(clientX - w / 2, 8), window.innerWidth - w - 8)
    const top = Math.max(clientY - h - 30, 8)
    this.floatEl.style.left = `${left}px`
    this.floatEl.style.top = `${top}px`
  }

  private cleanup(): void {
    const source = this.handEl.querySelector<HTMLElement>('.card.dragging-source')
    source?.classList.remove('dragging-source')
    this.floatEl?.remove()
    this.floatEl = null
    this.dragIndex = -1
  }
}
