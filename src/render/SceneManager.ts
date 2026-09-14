import * as THREE from 'three'

type FrameCallback = (dt: number) => void

export class SceneManager {
  readonly scene: THREE.Scene
  readonly renderer: THREE.WebGLRenderer

  private readonly container: HTMLElement
  private frameCallback: FrameCallback | null = null
  private last = performance.now()
  private running = false

  constructor(container: HTMLElement) {
    this.container = container

    this.renderer = new THREE.WebGLRenderer({ antialias: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFShadowMap
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    container.appendChild(this.renderer.domElement)

    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0x7ec3f0)
    this.scene.fog = new THREE.Fog(0x7ec3f0, 60, 170)

    this.setupLights()
    window.addEventListener('resize', () => this.resize())
    this.resize()
  }

  start(callback: FrameCallback): void {
    this.frameCallback = callback
    if (this.running) return
    this.running = true
    this.last = performance.now()
    requestAnimationFrame(this.loop)
  }

  private readonly loop = (): void => {
    if (!this.running) return
    const now = performance.now()
    const dt = Math.min((now - this.last) / 1000, 0.1)
    this.last = now
    this.frameCallback?.(dt)
    requestAnimationFrame(this.loop)
  }

  render(camera: THREE.Camera): void {
    this.renderer.render(this.scene, camera)
  }

  private setupLights(): void {
    const hemi = new THREE.HemisphereLight(0xdff1ff, 0x3a5a40, 1.05)
    this.scene.add(hemi)

    // 主光从敌方上空打来：照亮所有面向相机的面（单位背面 / 敌方正面 / 塔的 -z 面）
    const sun = new THREE.DirectionalLight(0xfff2dd, 2.6)
    sun.position.set(-14, 46, 42)
    sun.castShadow = true
    sun.shadow.mapSize.set(2048, 2048)
    sun.shadow.camera.left = -30
    sun.shadow.camera.right = 30
    sun.shadow.camera.top = 44
    sun.shadow.camera.bottom = -44
    sun.shadow.camera.near = 1
    sun.shadow.camera.far = 160
    sun.shadow.bias = -0.0006
    sun.target.position.set(9, 0, 16)
    this.scene.add(sun)
    this.scene.add(sun.target)

    // 玩家侧补光，避免暗部死黑
    const fill = new THREE.DirectionalLight(0xbfd9ff, 0.35)
    fill.position.set(18, 20, -24)
    this.scene.add(fill)
  }

  private resize(): void {
    const width = this.container.clientWidth
    const height = this.container.clientHeight
    this.renderer.setSize(width, height)
  }
}
