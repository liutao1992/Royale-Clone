import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { clone as skeletonClone } from 'three/examples/jsm/utils/SkeletonUtils.js'

/**
 * GLB 模型库：Lux3D 素材优先，Kenney 模型用于其余兵种和加载回退。
 * - 单例，load() 全量预载，单个文件失败不阻塞（调用方回退程序化建模）
 * - 角色为 SkinnedMesh，必须用 SkeletonUtils.clone 实例化
 */

export interface ModelTemplate {
  scene: THREE.Group
  animations: THREE.AnimationClip[]
}

const MODEL_URLS = {
  arenaBase: 'models/lux3d/ENV-01.glb',
  field: 'models/lux3d/ENV-02.glb',
  riverbed: 'models/lux3d/ENV-03.glb',
  bridge: 'models/lux3d/ENV-05.glb',
  wall: 'models/lux3d/ENV-06.glb',
  corner: 'models/lux3d/ENV-07.glb',
  flag: 'models/lux3d/ENV-08.glb',
  shrub: 'models/lux3d/ENV-09.glb',
  rocks: 'models/lux3d/ENV-10.glb',
  luxCannon: 'models/lux3d/BLD-05.glb',
  princessRuin: 'models/lux3d/BLD-06.glb',
  kingRuin: 'models/lux3d/BLD-07.glb',
  debris: 'models/lux3d/BLD-08.glb',
  arrow: 'models/lux3d/PRJ-01.glb',
  bomb: 'models/lux3d/PRJ-02.glb',
  cannonball: 'models/lux3d/PRJ-03.glb',
  princessBlue: 'models/lux3d/princess_tower_blue.glb',
  princessRed: 'models/lux3d/princess_tower_red.glb',
  kingBlue: 'models/lux3d/king_tower_blue.glb',
  kingRed: 'models/lux3d/king_tower_red.glb',
  knightBlue: 'models/lux3d/knight_blue.glb',
  knightRed: 'models/lux3d/knight_red.glb',
  archerBlue: 'models/lux3d/archer_blue.glb',
  archerRed: 'models/lux3d/archer_red.glb',
  giantBlue: 'models/lux3d/giant_blue.glb',
  giantRed: 'models/lux3d/giant_red.glb',
  goblinBlue: 'models/lux3d/goblin_blue.glb',
  goblinRed: 'models/lux3d/goblin_red.glb',
  bomberBlue: 'models/lux3d/bomber_blue.glb',
  bomberRed: 'models/lux3d/bomber_red.glb',
  human: 'models/kenney/characters/character-human.glb',
  orc: 'models/kenney/characters/character-orc.glb',
  sword: 'models/kenney/characters/weapon-sword.glb',
  shieldRound: 'models/kenney/characters/shield-round.glb',
  banner: 'models/kenney/characters/banner.glb',
  towerRoundBottom: 'models/kenney/towers/tower-round-bottom-a.glb',
  towerRoundMiddle: 'models/kenney/towers/tower-round-middle-a.glb',
  towerRoundTop: 'models/kenney/towers/tower-round-top-a.glb',
  towerSquareBottom: 'models/kenney/towers/tower-square-bottom-b.glb',
  towerSquareMiddle: 'models/kenney/towers/tower-square-middle-b.glb',
  towerSquareTop: 'models/kenney/towers/tower-square-top-b.glb',
  cannon: 'models/kenney/towers/weapon-cannon.glb',
} as const

export type ModelName = keyof typeof MODEL_URLS

export class ModelLibrary {
  static readonly instance = new ModelLibrary()

  private readonly templates = new Map<ModelName, ModelTemplate>()
  private readonly loader: GLTFLoader
  private loadPromise: Promise<void> | null = null
  private loaded = false
  private readonly failures: ModelName[] = []

  constructor() {
    const embedded = (globalThis as typeof globalThis & { __ROYALE_ASSETS__?: Record<string, string> }).__ROYALE_ASSETS__
    const manager = new THREE.LoadingManager()
    if (embedded) manager.setURLModifier(url => {
      if (/^(data|blob):/.test(url)) return url
      const data = embedded[url.replace(/^\.\//, '')]
      if (!data) throw new Error(`离线素材缺失: ${url}`)
      return data
    })
    this.loader = new GLTFLoader(manager)
  }

  get ready(): boolean {
    return this.loaded
  }

  get status() {
    return { ready: this.ready, loaded: this.templates.size, total: Object.keys(MODEL_URLS).length, failed: [...this.failures] }
  }

  /** 预加载全部模型；单个失败仅告警。可安全重复调用。 */
  load(onProgress?: (completed: number, total: number) => void): Promise<void> {
    this.loadPromise ??= (async () => {
      const names = Object.keys(MODEL_URLS) as ModelName[]
      let completed = 0
      const entries = await Promise.allSettled(
        names.map(async (name) => {
          try {
            const gltf = await this.loader.loadAsync(`${import.meta.env.BASE_URL}${MODEL_URLS[name]}`)
            this.templates.set(name, { scene: gltf.scene, animations: gltf.animations })
          } finally {
            onProgress?.(++completed, names.length)
          }
        }),
      )
      entries.forEach((result, index) => {
        if (result.status === 'rejected') {
          const name = (Object.keys(MODEL_URLS) as ModelName[])[index]
          this.failures.push(name)
          console.warn(`[ModelLibrary] 模型加载失败，回退程序化建模: ${name}`, result.reason)
        }
      })
      this.loaded = true
    })()
    return this.loadPromise
  }

  get(name: ModelName): ModelTemplate | null {
    return this.templates.get(name) ?? null
  }

  /** 普通（非骨骼）模型克隆 */
  cloneStatic(name: ModelName): THREE.Group | null {
    const template = this.get(name)
    if (!template) return null
    const root = template.scene.clone(true) as THREE.Group
    root.userData.modelName = name
    // Geometry/textures are shared; opacity, damage tint and team state are per actor.
    root.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return
      child.material = Array.isArray(child.material)
        ? child.material.map((m: THREE.Material) => m.clone()) : child.material.clone()
      child.castShadow = true
      child.receiveShadow = true
    })
    return root
  }

  /** 骨骼角色克隆（SkinnedMesh 必须走 SkeletonUtils） */
  cloneSkinned(name: ModelName): THREE.Group | null {
    const template = this.get(name)
    return template ? (skeletonClone(template.scene) as THREE.Group) : null
  }
}
