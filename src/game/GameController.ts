import * as THREE from 'three'
import { Match } from '../core/Match'
import { ALL_CARDS } from '../core/data/cards'
import { isDeployAllowed } from '../core/systems/DeploySystem'
import type { Vec2 } from '../core/math'
import { SceneManager } from '../render/SceneManager'
import { CameraRig } from '../render/CameraRig'
import { ArenaView } from '../render/ArenaView'
import { EntityViews } from '../render/EntityViews'
import { DeployOverlay } from '../render/DeployOverlay'
import { DebugTools } from '../render/DebugTools'
import { HUD } from '../ui/HUD'
import { HandBar } from '../ui/HandBar'
import { DragDeploy } from '../ui/DragDeploy'
import { MatchEnd } from '../ui/MatchEnd'

/**
 * 游戏控制器：组装模拟核心（Match）与表现层（Three.js 视图 / DOM UI）。
 * 主循环：推进模拟 → 同步实体视图 → 刷新 HUD → 结算检测。
 */
export class GameController {
  private readonly sceneManager: SceneManager
  private readonly cameraRig: CameraRig
  private readonly arena: ArenaView
  private readonly entityViews: EntityViews
  private readonly overlay: DeployOverlay
  private readonly hud: HUD
  private readonly handBar: HandBar
  private readonly matchEnd: MatchEnd

  private readonly raycaster = new THREE.Raycaster()
  private readonly groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
  private readonly hitPoint = new THREE.Vector3()

  private match: Match
  private ended = false

  constructor(container: HTMLElement) {
    this.sceneManager = new SceneManager(container)
    this.cameraRig = new CameraRig(this.sceneManager.renderer.domElement)
    this.arena = new ArenaView()
    this.entityViews = new EntityViews()
    this.overlay = new DeployOverlay()

    this.sceneManager.scene.add(this.arena.root)
    this.sceneManager.scene.add(this.entityViews.root)
    this.sceneManager.scene.add(this.overlay.root)

    this.hud = new HUD()
    this.handBar = new HandBar()
    this.matchEnd = new MatchEnd()

    new DragDeploy(this.handBar.handEl, {
      canStart: (index) => this.canStartDrag(index),
      screenToTile: (x, y) => this.screenToTile(x, y),
      canDeploy: (index, tile) => this.canDeploy(index, tile),
      onDeploy: (index, tile) => this.doDeploy(index, tile),
      onDragStart: (index) => this.onDragStart(index),
      onDragEnd: () => this.overlay.hide(),
      onPreview: (index, tile, valid) => this.onPreview(index, tile, valid),
    })

    this.matchEnd.onRestart(() => this.restart())
    new DebugTools(this.cameraRig, this.arena)

    this.match = this.createMatch()
    this.installDebugApi()
    this.sceneManager.start((dt) => this.update(dt))
  }

  /** 仅开发/测试环境：向 window 暴露调试接口（E2E 断言与快进） */
  private installDebugApi(): void {
    if (!import.meta.env.DEV) return

    const api = {
      getState: () => ({
        phase: this.match.state.phase,
        elapsed: this.match.state.elapsed,
        winner: this.match.state.winner,
        playerElixir: this.match.state.teams.player.elixir,
        playerHand: [...this.match.state.teams.player.hand],
        playerNext: this.match.state.teams.player.nextCard,
        crowns: {
          player: this.match.state.teams.player.crowns,
          enemy: this.match.state.teams.enemy.crowns,
        },
        entityCount: this.match.world.entities.length,
        unitCount: this.match.world.entities.filter((e) => e.kind === 'unit').length,
        towerCount: this.match.world.entities.filter((e) => e.kind === 'tower').length,
        entities: this.match.world.entities.map((e) => ({
          id: e.id,
          kind: e.kind,
          cardId: e.cardId,
          team: e.team,
          state: e.state,
          x: Math.round(e.pos.x * 10) / 10,
          y: Math.round(e.pos.y * 10) / 10,
        })),
      }),
      fastForward: (seconds: number) => {
        this.match.runFor(Math.max(0, Math.min(seconds, 400)))
      },
      tileToScreen: (x: number, y: number) => {
        const v = new THREE.Vector3(x, 0, y).project(this.cameraRig.camera)
        const rect = this.sceneManager.renderer.domElement.getBoundingClientRect()
        return {
          x: rect.left + ((v.x + 1) / 2) * rect.width,
          y: rect.top + ((1 - v.y) / 2) * rect.height,
        }
      },
      getPreview: () => this.overlay.getPreviewInfo(),
    }

    ;(window as unknown as { __game: typeof api }).__game = api
  }

  private createMatch(): Match {
    return new Match({
      seed: Math.floor(Math.random() * 1_000_000_000),
      aiTeams: ['enemy'],
    })
  }

  private restart(): void {
    this.entityViews.clear()
    this.overlay.hide()
    this.ended = false
    this.match = this.createMatch()
  }

  private update(dt: number): void {
    this.match.step(dt)
    const world = this.match.world

    this.entityViews.sync(world, this.cameraRig.camera, world.time, dt)
    this.hud.update(this.match.state)
    this.handBar.update(this.match.state.teams.player)

    if (!this.ended && this.match.state.winner !== null) {
      this.ended = true
      this.matchEnd.show(this.match.state)
    }

    this.cameraRig.update()
    this.sceneManager.render(this.cameraRig.camera)
  }

  // ---------- 拖拽部署 ----------

  private canStartDrag(handIndex: number): boolean {
    if (this.match.state.winner !== null) return false
    const def = this.handCardDef(handIndex)
    if (!def) return false
    return this.match.state.teams.player.elixir >= def.cost
  }

  private canDeploy(handIndex: number, tile: Vec2): boolean {
    if (this.match.state.winner !== null) return false
    const def = this.handCardDef(handIndex)
    if (!def) return false
    if (this.match.state.teams.player.elixir < def.cost) return false
    return isDeployAllowed(this.match.world, 'player', def, tile)
  }

  private onDragStart(handIndex: number): void {
    const def = this.handCardDef(handIndex)
    const team = this.match.state.teams.player
    this.overlay.show({
      isSpell: def?.type === 'spell',
      unlockedLeft: team.unlockedLanes.left,
      unlockedRight: team.unlockedLanes.right,
    })
  }

  private onPreview(handIndex: number | null, tile: Vec2 | null, valid: boolean): void {
    if (handIndex === null || tile === null) {
      this.overlay.setGhost(null, true, 0.6)
      return
    }
    const def = this.handCardDef(handIndex)
    const radius = def?.type === 'spell' ? (def.spell?.radius ?? 2.5) : (def?.radius ?? 0.6)
    this.overlay.setGhost(tile, valid, radius)
  }

  private doDeploy(handIndex: number, tile: Vec2): void {
    this.match.deployCard('player', handIndex, tile)
  }

  private handCardDef(handIndex: number) {
    const cardId = this.match.state.teams.player.hand[handIndex]
    return cardId ? ALL_CARDS[cardId] : undefined
  }

  // ---------- 坐标 ----------

  private screenToTile(clientX: number, clientY: number): Vec2 | null {
    const rect = this.sceneManager.renderer.domElement.getBoundingClientRect()
    const ndc = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    )
    this.raycaster.setFromCamera(ndc, this.cameraRig.camera)
    if (!this.raycaster.ray.intersectPlane(this.groundPlane, this.hitPoint)) return null
    return { x: this.hitPoint.x, y: this.hitPoint.z }
  }
}
