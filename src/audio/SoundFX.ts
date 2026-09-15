/**
 * 音效系统：Kenney CC0 采样播放（见 public/audio/CREDITS.md），
 * 采样缺失/解码失败时回退到 WebAudio 合成音，离线可用、无网络请求。
 * - load() 预载全部采样（支持断网单文件模式的内嵌资源映射）
 * - 首次用户手势（点击/按键）时解锁 AudioContext
 * - M 键或左上角按钮静音，偏好写入 localStorage
 * - 所有播放路径捕获异常，绝不向页面抛出错误
 */
export class SoundFX {
  static readonly instance = new SoundFX()

  private static readonly MUTE_KEY = 'royale:muted'

  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private noiseBuffer: AudioBuffer | null = null
  private muted = false
  private lastHitAt = 0
  private readonly samples = new Map<string, AudioBuffer>()
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

  // ---------- 预载 ----------

  /** 预载全部采样；单个失败仅告警。可安全重复调用。 */
  load(onProgress?: (done: number, total: number) => void): Promise<void> {
    const entries = Object.entries(SAMPLE_FILES)
    let done = 0
    const ctx = this.ensure()
    if (!ctx) {
      onProgress?.(entries.length, entries.length)
      return Promise.resolve()
    }
    return Promise.allSettled(
      entries.map(async ([key, path]) => {
        try {
          const res = await fetch(this.assetUrl(path))
          const buffer = await ctx.decodeAudioData(await res.arrayBuffer())
          this.samples.set(key, buffer)
        } finally {
          onProgress?.(++done, entries.length)
        }
      }),
    ).then(() => undefined)
  }

  /** 采样 URL：优先读取单文件版内嵌资源，其次按 BASE_URL 加载 */
  private assetUrl(path: string): string {
    const embedded = (globalThis as typeof globalThis & { __ROYALE_ASSETS__?: Record<string, string> })
      .__ROYALE_ASSETS__
    if (embedded?.[path]) return embedded[path]
    return `${import.meta.env.BASE_URL}${path}`
  }

  // ---------- 事件音效 ----------

  /** 拖起手牌 */
  pickup(): void {
    if (this.play('pickup', { gain: 0.45 })) return
    this.tone(520, 520, 0.05, 'square', 0.05)
  }

  /** 部署部队：布料声 + 落地闷响 */
  deploy(): void {
    const ok = this.play('deployCloth', { gain: 0.5 })
    const land = this.play(this.pickTake('land'), { gain: 0.55, delay: 0.05, rate: this.jitter() })
    if (!ok && !land) {
      this.noise(0.22, 0.24, 'bandpass', 900, 260)
      this.tone(220, 110, 0.18, 'sine', 0.13)
    }
  }

  /** 法术：施放呼啸 + 延迟落点爆炸（按法术飞行时间） */
  spellCast(impactDelay: number): void {
    const ok = this.play('castWhoosh', { gain: 0.5 })
    const boom = this.play('explosion0', { gain: 0.65, delay: Math.max(0, impactDelay) })
    if (!ok && !boom) {
      this.noise(0.5, 0.3, 'lowpass', 900, 140)
      this.tone(170, 48, 0.42, 'sine', 0.24)
    }
  }

  /** 箭雨：呼啸 + 三波落点 */
  arrows(impactDelay: number, waveInterval: number): void {
    const ok = this.play('arrowsWhoosh', { gain: 0.45 })
    let landed = false
    for (let i = 0; i < 3; i++) {
      const hit = this.play(this.pickTake('land'), {
        gain: 0.42,
        delay: Math.max(0, impactDelay) + i * Math.max(0.05, waveInterval),
        rate: 0.9 * this.jitter(),
      })
      landed = landed || hit
    }
    if (!ok && !landed) {
      this.noise(0.34, 0.18, 'bandpass', 2200, 700)
    }
  }

  /** 电击 */
  zap(): void {
    if (this.play('zap', { gain: 0.55 })) return
    this.tone(1500, 320, 0.13, 'square', 0.09)
    this.noise(0.11, 0.16, 'highpass', 2200)
  }

