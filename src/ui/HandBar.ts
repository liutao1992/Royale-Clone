import type { TeamState } from '../core/types'
import { ALL_CARDS } from '../core/data/cards'

interface CardElement {
  root: HTMLElement
  artEl: HTMLElement
  costEl: HTMLElement
  nameEl: HTMLElement
  iconEl: HTMLElement
}

type Rarity = 'common' | 'rare' | 'epic'

interface CardVisual {
  icon: string
  bg: string
  rarity: Rarity
}

/** 卡面视觉：图标 + 场景底色 + 品质（与皇室战争品质色对齐） */
const CARD_VISUALS: Record<string, CardVisual> = {
  knight: {
    icon: '🛡️',
    bg: 'linear-gradient(165deg, #89adda 0%, #3d5a85 58%, #22334e 100%)',
    rarity: 'common',
  },
  valkyrie: {
    icon: '🪓',
    bg: 'linear-gradient(165deg, #f5b56a 0%, #b56534 58%, #65301a 100%)',
    rarity: 'rare',
  },
  giant: {
    icon: '🗿',
    bg: 'linear-gradient(165deg, #dca661 0%, #a05f2c 58%, #5c3414 100%)',
    rarity: 'rare',
  },
  'hog-rider': {
    icon: '🐗',
    bg: 'linear-gradient(165deg, #93d8ec 0%, #4a8fb5 58%, #28567a 100%)',
    rarity: 'rare',
  },
  musketeer: {
    icon: '🔫',
    bg: 'linear-gradient(165deg, #a3b8ec 0%, #5a6fb5 58%, #313f7e 100%)',
    rarity: 'rare',
  },
  archers: {
    icon: '🏹',
    bg: 'linear-gradient(165deg, #ace8a2 0%, #5aa855 58%, #2d662c 100%)',
    rarity: 'common',
  },
  bomber: {
    icon: '💣',
    bg: 'linear-gradient(165deg, #cbd7ee 0%, #6a7a9e 58%, #38426a 100%)',
    rarity: 'common',
  },
  minions: {
    icon: '🦇',
    bg: 'linear-gradient(165deg, #ba95ec 0%, #6a4ab5 58%, #37226a 100%)',
    rarity: 'common',
  },
  goblins: {
    icon: '👺',
    bg: 'linear-gradient(165deg, #b8ea60 0%, #5a9e2a 58%, #2c5a12 100%)',
    rarity: 'common',
  },
  'baby-dragon': {
    icon: '🐉',
    bg: 'linear-gradient(165deg, #93dcf8 0%, #4a9ec5 58%, #23567a 100%)',
    rarity: 'epic',
  },
  cannon: {
    icon: '💥',
    bg: 'linear-gradient(165deg, #dcc9aa 0%, #8a6a45 58%, #4c3520 100%)',
    rarity: 'common',
  },
  fireball: {
    icon: '🔥',
    bg: 'linear-gradient(165deg, #ffb45f 0%, #e8542a 58%, #842410 100%)',
    rarity: 'rare',
  },
  arrows: {
    icon: '🏹',
    bg: 'linear-gradient(165deg, #ffe893 0%, #e8a52a 58%, #8a5a10 100%)',
    rarity: 'common',
  },
  zap: {
    icon: '⚡',
    bg: 'linear-gradient(165deg, #c4ecff 0%, #4aa8e8 58%, #1a549e 100%)',
    rarity: 'common',
  },
}

const FALLBACK_VISUAL: CardVisual = {
  icon: '❓',
  bg: 'linear-gradient(165deg, #7d8ba1 0%, #2f3c52 100%)',
  rarity: 'common',
}

/** 底部手牌栏 + 圣水条 */
export class HandBar {
  readonly handEl: HTMLElement

  private readonly elixirCells: HTMLElement[]
  private readonly countEl: HTMLElement
  private readonly cards: CardElement[] = []
  private readonly nextCard: CardElement
  private lastElixir = -1

  constructor() {
    this.handEl = requireEl('hand')
    this.elixirCells = Array.from(document.querySelectorAll<HTMLElement>('.elixir-cell'))
    this.countEl = requireEl('elixir-count')

    const cardEls = Array.from(this.handEl.querySelectorAll<HTMLElement>('.card[data-slot]'))
    for (const el of cardEls) {
      this.cards.push({
        root: el,
        artEl: el.querySelector<HTMLElement>('.card-art')!,
        costEl: el.querySelector<HTMLElement>('.card-cost')!,
        nameEl: el.querySelector<HTMLElement>('.card-name')!,
        iconEl: el.querySelector<HTMLElement>('.card-icon')!,
      })
    }

    const nextEl = this.handEl.querySelector<HTMLElement>('.card.next')!
    this.nextCard = {
      root: nextEl,
      artEl: nextEl.querySelector<HTMLElement>('.card-art')!,
      costEl: nextEl.querySelector<HTMLElement>('.card-cost')!,
      nameEl: nextEl.querySelector<HTMLElement>('.card-name')!,
      iconEl: nextEl.querySelector<HTMLElement>('.card-icon')!,
    }
  }

  update(team: TeamState): void {
    // 圣水：整数滴 + 当前滴进度
    const elixir = Math.min(team.elixir, 10)
    const whole = Math.floor(elixir)
    const frac = elixir - whole
    if (Math.abs(elixir - this.lastElixir) > 0.01) {
      this.lastElixir = elixir
      for (let i = 0; i < this.elixirCells.length; i++) {
        const cell = this.elixirCells[i]
        const fill = i < whole ? 1 : i === whole ? frac : 0
        cell.style.setProperty('--fill', `${Math.round(fill * 100)}%`)
        cell.classList.toggle('full', fill >= 1)
      }
      this.countEl.textContent = String(whole)
    }

    // 手牌
    for (let i = 0; i < this.cards.length; i++) {
      const cardId = team.hand[i]
      applyCard(this.cards[i], cardId)
      const def = cardId ? ALL_CARDS[cardId] : undefined
      const playable = !!def && team.elixir >= def.cost
      this.cards[i].root.classList.toggle('disabled', !playable)
    }

    applyCard(this.nextCard, team.nextCard)
  }
}

function applyCard(el: CardElement, cardId: string | undefined): void {
  const def = cardId ? ALL_CARDS[cardId] : undefined
  if (!def) {
    applyVisual(el, FALLBACK_VISUAL)
    el.nameEl.textContent = '—'
    el.costEl.textContent = ''
    return
  }
  applyVisual(el, CARD_VISUALS[def.id] ?? FALLBACK_VISUAL)
  el.nameEl.textContent = def.name
  el.costEl.textContent = String(def.cost)
  el.root.dataset.cardId = def.id
}

function applyVisual(el: CardElement, visual: CardVisual): void {
  el.root.dataset.rarity = visual.rarity
  el.artEl.style.setProperty('--art-bg', visual.bg)
  el.iconEl.textContent = visual.icon
}

function requireEl(id: string): HTMLElement {
  const el = document.getElementById(id)
  if (!el) throw new Error(`缺少 UI 元素 #${id}`)
  return el
}
