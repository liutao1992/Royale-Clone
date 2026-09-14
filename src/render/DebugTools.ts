import GUI from 'lil-gui'
import type { CameraRig } from './CameraRig'
import type { ArenaView } from './ArenaView'

/**
 * 开发期调试面板：相机标定滑杆、可见性开关、FPS。
 * Stage 5 打包前将移除此依赖（或仅在 ?debug=1 时加载）。
 */
export class DebugTools {
  private readonly fpsEl: HTMLElement | null
  private frames = 0
  private elapsed = 0

  constructor(cameraRig: CameraRig, arena: ArenaView) {
    const gui = new GUI({ title: 'Royale Debug' })
    gui.close()

    const initial = cameraRig.getParams()
    const state = {
      fov: initial.fov,
      posX: initial.posX,
      posY: initial.posY,
      posZ: initial.posZ,
      targetX: initial.targetX,
      targetZ: initial.targetZ,
      grid: false,
      ranges: false,
      freeMode: false,
      printCamera: () => {
        console.log(`CAMERA_PARAMS\n${cameraRig.describe()}`)
      },
    }

    const camera = gui.addFolder('Camera')
    camera.add(state, 'fov', 20, 60, 0.5).onChange(() => apply())
    camera.add(state, 'posX', -20, 40, 0.5).onChange(() => apply())
    camera.add(state, 'posY', 10, 90, 0.5).onChange(() => apply())
    camera.add(state, 'posZ', -60, 20, 0.5).onChange(() => apply())
    camera.add(state, 'targetX', -10, 30, 0.5).onChange(() => apply())
    camera.add(state, 'targetZ', 0, 32, 0.5).onChange(() => apply())
    camera.add(state, 'printCamera').name('打印参数 (P)')

    const apply = (): void => {
      cameraRig.apply({
        fov: state.fov,
        posX: state.posX,
        posY: state.posY,
        posZ: state.posZ,
        targetX: state.targetX,
        targetZ: state.targetZ,
      })
    }

    const debug = gui.addFolder('Debug')
    debug.add(state, 'grid').onChange((v: boolean) => {
      arena.toggleGrid(v)
    })
    debug.add(state, 'ranges').onChange((v: boolean) => {
      arena.toggleRanges(v)
    })
    debug
      .add(state, 'freeMode')
      .name('自由视角 (O)')
      .onChange((v: boolean) => {
        cameraRig.setFreeMode(v)
      })

    this.fpsEl = document.getElementById('fps')
  }

  tick(dt: number): void {
    this.frames += 1
    this.elapsed += dt
    if (this.elapsed >= 0.5) {
      const fps = Math.round(this.frames / this.elapsed)
      if (this.fpsEl) this.fpsEl.textContent = `${fps} FPS`
      this.frames = 0
      this.elapsed = 0
    }
  }
}
