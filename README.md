# 掼蛋 Web 游戏

> 经典升级扑克 · 4 人对战 · 智能 AI 陪练 · 深色豪华界面

一款运行在浏览器中的掼蛋（升级）在线游戏，玩家可以与 3 个 AI 对手进行完整的四人对战，支持账号登录、对局历史记录与个人统计。AI 逻辑参考 [Danzero+](https://github.com/submit-paper/Danzero_plus) 开源项目，将其状态编码、手牌分析与策略决策逻辑移植为 TypeScript，在浏览器端直接运行。

---

## 功能特性

| 模块 | 说明 |
|------|------|
| **完整掼蛋规则** | 支持单张、对子、三张、顺子、连对、三带、炸弹、王炸等全部牌型，含级牌（万能牌）逻辑 |
| **智能 AI 对手** | 3 个 AI 玩家，基于 Danzero+ 策略逻辑，具备首出策略、接牌判断、炸弹保留、队友协作等能力 |
| **便捷出牌交互** | 单击即出单张；双击全选同点数；智能推荐条一键出多张；支持空格/Enter 出牌、P 键不要、Escape 取消 |
| **牌谱侧边栏** | 实时记录每手出牌，支持按回合分组折叠、按玩家筛选，并可切换「明细」/「汇总」视图 |
| **汇总视图** | 显示各玩家出牌次数、炸弹数、不要次数，以及各牌型出现频次与代表牌面 |
| **对局历史** | 自动保存每局对战结果，可查看历史战绩与详细牌谱 |
| **个人统计** | 展示胜率、升级进度、成就系统等数据 |
| **账号系统** | 基于 Manus OAuth 的一键登录，数据云端持久化 |

---

## 技术架构

本项目采用前后端同构的全栈架构，所有接口通过 tRPC 定义，类型端到端共享，无需手写 REST 路由或接口文档。

```
掼蛋 Web 游戏
├── 前端（React 19 + Vite 7 + Tailwind CSS 4）
│   ├── 游戏大厅     GameLobby.tsx   — 开始游戏、查看历史、规则说明
│   ├── 游戏桌面     GameTable.tsx   — 核心游戏界面，含牌谱侧边栏
│   ├── 对局历史     GameHistory.tsx — 历史战绩列表与详情
│   ├── 个人统计     Statistics.tsx  — 数据可视化与成就
│   └── 游戏规则     Rules.tsx       — 掼蛋规则说明
├── 游戏引擎（纯 TypeScript，前后端共用）
│   ├── gameEngine.ts  — 牌型识别、合法性校验、发牌、升级逻辑
│   └── danzeroAI.ts   — Danzero+ AI 策略（状态编码 + 决策逻辑）
└── 后端（Express 4 + tRPC 11 + Drizzle ORM）
    ├── routers.ts     — tRPC 路由（认证 + 游戏存档）
    ├── gameRouter.ts  — 游戏相关接口
    └── db.ts          — 数据库查询封装
```

### 主要技术栈

| 层级 | 技术 | 版本 |
|------|------|------|
| 前端框架 | React | 19 |
| 构建工具 | Vite | 7 |
| 样式方案 | Tailwind CSS | 4 |
| UI 组件 | shadcn/ui + Radix UI | — |
| 图标库 | lucide-react | 0.453 |
| 接口层 | tRPC | 11 |
| 数据请求 | TanStack Query | 5 |
| 后端框架 | Express | 4 |
| ORM | Drizzle ORM | 0.44 |
| 数据库 | MySQL / TiDB | — |
| 测试框架 | Vitest | 2 |
| 语言 | TypeScript | 5.9 |

---

## AI 实现说明

本项目的 AI 逻辑参考 [Danzero+](https://github.com/submit-paper/Danzero_plus) 开源项目（论文：*DanZero: Mastering GuanDan Game with Reinforcement Learning*），将其非神经网络部分移植为 TypeScript，在浏览器端直接运行，无需额外服务器。

移植内容位于 `client/src/lib/danzeroAI.ts`，具体包括：

**状态编码**（对应 Danzero+ `game.py` / `utils.py`）

- `card2num`：将扑克牌转换为 Danzero+ 数字编号（0–53，含级牌和王牌特殊编号）
- `card2array`：将数字编号数组转换为 54 维 one-hot 计数向量（column-major 展平）
- `procUniversal`：生成万能牌（级牌）标志向量，用于标记手牌中的通配牌
- `buildStateVector`：构建完整的 432 维观测状态向量，包含自己手牌、其他玩家估计手牌、历史出牌、剩余牌数等信息

**手牌分析**（对应 Danzero+ `utils.py combine_handcards`）

- `combineHandcards`：将手牌按牌型分组（单张、对子、三张、炸弹、顺子、同花顺），为决策提供结构化输入

**决策策略**（对应 Danzero+ `actor.py` 启发式逻辑）

- `chooseBestFirstPlay`：首出策略，优先出顺子/连对清理手牌，保留炸弹
- `chooseBestResponse`：接牌策略，综合考虑队友协作（队友是上家时考虑不接）、炸弹使用时机、最小代价压牌

**历史追踪**

- `createDanzeroHistory` / `updateDanzeroHistory`：追踪各玩家历史出牌、剩余牌数和已出完玩家，支持对手手牌估计

> **注意**：Danzero+ 原版使用 TensorFlow 1.x / PyTorch 神经网络权重进行深度强化学习推理，该部分无法直接在浏览器运行。本项目移植的是其**规则与编码层**，AI 强度低于原版深度学习模型，但策略质量显著优于简单贪心算法。如需接入原版神经网络，可将 PyTorch 模型导出为 ONNX 格式，通过 `onnxruntime-web` 在浏览器端加载。

---

## 本地开发

### 环境要求

- Node.js 22+
- pnpm 9+
- MySQL 8.0+ 或 TiDB（需配置 `DATABASE_URL` 环境变量）

### 快速启动

```bash
# 克隆项目
git clone <仓库地址>
cd guandan-game

# 安装依赖
pnpm install

# 配置环境变量（复制示例文件后填写）
cp .env.example .env

# 执行数据库迁移
pnpm drizzle-kit generate
# 将生成的 SQL 文件应用到数据库

# 启动开发服务器
pnpm dev
```

开发服务器启动后，访问 `http://localhost:3000` 即可进入游戏。

### 常用命令

| 命令 | 说明 |
|------|------|
| `pnpm dev` | 启动开发服务器（前后端同时热更新） |
| `pnpm build` | 构建生产版本 |
| `pnpm test` | 运行所有单元测试（60 个测试用例） |
| `pnpm test --run` | 单次运行测试（不监听文件变化） |
| `pnpm drizzle-kit generate` | 根据 Schema 生成数据库迁移 SQL |
| `pnpm drizzle-kit studio` | 打开 Drizzle Studio 可视化数据库管理界面 |

### 项目结构

```
guandan-game/
├── client/                  # 前端代码
│   ├── src/
│   │   ├── pages/           # 页面组件（GameTable、GameLobby 等）
│   │   ├── components/      # 通用 UI 组件（shadcn/ui）
│   │   ├── lib/
│   │   │   ├── gameEngine.ts  # 游戏引擎（牌型识别、规则校验）
│   │   │   ├── danzeroAI.ts   # Danzero+ AI 逻辑（TypeScript 移植）
│   │   │   └── trpc.ts        # tRPC 客户端绑定
│   │   ├── App.tsx            # 路由配置
│   │   └── index.css          # 全局样式与主题变量
│   └── index.html
├── server/                  # 后端代码
│   ├── routers.ts           # tRPC 路由定义
│   ├── gameRouter.ts        # 游戏相关接口
│   ├── db.ts                # 数据库查询封装
│   ├── gameEngine.ts        # 服务端游戏引擎
│   ├── *.test.ts            # 单元测试文件
│   └── _core/               # 框架核心（OAuth、tRPC 上下文等）
├── drizzle/                 # 数据库 Schema 与迁移文件
├── shared/                  # 前后端共用类型定义
│   └── types.ts             # Card、GameState、PlayerPosition 等
└── todo.md                  # 功能开发进度追踪
```

---

## 测试覆盖

项目共包含 **60 个单元测试**，分布在 5 个测试文件中：

| 测试文件 | 覆盖内容 | 用例数 |
|----------|----------|--------|
| `server/gameEngine.test.ts` | 牌型识别、合法性校验、升级逻辑 | 16 |
| `server/gameEngine.frontend.test.ts` | 前端游戏引擎逻辑 | 17 |
| `server/danzeroAI.test.ts` | Danzero+ AI 状态编码与决策逻辑 | 18 |
| `server/gameRouter.test.ts` | 游戏接口路由 | 8 |
| `server/auth.logout.test.ts` | 认证登出流程 | 1 |

---

## 开发路线图

以下是计划中或可进一步扩展的功能方向：

- **ONNX 神经网络推理**：将 Danzero+ PyTorch 模型导出为 ONNX，通过 `onnxruntime-web` 在浏览器端运行，实现真正的深度强化学习 AI
- **AI 难度分级**：简单（规则 AI）/ 普通（当前策略）/ 困难（ONNX 模型）三档难度选择
- **出牌动画**：牌从手牌区飞向中央出牌区的动效，增强操作反馈
- **音效系统**：洗牌、出牌、炸弹、胜利等场景音效
- **排行榜**：基于胜率/积分的全服排行榜
- **多人联机**：通过 WebSocket 实现真人 4 人联机对战

---

## 参考资料

本项目 AI 逻辑参考以下开源项目与论文：

- [Danzero+](https://github.com/submit-paper/Danzero_plus) — 基于深度强化学习的掼蛋 AI 开源实现
- *DanZero: Mastering GuanDan Game with Reinforcement Learning* — Danzero 原始论文

---

## 许可证

本项目仅供学习与个人娱乐使用。掼蛋游戏规则属于公共领域，AI 逻辑参考自 Danzero+ 开源项目（请遵循其原始许可证）。
