import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { clone as skeletonClone } from 'three/examples/jsm/utils/SkeletonUtils.js'

/**
 * GLB 模型库：预加载 Kenney CC0 模型（见 public/models/CREDITS.md）。
 * - 单例，load() 全量预载，单个文件失败不阻塞（调用方回退程序化建模）
 * - 角色为 SkinnedMesh，必须用 SkeletonUtils.clone 实例化
 */

export interface ModelTemplate {
  scene: THREE.Group
  animations: THREE.AnimationClip[]
}

const MODEL_URLS = {
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
  private readonly loader = new GLTFLoader()
  private loadPromise: Promise<void> | null = null

  get ready(): boolean {
    return this.loadPromise !== null
  }

  /** 预加载全部模型；单个失败仅告警。可安全重复调用。 */
  load(): Promise<void> {
    this.loadPromise ??= (async () => {
      const entries = await Promise.allSettled(
        (Object.keys(MODEL_URLS) as ModelName[]).map(async (name) => {
          const gltf = await this.loader.loadAsync(MODEL_URLS[name])
          this.templates.set(name, { scene: gltf.scene, animations: gltf.animations })
        }),
      )
      entries.forEach((result, index) => {
        if (result.status === 'rejected') {
          const name = (Object.keys(MODEL_URLS) as ModelName[])[index]
          console.warn(`[ModelLibrary] 模型加载失败，回退程序化建模: ${name}`, result.reason)
        }
      })
    })()
    return this.loadPromise
  }

  get(name: ModelName): ModelTemplate | null {
    return this.templates.get(name) ?? null
  }

  /** 普通（非骨骼）模型克隆 */
  cloneStatic(name: ModelName): THREE.Group | null {
    const template = this.get(name)
    return template ? (template.scene.clone(true) as THREE.Group) : null
  }

  /** 骨骼角色克隆（SkinnedMesh 必须走 SkeletonUtils） */
  cloneSkinned(name: ModelName): THREE.Group | null {
    const template = this.get(name)
    return template ? (skeletonClone(template.scene) as THREE.Group) : null
  }
}
