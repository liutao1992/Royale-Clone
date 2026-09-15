/**
 * WebAudio 合成音效系统：零音频素材、离线可用、无网络请求。
 * - 首次用户手势（点击/按键）时解锁 AudioContext
 * - M 键或左上角按钮静音，偏好写入 localStorage
 * - 所有播放路径捕获异常，绝不向页面抛出错误
 */
export class SoundFX {
  private static readonly MUTE_KEY = 'royale:muted'

  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private noiseBuffer: AudioBuffer | null = null
  private muted = false
  private lastHitAt = 0
  private readonly button = document.createElement('button')

  constructor() {
    try {
      this.muted = localStorage.getItem(SoundFX.MUTE_KEY) === '1'
    } catch {
      this.muted = false
    }

    this.button.id = 'sound-toggle'
    this.button.type = 'button'
    this.button.addEventListener('click', () => this.setMuted(!this.muted))
    document.body.append(this.button)
    this.renderButton()

    const unlock = (): void => {
      this.ensure()
    }
    window.addEventListener('pointerdown', unlock, { once: true, capture: true })
    window.addEventListener('keydown', unlock, { once: true, capture: true })

    window.addEventListener('keydown', (event) => {
      if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return
      const target = event.target
      if (target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) {
        return
      }
      if (event.key.toLowerCase() === 'm') {
        event.preventDefault()
        this.setMuted(!this.muted)
      }
    })
  }

  get isMuted(): boolean {
    return this.muted
  }

  setMuted(muted: boolean): void {
    this.muted = muted
    try {
      localStorage.setItem(SoundFX.MUTE_KEY, muted ? '1' : '0')
    } catch {
      // 隐私模式等场景忽略持久化失败
    }
    this.renderButton()
  }

  private renderButton(): void {
    this.button.textContent = this.muted ? '音效 关 · M' : '音效 开 · M'
    this.button.setAttribute('aria-pressed', String(!this.muted))
    this.button.title = this.muted ? '开启音效（M）' : '关闭音效（M）'
  }

  // ---------- 播放接口 ----------

  /** 拖起手牌 */
  pickup(): void {
    this.tone(520, 520, 0.05, 'square', 0.05)
  }

  /** 部署部队：落地风声 + 低音垫 */
  deploy(): void {
    this.noise(0.22, 0.24, 'bandpass', 900, 260)
    this.tone(220, 110, 0.18, 'sine', 0.13)
  }

  /** 火球等法术：爆炸 */
  spellCast(): void {
    this.noise(0.5, 0.3, 'lowpass', 900, 140)
    this.tone(170, 48, 0.42, 'sine', 0.24)
  }

  /** 电击 */
  zap(): void {
    this.tone(1500, 320, 0.13, 'square', 0.09)
    this.noise(0.11, 0.16, 'highpass', 2200)
  }

  /** 箭雨 */
  arrows(): void {
    this.noise(0.34, 0.18, 'bandpass', 2200, 700)
  }

  /** 塔受击（节流，避免连射噪音） */
  hitTower(): void {
    const now = performance.now()
    if (now - this.lastHitAt < 130) return
    this.lastHitAt = now
    this.tone(150, 72, 0.12, 'sine', 0.14)
    this.noise(0.06, 0.08, 'lowpass', 500)
  }

  /** 塔被摧毁 */
  towerDown(): void {
    this.noise(0.6, 0.36, 'lowpass', 700, 110)
    this.tone(110, 40, 0.55, 'sine', 0.28)
    this.chime([880, 1174.7])
  }

  /** 满圣水提示 */
  elixirFull(): void {
    this.chime([880, 1318.5], 0.07, 0.12)
  }

  victory(): void {
    this.chime([523.3, 659.3, 784, 1046.5])
  }

  defeat(): void {
    this.chime([392, 329.6, 261.6, 196], 0.13, 0.16, 'sine')
  }

  draw(): void {
    this.chime([440, 440], 0.15, 0.16, 'sine')
  }

  // ---------- 合成原语 ----------

  private ensure(): AudioContext | null {
    try {
      if (!this.ctx) {
        if (typeof AudioContext === 'undefined') return null
        this.ctx = new AudioContext()
        this.master = this.ctx.createGain()
        this.master.gain.value = 0.42
        this.master.connect(this.ctx.destination)
        this.noiseBuffer = this.makeNoise(this.ctx)
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume().catch(() => {})
      return this.ctx
    } catch {
      this.ctx = null
      return null
    }
  }

  private ready(): { ctx: AudioContext; out: GainNode } | null {
    if (this.muted) return null
    const ctx = this.ensure()
    if (!ctx || !this.master || ctx.state !== 'running') return null
    return { ctx, out: this.master }
  }

  private makeNoise(ctx: AudioContext): AudioBuffer {
    const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
    return buffer
  }

  private tone(
    freq: number,
    endFreq: number,
    duration: number,
    type: OscillatorType,
    gain: number,
    delay = 0,
  ): void {
    const r = this.ready()
    if (!r) return
    try {
      const { ctx, out } = r
      const t0 = ctx.currentTime + delay
      const osc = ctx.createOscillator()
      osc.type = type
      osc.frequency.setValueAtTime(freq, t0)
      if (endFreq !== freq) osc.frequency.exponentialRampToValueAtTime(Math.max(endFreq, 1), t0 + duration)
      const g = ctx.createGain()
      g.gain.setValueAtTime(0.0001, t0)
      g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012)
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration)
      osc.connect(g)
      g.connect(out)
      osc.start(t0)
      osc.stop(t0 + duration + 0.02)
    } catch {
      // 音频节点创建失败时静默
    }
  }

  private noise(
    duration: number,
    gain: number,
    filterType: BiquadFilterType,
    freq: number,
    endFreq?: number,
    delay = 0,
  ): void {
    const r = this.ready()
    if (!r || !this.noiseBuffer) return
    try {
      const { ctx, out } = r
      const t0 = ctx.currentTime + delay
      const src = ctx.createBufferSource()
      src.buffer = this.noiseBuffer
      src.loop = true
      const filter = ctx.createBiquadFilter()
      filter.type = filterType
      filter.frequency.setValueAtTime(freq, t0)
      if (endFreq) filter.frequency.exponentialRampToValueAtTime(Math.max(endFreq, 1), t0 + duration)
      filter.Q.value = 0.8
      const g = ctx.createGain()
      g.gain.setValueAtTime(0.0001, t0)
      g.gain.exponentialRampToValueAtTime(gain, t0 + 0.015)
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration)
      src.connect(filter)
      filter.connect(g)
      g.connect(out)
      src.start(t0)
      src.stop(t0 + duration + 0.02)
    } catch {
      // 音频节点创建失败时静默
    }
  }

  private chime(notes: number[], step = 0.11, gain = 0.15, type: OscillatorType = 'triangle'): void {
    notes.forEach((freq, i) => {
      this.tone(freq, freq, 0.24 + step, type, gain, i * step)
    })
  }
}
