import { GameController } from './game/GameController'
import { ModelLibrary } from './render/ModelLibrary'
import { SoundFX } from './audio/SoundFX'

const host = document.getElementById('canvas-host')
if (!host) throw new Error('缺少 #canvas-host 容器')

const loading = document.createElement('div')
loading.className = 'loading-screen'
loading.setAttribute('role', 'status')
loading.textContent = '正在准备竞技场…'
document.body.append(loading)
// A match starts only after assets settle, so loading never consumes match time.
ModelLibrary.instance
  .load((done, total) => {
    loading.textContent = `正在准备竞技场… ${Math.round((done / total) * 85)}%`
  })
  .then(() =>
    SoundFX.instance.load((done, total) => {
      loading.textContent = `正在准备音效… ${Math.round((done / total) * 100)}%`
    }),
  )
  .then(() => {
    new GameController(host)
    loading.remove()
  })
  .catch((error: unknown) => {
    console.error('游戏启动失败', error)
    loading.textContent = '竞技场启动失败，请刷新重试。'
  })
