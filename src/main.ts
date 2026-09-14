import { GameController } from './game/GameController'
import { ModelLibrary } from './render/ModelLibrary'

const host = document.getElementById('canvas-host')
if (!host) throw new Error('缺少 #canvas-host 容器')

// 预载 CC0 模型（失败不阻塞：EntityViews 会回退程序化建模）
ModelLibrary.instance.load().catch(() => {}).then(() => {
  new GameController(host)
})
