# 卡牌与塔数值表（CARDS.md）

> 配套文档：`docs/MECHANICS.md`（机制规则）｜本文档只负责数值。
>
> **数值基准**：当前游戏锦标赛标准（Level 11，等同旧编号 9 级内容强度）。
> **数据快照**：Fandom 等级表 L11 行；2026 年若干官方微调列于附录 A，正文暂未纳入。
>
> 单位约定：HP/伤害为整数；速度单位 tiles/min；射程/视野/半径单位 tiles；
> 时间单位秒；投射物速度单位 tiles/min。

---

## 1. 塔数值

| 属性 | 公主塔 | 国王塔 |
|---|---|---|
| 尺寸 | 3×3 | 4×4（距底线 1 tile） |
| 生命值 | 3052 | 4824 |
| 伤害 | 109 | 109 |
| 攻击速度 | 0.8s | 1.0s |
| DPS | 136 | 109 |
| 射程 | 7.5 | 7 |
| 视野 | 7.5（=射程） | 7（=射程，激活后） |
| 目标 | 空中 & 地面 | 空中 & 地面 |
| 投射物速度 | 600 | 1000 |
| 碰撞半径 | 1.0 | 1.4 |
| 初始状态 | 激活 | **休眠**（被伤害或己方公主塔被毁后激活） |

---

## 2. 部队与建筑卡总表（14 张 roster 中的 11 张部队/建筑）

| 卡牌 | 费用 | 数量 | 生命 | 伤害 | 攻击间隔 | 首攻 | 射程 | 速度 | 目标 | 部署 | 溅射半径 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Knight | 3 | ×1 | 1766 | 202 | 1.2 | 0.5 | 1.2（Melee Med） | 60 Medium | 地面 | 1s | — |
| Valkyrie | 4 | ×1 | 1907 | 266 | 1.5 | 0.5 [待校准] | 1.2（Melee Med） | 60 Medium | 地面 | 1s | 2.0（360°） |
| Giant | 5 | ×1 | 3968 | 253 | 1.5 | 0.5 | 1.2（Melee Med） | 45 Slow | **建筑** | 1s | — |
| Hog Rider | 4 | ×1 | 1697 | 317 | 1.6 | 0.6 | 0.8（Melee Short） | 120 Very Fast | **建筑** | 1s | — |
| Musketeer | 4 | ×1 | 721 | 217 | 1.0 | 0.7 | 6.0 | 60 Medium | 空中 & 地面 | 1s | — |
| Archers | 3 | ×2 | 304 | 112 | 0.9 | 0.5 | 5.0 | 60 Medium | 空中 & 地面 | 1s | — |
| Bomber | 2 | ×1 | 304 | 225 | 1.8 | 0.2 [待校准] | 4.5 | 60 Medium | 地面 | 1s | 1.5 |
| Minions | 3 | ×3 | 230 | 107 | 1.2 | 0.5 | 2.5 | 90 Fast | 空中 & 地面 | 1s | — |
| Goblins | 2 | ×4 | 202 | 120 | 1.1 | 0.6 | 0.5（Melee Short） | 120 Very Fast | 地面 | 1s | — |
| Baby Dragon | 4 | ×1 | 1152 | 168 | 1.5 | 0.3 | 3.5 | 90 Fast | 空中 & 地面 | 1s | 1.5 |
| Cannon | 3 | ×1 建筑 | 824 | 212 | 1.0 | 1.0 | 5.5 | 0（建筑） | 地面 | 1s | — |

补充说明：

- **Minions / Baby Dragon** 是空中单位（`layer = air`）。
- **Cannon** 生命值以 `824 / 30s ≈ 27.5 HP/s` 自然流逝（部署完成后开始），寿命 30s。
- **Hog Rider** 可跳河；**Giant / Hog Rider** 为建筑目标单位，永不攻击部队。

### DPS 参考（平衡校验用）

| 卡 | 单体 DPS | 整卡 DPS |
|---|---|---|
| Knight | 168 | 168 |
| Valkyrie | 177 | 177 |
| Giant | 169 | 169 |
| Hog Rider | 198 | 198 |
| Musketeer | 217 | 217 |
| Archers | 124 / 只 | 249（两只） |
| Bomber | 125 | 125 |
| Minions | 89 / 只 | 267（三只） |
| Goblins | 109 / 只 | 436（四只） |
| Baby Dragon | 112 | 112 |
| Cannon | 212 | 212 |

---

## 3. 法术卡（3 张）

| 法术 | 费用 | 伤害 | 半径 | 对塔伤害 | 弹道速度 | 特殊效果 |
|---|---|---|---|---|---|---|
| Fireball | 4 | 688 | 2.5 | 207（≈30%） | 600 | 击退 1 tile + 真眩晕（重置攻击动画） |
| Arrows | 3 | 366（122 × 3 波） | 3.5 | 93（≈25%） | 1100 | 3 波依次落下，分波结算 |
| Zap | 2 | 192 | 2.5 | 58（≈30%） | 瞬发 | 眩晕 0.5s（重置攻击动画，打断蓄力/引导） |

