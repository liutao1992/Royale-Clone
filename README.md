# Royale Clone

基于 **TypeScript + Three.js** 的皇室战争（Clash Royale）风格网页游戏。

- **确定性战斗模拟核心**：与渲染完全解耦，可无头运行、可复现（自带 `npm run sim` 与 45 项单元测试）
- **Three.js 表现层**：竞技场、Kenney CC0 骨骼动画角色、Lux3D 兵种/塔/废墟模型，加载失败自动回退程序化建模
- **皇室战争风格 UI**：金牌匾计时、圣水滴卡牌、蓝红血条、CR 式结算面板
- **音效系统**：Kenney CC0 采样（WebAudio 播放，离线可用），M 键静音
- **离线单文件版**：一条构建命令产出可直接双击运行、无需网络与服务器的独立 HTML

---

## 快速开始

**环境要求**：Node.js `^20.19.0` 或 `>=22.12.0`（推荐 22 LTS）。

```sh
npm ci          # 或 npm install
npm run dev     # 启动开发服务器（默认 http://localhost:5173）
```

打开终端提示的地址即可开始对局。

### 构建与离线版

```sh
npm run build
```

产物：

| 文件 | 说明 |
| --- | --- |
| `dist/index.html` | 普通网站版（需静态服务器；可 `npm run preview` 本地预览） |
| `dist/royale-offline.html` | 独立单文件版（约 56 MB），模型、纹理、脚本、样式全部内嵌，**双击直接打开**，无需服务器和网络，使用系统字体 |

---

## 玩法基础教程

### 目标

摧毁敌方 **国王塔**（3 皇冠，立即获胜）；或在 3 分钟常规时间结束时**皇冠更多**。

### 操作

1. 按住底部**手牌**拖动到竞技场，松开即可部署
2. 拖拽时地面显示预览圈：**绿色 = 合法，红色 = 非法**（会自动回手）
3. 部署有 1 秒等待时间，期间单位无法行动、可被法术命中
4. **圣水不足**的卡牌会灰显、不可拖拽

| 部署区域 | 规则 |
| --- | --- |
| 己方半场 | `y < 15`（河缘为止），排除塔身与建筑占位 |
| 破塔扩展 | 摧毁对方公主塔后，敌方半场**同侧**解锁约 5 格纵深 |
| 法术 | 全场任意位置（含河道上空） |

### 圣水

开局 5 点，上限 10 点；不足即灰卡。

| 阶段 | 时间 | 速率 |
| --- | --- | --- |
| 常规时间 | 0:00 → 2:00 | 1 点 / 2.8s |
| 双倍圣水 | 2:00 → 3:00 | 1 点 / 1.4s |
| 加时 | 3:00 → 5:00 | 1 点 / 约 0.9s |

### 时间轴与胜负

| 事件 | 结果 |
| --- | --- |
| 国王塔被毁（任意时刻） | 立即 3 皇冠获胜 |
| 常规时间结束 3:00 | 皇冠多者胜；相同则进入加时 |
| 加时 3:00 → 5:00 | **先摧毁任意一座塔者立即获胜** |
| 加时结束仍无塔被毁 | 决胜对耗：双方塔同步掉血，先毁者败 |

### 塔

- **公主塔 ×2**：开局即自动攻击（对空+对地），每毁一座得 **1 皇冠**，并激活己方国王塔、解锁对应侧部署区
- **国王塔 ×1**：初始不攻击；被伤害命中或己方任意公主塔被毁后激活
- 若摧毁国王塔 → 直接 3 皇冠结束

### 手牌循环

卡组 8 张、手牌 4 张、下一张预览 1 张；打出的卡进入**队尾**，严格 FIFO 循环。

初始卡组：骑士、弓箭手、巨人、火枪手、亡灵、火球、箭雨、加农炮。

---

## 项目结构

```
src/
  core/       战斗模拟核心（无渲染依赖，确定性；移动/索敌/攻击/塔/圣水/法术）
  render/     Three.js 表现层（竞技场、实体模型与动画、相机、模型库）
  ui/         DOM UI（HUD、手牌、拖拽部署、结算）
  game/       GameController：组装模拟与表现层
  ai/         敌方 AI 决策
public/models/  Kenney CC0 与 Lux3D 运行时模型（许可见 CREDITS.md）
docs/         机制契约（MECHANICS.md）/ 卡牌数值（CARDS.md）/ 素材接入（ASSET_INTEGRATION.md）
tests/        单元测试（vitest）+ E2E（Playwright）
scripts/      无头模拟、独立版构建、素材转换、截图工具
```

---

## 开发指南

### 常用命令

| 命令 | 说明 |
| --- | --- |
| `npm run dev` | 开发服务器（热更新） |
| `npm run build` | 类型检查 + 构建网站版与离线单文件版 |
| `npm run preview` | 本地预览 `dist/` |
| `npm run typecheck` | 仅类型检查 |
| `npm test` | 运行单元测试（vitest，45 项） |
| `npm run test:watch` | 单元测试 watch 模式 |
| `npm run test:e2e` | **先构建**再运行 Playwright E2E（10 项，需要本机安装 Chrome） |
| `npm run sim` | 无头对局模拟，例：`npm run sim -- 123`（可复现种子） |

### 调试

- DEV 模式会暴露 `window.__game`：`getState()`（对局/实体状态）、`fastForward(s)`（快进）、`tileToScreen(x, y)`（坐标换算）
- 实机截图：先 `npm run dev -- --port 5199`，再 `node scripts/capture.mjs [port]`，输出到 `artifacts/`

### 新增一张卡（简要步骤）

1. **数值**：在 `src/core/data/cards.ts` 添加 `CardDef`（伤害/血量/射程/速度等）
2. **手牌视觉**：在 `src/ui/HandBar.ts` 的 `CARD_VISUALS` 配置图标、底色与品质
3. **3D 表现（可选）**：
   - 挂 GLB 模型/配件：`src/render/ModelActors.ts` 的 `UNIT_MODEL_CONF`
   - 或程序化建模：`src/render/CharacterMeshes.ts`
   - 找不到模型时会自动回退，不影响运行
4. **牌组**：`DEFAULT_PLAYER_DECK` / `DEFAULT_ENEMY_DECK`
5. **测试**：在 `tests/` 补充用例并运行 `npm test`

### 文档

- [`docs/MECHANICS.md`](docs/MECHANICS.md) — 战斗机制契约（时间轴、圣水、塔、部署、胜负）
- [`docs/CARDS.md`](docs/CARDS.md) — 卡牌与塔数值表（L11 基准）
- [`docs/ASSET_INTEGRATION.md`](docs/ASSET_INTEGRATION.md) — Lux3D 素材接入与重新生成流程

---

## 素材与许可

- **Kenney**（角色、武器、塔件、加农炮）：CC0 1.0，见 [`public/models/CREDITS.md`](public/models/CREDITS.md)
- **Kenney 音效**（部署、打击、法术、胜负吉令）：CC0 1.0，见 [`public/audio/CREDITS.md`](public/audio/CREDITS.md)
- **Lux3D** 兵种/塔/场景/废墟模型：接入说明见 [`docs/ASSET_INTEGRATION.md`](docs/ASSET_INTEGRATION.md)
- 其余美术与 UI 为本项目程序化生成；数值快照来源见 `docs/MECHANICS.md` 附录
