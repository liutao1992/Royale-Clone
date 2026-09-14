import * as THREE from 'three'
import { ARENA_WIDTH, RIVER } from '../core/data/arena'
import type { Vec2 } from '../core/math'

/** 破塔后对方半场可部署纵深（与 DeploySystem 的 POCKET_DEPTH 对齐） */
const POCKET_DEPTH = 5

/**
 * 部署覆盖层：可部署区域高亮（边框 + 填充联动）+ 拖拽幽灵预览（合法绿 / 非法红）。
 */
export class DeployOverlay {
  readonly root = new THREE.Group()

  private readonly ownZone: THREE.Group
  private readonly pocketLeftZone: THREE.Group
  private readonly pocketRightZone: THREE.Group
  private readonly ghost: THREE.Mesh
  private readonly ghostRing: THREE.LineLoop
  private readonly ghostMat: THREE.MeshBasicMaterial

  constructor() {
    this.ownZone = createZone(ARENA_WIDTH, RIVER.y0, ARENA_WIDTH / 2, RIVER.y0 / 2)
    this.pocketLeftZone = createZone(ARENA_WIDTH / 2, POCKET_DEPTH, ARENA_WIDTH / 4, RIVER.y1 + POCKET_DEPTH / 2)
    this.pocketRightZone = createZone(
      ARENA_WIDTH / 2,
      POCKET_DEPTH,
      (ARENA_WIDTH * 3) / 4,
      RIVER.y1 + POCKET_DEPTH / 2,
    )

    this.ghostMat = new THREE.MeshBasicMaterial({
      color: 0x22ff88,
      transparent: true,
      opacity: 0.65,
      depthWrite: false,
    })
    this.ghost = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.65, 1.0, 12), this.ghostMat)
    this.ghost.position.y = 0.5

    this.ghostRing = createRing(0.9, 0x22ff88, 1.0)

    this.root.add(this.ownZone, this.pocketLeftZone, this.pocketRightZone, this.ghost, this.ghostRing)
    this.root.visible = false
  }

  show(opts: { isSpell: boolean; unlockedLeft: boolean; unlockedRight: boolean }): void {
    this.root.visible = true
    this.ownZone.visible = !opts.isSpell
    this.pocketLeftZone.visible = !opts.isSpell && opts.unlockedLeft
    this.pocketRightZone.visible = !opts.isSpell && opts.unlockedRight
    this.setGhost(null, true, 0.6)
  }

  hide(): void {
    this.root.visible = false
    this.setGhost(null, true, 0.6)
  }

  setGhost(pos: Vec2 | null, valid: boolean, radius: number): void {
    if (!pos) {
      this.ghost.visible = false
      this.ghostRing.visible = false
      return
    }

    this.ghost.visible = true
    this.ghostRing.visible = true
    this.ghost.position.set(pos.x, 0.5, pos.y)
    this.ghost.scale.set(radius / 0.6, 1, radius / 0.6)
    this.ghostRing.position.set(pos.x, 0.07, pos.y)
    this.ghostRing.scale.set(radius / 0.9, radius / 0.9, 1)

    const color = valid ? 0x22ff88 : 0xff3355
    this.ghostMat.color.setHex(color)
    this.ghostMat.opacity = valid ? 0.65 : 0.5
    ;(this.ghostRing.material as THREE.LineBasicMaterial).color.setHex(color)
  }

  /** 调试/测试：查询当前预览状态 */
  getPreviewInfo(): { rootVisible: boolean; ghostVisible: boolean; pos: Vec2 } {
    return {
      rootVisible: this.root.visible,
      ghostVisible: this.ghost.visible,
      pos: { x: this.ghost.position.x, y: this.ghost.position.z },
    }
  }
}

/** 区域 = 半透明填充 + 亮色边框（同一 Group 统一显隐） */
function createZone(width: number, depth: number, x: number, z: number): THREE.Group {
  const group = new THREE.Group()

  const fill = new THREE.Mesh(
    new THREE.PlaneGeometry(width, depth),
    new THREE.MeshBasicMaterial({
      color: 0x4dd8ff,
      transparent: true,
      opacity: 0.3,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  )
  fill.rotation.x = -Math.PI / 2
  fill.position.set(x, 0.03, z)

  const y = 0.06
  const hw = width / 2
  const hd = depth / 2
  const points = [
    -hw, y, -hd, hw, y, -hd,
    hw, y, -hd, hw, y, hd,
    hw, y, hd, -hw, y, hd,
    -hw, y, hd, -hw, y, -hd,
  ]
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3))
  const outline = new THREE.LineSegments(
    geometry,
    new THREE.LineBasicMaterial({ color: 0x4dd8ff, transparent: true, opacity: 0.85 }),
  )
  outline.position.set(x, 0, z)

  group.add(fill, outline)
  return group
}

function createRing(radius: number, color: number, opacity = 0.9): THREE.LineLoop {
  const segments = 64
  const points: number[] = []
  for (let i = 0; i < segments; i++) {
    const angle = (i / segments) * Math.PI * 2
    points.push(Math.cos(angle) * radius, 0, Math.sin(angle) * radius)
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3))
  const ring = new THREE.LineLoop(
    geometry,
    new THREE.LineBasicMaterial({ color, transparent: true, opacity }),
  )
  ring.rotation.x = 0
  return ring
}