- 法术目标：空中 & 地面。
- 法术可放置于全场任意位置（含河道）。
- 对塔伤害为独立数值（不按比例实时计算）。

---

## 4. 隐藏属性表

### 4.1 质量（Mass，决定推挤）

| 单位 | Mass |
|---|---|
| Minions | 2 |
| Goblins | 2 |
| Archers | 3 |
| Hog Rider | 4 |
| Bomber | 4 |
| Musketeer | 5 |
| Valkyrie | 5 |
| Baby Dragon | 5 |
| Knight | 6 |
| Giant | 18 |

> 塔与建筑不可被推动；数值取自 Fandom 隐藏属性系列。

### 4.2 碰撞半径

| 单位 | 半径（tiles） |
|---|---|
| 大部分部队（Knight/Archers/Musketeer/Bomber/Valkyrie/Minions/Goblins/Baby Dragon） | 0.5 |
| Hog Rider | 0.6 |
| Cannon | 0.6 |
| Giant | 0.75 |
| 公主塔 | 1.0 |
| 国王塔 | 1.4 |

### 4.3 视野（Sight Range）

| 视野 | 单位 |
|---|---|
| 5.5 | Knight、Valkyrie、Goblins、Minions、Bomber、Baby Dragon、Archers |
| 6.0 | Musketeer |
| 7.5 | Giant |
| 9.5 | Hog Rider |
| = 射程 | Cannon（5.5）、公主塔（7.5）、国王塔（7） |

### 4.4 投射物速度

| 来源 | 速度（tiles/min） |
|---|---|
| Archers | 600 |
| Bomber | 400 |
| Musketeer | 1000 |
| Minions | 1000 |
| Baby Dragon | 1000 [待校准：另说 500] |
| Cannon | 1000 |
| 公主塔 | 600 |
| 国王塔 | 1000 |
| Fireball | 600 |
| Arrows | 1100 |

### 4.5 首攻时间（First Hit = HitSpeed − LoadTime）

| 单位 | 首攻 | 装填上限 |
|---|---|---|
| Baby Dragon | 0.3 | 1.2 |
| Knight | 0.5 | 0.7 |
| Giant | 0.5 | 1.0 |
| Minions | 0.5 | 0.5 |
| Archers | 0.5 | 1.1 |
| Goblins | 0.6 | 0.9 |
| Hog Rider | 0.6 | 1.0 |
| Musketeer | 0.7 | 0.3 |
| Cannon | 1.0 | 0.6 |
| Valkyrie | 0.5 [待校准] | — |
| Bomber | 0.2 [待校准] | — |
| 国王塔 | 0.5 | 0.5 |
| 公主塔 | 无装填（首攻 = 0.8） | — |

---

## 5. 卡牌机制备注

| 卡牌 | 要点 |
|---|---|
| Knight | 单体近战标准件；无特殊机制 |
| Valkyrie | 360° 溅射 2.0 tiles；仅命中地面 |
| Giant | 建筑目标；仅攻击建筑；被部队阻挡时不反击 |
| Hog Rider | 建筑目标；游戏中最快速度之一；可跳河 |
| Musketeer | 单体远程；射程 6；对空 |
| Archers | 2 只一组横排部署，第 2 只晚 0.1s 出生；对空 |
| Bomber | 远程溅射（1.5 tiles）；仅对地；投掷炸弹有弹道 |
| Minions | 3 只一组（间隔 0.1s）；空中；对空 |
| Goblins | 4 只方阵（间隔 0.2s）；高速；近战 |
| Baby Dragon | 空中 + 溅射；对空 |
| Cannon | 建筑；仅对地；寿命 30s；被建筑目标单位优先锁定 |
| Fireball | 击退 + 真眩晕；对塔 207 |
| Arrows | 3 波分次结算；对塔 93 |
| Zap | 瞬发；眩晕 0.5s；对塔 58 |

---

## 附录 A：2026 年官方微调差异（正文未纳入）

| 卡牌 | 快照值 | 2026 官方改动 | 日期 |
|---|---|---|---|
| Goblins | 伤害 120 | → 125（+4%） | 2026-08-04 |
| Cannon | 伤害 212 | → 202（-5%） | 2026-04-07 |
| Bomber | 伤害 225 | → 212（-6%） | 2026-09-08 |
| Fireball | 对塔 207 | → 172（-17%） | 2026-06-01 |
| Fireball | 对塔 172 | → 159（-8%） | 2026-09-08 |
| Arrows | 对塔 93 | → 75（-19%） | 2026-06-01 |
| Zap | 对塔 58 | → 48（-17%） | 2026-06-01 |

> 决策点（待校准 #14）：采用快照值保持数据同源，或刷新到最新官方值。

## 附录 B：数据来源

- Fandom Clash Royale Wiki 卡片页（卡牌数值、隐藏属性系列：Mass / Collision radius / Sight range / First attack speed / Projectile travel speeds）
- RoyaleAPI Blog《Secret Stats》（Hit Time / Load Time 模型）
- Liquipedia Clash Royale（塔数值、等级体系）
- Supercell 官方更新公告（平衡性改动、对局规则）