  /** 塔受击（节流，避免连射噪音） */
  hitTower(): void {
    const now = performance.now()
    if (now - this.lastHitAt < 130) return
    this.lastHitAt = now
    if (this.play(this.pickTake('towerHit'), { gain: 0.4, rate: this.jitter() })) return
    this.tone(150, 72, 0.12, 'sine', 0.14)
    this.noise(0.06, 0.08, 'lowpass', 500)
  }

  /** 塔被摧毁：爆破 + 碎石 + 皇冠钟声 */
  towerDown(): void {
    const boom = this.play('towerDestroy', { gain: 0.8 })
    const rubble = this.play('towerRubble', { gain: 0.55, delay: 0.03 })
    const bell = this.play('crownBell', { gain: 0.45, delay: 0.26 })
    if (boom || rubble || bell) return
    this.noise(0.6, 0.36, 'lowpass', 700, 110)
    this.tone(110, 40, 0.55, 'sine', 0.28)
    this.chime([880, 1174.7])
  }

  /** 满圣水提示 */
  elixirFull(): void {
    if (this.play('elixirFull', { gain: 0.5 })) return
    this.chime([880, 1318.5], 0.07, 0.12)
  }

  victory(): void {
    if (this.play('victory', { gain: 0.6 })) return
    this.chime([523.3, 659.3, 784, 1046.5])
  }

  defeat(): void {
    if (this.play('defeat', { gain: 0.6 })) return
    this.chime([392, 329.6, 261.6, 196], 0.13, 0.16, 'sine')
  }

  draw(): void {
    if (this.play('draw', { gain: 0.55 })) return
    this.chime([440, 440], 0.15, 0.16, 'sine')
  }

  // ---------- 采样播放 ----------

  private pickTake(kind: 'land' | 'towerHit'): string {
    const takes: Record<typeof kind, readonly string[]> = {
      land: ['land0', 'land1', 'land2'],
      towerHit: ['towerHit0', 'towerHit1', 'towerHit2'],
    }
    const list = takes[kind]
    return list[Math.floor(Math.random() * list.length)]
  }

  private jitter(): number {
    return 0.96 + Math.random() * 0.08
  }

  /** 播放采样；采样缺失或静音时返回 false */
  private play(key: string, opts: { gain?: number; rate?: number; delay?: number } = {}): boolean {
    const buffer = this.samples.get(key)
    if (!buffer) return false
    const r = this.ready()
    if (!r) return !this.muted
    try {
      const { ctx, out } = r
      const src = ctx.createBufferSource()
      src.buffer = buffer
      src.playbackRate.value = opts.rate ?? 1
      const g = ctx.createGain()
      g.gain.value = Math.min(opts.gain ?? 0.5, 1)
      src.connect(g)
      g.connect(out)
      src.start(ctx.currentTime + Math.max(0, opts.delay ?? 0))
    } catch {
      // 播放失败静默
    }
    return true
  }

  // ---------- 合成兜底 ----------

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

/** 采样清单：逻辑键 → public/audio 下路径 */
const SAMPLE_FILES = {
  pickup: 'audio/ui/pickup.ogg',
  elixirFull: 'audio/ui/elixir-full.ogg',
  deployCloth: 'audio/deploy/cloth.ogg',
  land0: 'audio/deploy/land-0.ogg',
  land1: 'audio/deploy/land-1.ogg',
  land2: 'audio/deploy/land-2.ogg',
  castWhoosh: 'audio/spells/cast-whoosh.ogg',
  arrowsWhoosh: 'audio/spells/arrows-whoosh.ogg',
  explosion0: 'audio/spells/explosion-0.ogg',
  zap: 'audio/spells/zap.ogg',
  towerHit0: 'audio/tower/hit-0.ogg',
  towerHit1: 'audio/tower/hit-1.ogg',
  towerHit2: 'audio/tower/hit-2.ogg',
  towerDestroy: 'audio/tower/destroy.ogg',
  towerRubble: 'audio/tower/rubble.ogg',
  crownBell: 'audio/tower/crown-bell.ogg',
  victory: 'audio/jingles/victory.ogg',
  defeat: 'audio/jingles/defeat.ogg',
  draw: 'audio/jingles/draw.ogg',
} as const
