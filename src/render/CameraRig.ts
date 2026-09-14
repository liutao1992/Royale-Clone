import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { ARENA_WIDTH, ARENA_LENGTH } from '../core/data/arena'

/**
 * 固定相机参数（Stage 1 标定对象）
 *
 * 约 45° 斜俯视，显示塔的正面；30° 视野角减轻远近尺寸差。
 * 实际距离由窗口尺寸和 HUD 留白自动适配。
 */
export interface CameraParams {
  fov: number
  posX: number
  posY: number
  posZ: number
  targetX: number
  targetY: number
  targetZ: number
}

export const DEFAULT_CAMERA: CameraParams = {
  fov: 30,
  posX: ARENA_WIDTH / 2,
  posY: 36,
  posZ: -20,
  targetX: ARENA_WIDTH / 2,
  targetY: 0,
  targetZ: ARENA_LENGTH / 2,
}

export class CameraRig {
  readonly camera: THREE.PerspectiveCamera

  private params: CameraParams
  private readonly controls: OrbitControls
  private free = false
  private width = 0
  private height = 0

  constructor(private readonly dom: HTMLElement) {
    this.params = { ...DEFAULT_CAMERA }
    this.camera = new THREE.PerspectiveCamera(this.params.fov, 1, 0.1, 600)

    // controls 必须先于 apply() 初始化（apply 会同步 controls.target）
    this.controls = new OrbitControls(this.camera, dom)
    this.controls.enabled = false
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.08
    this.controls.target.set(this.params.targetX, this.params.targetY, this.params.targetZ)

    this.apply()
    this.resize()
  }

  get isFree(): boolean {
    return this.free
  }

  getParams(): CameraParams {
    return { ...this.params }
  }

  apply(patch: Partial<CameraParams> = {}): void {
    Object.assign(this.params, patch)
    const { fov, posX, posY, posZ, targetX, targetY, targetZ } = this.params
    this.camera.fov = fov
    this.camera.position.set(posX, posY, posZ)
    this.camera.lookAt(targetX, targetY, targetZ)
    this.camera.updateProjectionMatrix()
    if (!this.free) {
      this.controls.target.set(targetX, targetY, targetZ)
    }
  }

  setFreeMode(enabled: boolean): void {
    this.free = enabled
    this.controls.enabled = enabled
    if (!enabled) this.apply()
  }

  update(): void {
    this.resize()
    if (this.free) this.controls.update()
  }

  private resize(): void {
    const width = this.dom.clientWidth, height = this.dom.clientHeight
    if (!width || !height || (width === this.width && height === this.height)) return
    this.width = width; this.height = height
    const top = Math.min(95, height * 0.16), bottom = Math.min(210, height * 0.29)
    this.camera.aspect = width / height
    this.camera.setViewOffset(width, height, 0, (bottom - top) / 2, width, height)
    if (this.free) return
    this.apply()
    const target = new THREE.Vector3(this.params.targetX, this.params.targetY, this.params.targetZ)
    const direction = this.camera.position.clone().sub(target).normalize()
    let distance = this.camera.position.distanceTo(target)
    // Fit the complete asset footprint and tower height between the HUD and hand.
    const corners: THREE.Vector3[] = []
    for (const x of [-1, ARENA_WIDTH + 1]) for (const z of [-1, ARENA_LENGTH + 1]) {
      for (const y of [0, 4.2]) corners.push(new THREE.Vector3(x, y, z))
    }
    for (let i = 0; i < 100; i++) {
      this.camera.position.copy(target).addScaledVector(direction, distance)
      this.camera.updateMatrixWorld()
      if (corners.every(corner => {
        const p = corner.clone().project(this.camera)
        return Math.abs(p.x) < 0.95 && p.y < 1 - 2 * top / height && p.y > -1 + 2 * bottom / height
      })) break
      distance *= 1.025
    }
  }

  /** 当前相机参数（自由视角下取实际相机姿态），用于调参固化 */
  describe(): string {
    const p = this.camera.position
    const t = this.free ? this.controls.target : new THREE.Vector3(this.params.targetX, this.params.targetY, this.params.targetZ)
    return JSON.stringify(
      {
        fov: round(this.camera.fov),
        pos: { x: round(p.x), y: round(p.y), z: round(p.z) },
        target: { x: round(t.x), y: round(t.y), z: round(t.z) },
      },
      null,
      2,
    )
  }
}

function round(v: number): number {
  return Math.round(v * 100) / 100
}
