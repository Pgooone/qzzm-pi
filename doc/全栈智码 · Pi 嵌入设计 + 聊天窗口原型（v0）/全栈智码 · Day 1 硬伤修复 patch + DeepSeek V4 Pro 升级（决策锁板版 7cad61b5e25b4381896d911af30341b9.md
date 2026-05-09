# 全栈智码 · Day 1 硬伤修复 patch + DeepSeek V4 Pro 升级（决策锁板版）

<aside>
🚨

**重要更正 · DeepSeek V4 Pro 是真的存在的，我上一页错了**

刚联网查证：DeepSeek 在 **2026-04-24** 发布了 V4 预览版，包括：

- `deepseek-v4-pro` （1.6T 总参 / 49B 激活，1M 上下文，开源 SOTA Agent）
- `deepseek-v4-flash` （284B / 13B，1M 上下文，价格屠夫）

**两个都是 hybrid 思考/非思考双模式**，同一个模型通过 `reasoning_effort: high|max` 切换。

✅ modelConfig.ts 里的 "DeepSeek V4 Pro" 名字是对的，Claude Code 不是误改，是我知识过期了。

⚠️ 但仓库里 model **id 写的是 `deepseek-chat`**，这个别名现在实际路由到 `deepseek-v4-flash` 的非思考模式，并将于 **2026-07-24 停用**。**你这 7 天跑的其实不是 V4 Pro，是 V4 Flash**。

**§F 决策反转为**：拥抱 V4 Pro/Flash，手工升级 model id 到 `deepseek-v4-pro` / `deepseek-v4-flash`，不再依赖 deprecated 别名。

</aside>

## 一、决策锁板（A-F 全部锁定）

| 决策 | 锁定结果 | 备注 |
| --- | --- | --- |
| **A** cheatsheet 维护 | 以仓库 modelConfig.ts 为标准回填 cheatsheet；Day 2 后增加 `pnpm verify-cheatsheet` 脚本每周跨验证 | 本 patch 包含回填 |
| **B** noTools 默认值 | PRD/Design/Review = `"builtin"`；Dev = `undefined` | 本 patch 包含重构 |
| **C** 历史回放策略 | < 200 条全推；≥ 200 条只推最后 50 条 + 「加载更多」 | Day 2 主体实现 |
| **D** 多浏览器协作 | 只做 `/project/:id` URL 路由，不上实时协同 | Day 2 主体实现 |
| **E** artifacts 版本目录 | 改成 `artifacts/<name>`  • `artifacts/.versions/<name>/<version>` 嵌套结构 | Day 2 主体迁移 |
| **F** DeepSeek 模型（**反转**） | 拥抱 V4 Pro + V4 Flash，model id 升级到正式名，利用 hybrid thinking | **本 patch 包含**，有架构级影响（下面 §二） |

## 二、V4 Pro 升级带来的架构优化

V4 系列 hybrid thinking/non-thinking 让原路线图中几件事变简单：

### 改变 1：Day 6 “思考开关” 从“换模型” 变“改参数”

- **原计划**：`deepseek-chat`（不思考）↔ `deepseek-reasoner`（思考）两个模型间切换 → 必须 dispose session 重建
- **现计划**：一个 `deepseek-v4-pro` 同时支持两种模式，只需切换 Pi SDK 的 `thinkingLevel`，不需重建 session。
- **后果**：Day 6 UI 从 "模型 chip + thinking chip" 变为 "模型 chip + thinking slider"；代码量 -50。

### 改变 2：上下文窗口从 128K 跳到 1M

- **原计划**：Day 6 加「超过 80K 自动 compact」阈值
- **现计划**：阈值提到 800K（PRD 会话几乎不可能跨越），compact 业务优先级从 P0 降为 P1。
- **后果**：你现在跨三个 project 加起来 ~700 条消息 / ~140KB jsonl 都远未到限，compact 仅作为手动入口保留。

### 改变 3：Dev Agent 默认模型选择

- **原计划**：Dev = `qwen3-coder-plus` 或 `deepseek-coder`
- **现计划**：Dev = `deepseek-v4-pro` + `thinkingLevel: "high"`（V4 官方说明针对 Claude Code/OpenClaw 优化过）；`qwen3-coder-plus` 降为 fallback。
- **后果**：Day 5 不再需要为 Dev 单独优化 prompt，V4 Pro 原生支持 Agent workflow。

### 改变 4：价格模型更新

V4 Pro 当前 75% off 优惠到 **2026-05-31 15:59 UTC**：

| 模型 | 输入 / 1M | 输出 / 1M | cache hit | 上下文 |
| --- | --- | --- | --- | --- |
| deepseek-v4-pro（优惠中） | $0.435 | $0.87 | $0.0435 | 1M |
| deepseek-v4-pro（原价） | $1.74 | $3.48 | $0.145 | 1M |
| deepseek-v4-flash | $0.14 | $0.28 | $0.014 | 1M |

⚠️ 赛事演示期间完全足够。赛后要提醒你 5/31 后价格翻 4 倍。

---

## 三、Day 1 硬伤修复 patch 文件清单

**分支名**：`fix/day1-hardening-and-v4pro` （合并后再开 `feat/day2-multi-project`）

**共 7 个文件改动 + 1 条 git 命令 + 1 条 .env 调整**。估计 30-45 分钟。

### Patch 0 · git 仓库清理（必须最先跑）

```bash
# 在仓库根跑
git rm -r --cached state
echo "# Day 1 硬伤修复" > /tmp/commit-msg.txt
git commit -F /tmp/commit-msg.txt --allow-empty -m "chore: stop tracking state/ directory"
```

### Patch 1 · `.gitignore`（覆盖全文）

```
# 依赖 / 构建
node_modules/
dist/
build/
.next/
.turbo/
.cache/
*.tsbuildinfo

# 运行时状态与隐私
state/
.env
.env.local
.env.*.local
*.log
logs/

# 编辑器 / 系统
.vscode/
.idea/
.DS_Store
Thumbs.db

# pnpm
.pnpm-store/
```

### Patch 2 · `apps/gateway/src/pi/modelConfig.ts`（V4 Pro 升级，覆盖全文）

```tsx
import { AuthStorage, ModelRegistry } from "@earendil-works/pi-coding-agent"

export function buildAuthAndRegistry() {
  const authStorage = AuthStorage.create()
  const registry = ModelRegistry.create(authStorage)

  // ===== DeepSeek V4 系列（2026-04-24 发布，hybrid thinking/non-thinking）=====
  // 文档：https://api-docs.deepseek.com/news/news260424
  // ⚠️ 旧别名 deepseek-chat / deepseek-reasoner 将于 2026-07-24 停用
  if (process.env.DEEPSEEK_API_KEY) {
    authStorage.setRuntimeApiKey("deepseek", process.env.DEEPSEEK_API_KEY)
    registry.registerProvider("deepseek", {
      baseUrl: process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com",
      apiKey: process.env.DEEPSEEK_API_KEY,
      api: "openai-completions",
      models: [
        {
          id: "deepseek-v4-pro",
          name: "DeepSeek V4 Pro",
          reasoning: true, // hybrid：thinkingLevel:"off" 走非思考，"high"/"xhigh" 走思考
          input: ["text"],
          // 75% off 优惠价格（2026-05-31 之前）
          cost: { inputPer1M: 0.435, outputPer1M: 0.87, cacheReadPer1M: 0.0435 },
          contextWindow: 1_048_576,
          maxTokens: 384_000,
        },
        {
          id: "deepseek-v4-flash",
          name: "DeepSeek V4 Flash",
          reasoning: true,
          input: ["text"],
          cost: { inputPer1M: 0.14, outputPer1M: 0.28, cacheReadPer1M: 0.014 },
          contextWindow: 1_048_576,
          maxTokens: 384_000,
        },
      ],
    })
  }

  // ===== 通义千问（fallback）=====
  if (process.env.DASHSCOPE_API_KEY) {
    authStorage.setRuntimeApiKey("dashscope", process.env.DASHSCOPE_API_KEY)
    registry.registerProvider("dashscope", {
      baseUrl: process.env.DASHSCOPE_BASE_URL ?? "https://dashscope.aliyuncs.com/compatible-mode/v1",
      apiKey: process.env.DASHSCOPE_API_KEY,
      api: "openai-completions",
      models: [
        {
          id: "qwen3-coder-plus",
          name: "通义千问 3 Coder Plus",
          reasoning: false,
          input: ["text"],
          cost: { inputPer1M: 4.0, outputPer1M: 16.0 },
          contextWindow: 256_000,
          maxTokens: 32_768,
        },
      ],
    })
  }

  // ===== 智谱 GLM（fallback）=====
  if (process.env.ZHIPU_API_KEY) {
    authStorage.setRuntimeApiKey("zhipu", process.env.ZHIPU_API_KEY)
    registry.registerProvider("zhipu", {
      baseUrl: process.env.ZHIPU_BASE_URL ?? "https://open.bigmodel.cn/api/paas/v4",
      apiKey: process.env.ZHIPU_API_KEY,
      api: "openai-completions",
      models: [
        {
          id: "glm-4-plus",
          name: "智谱 GLM-4 Plus",
          reasoning: false,
          input: ["text"],
          cost: { inputPer1M: 7.0, outputPer1M: 7.0 },
          contextWindow: 128_000,
          maxTokens: 4_096,
        },
      ],
    })
  }

  return { authStorage, registry }
}

export type RoleId = "prd" | "design" | "dev" | "review"

// 按角色选默认模型，首选 V4 Pro，其他作为 fallback
export function pickDefaultModel(registry: ReturnType<typeof buildAuthAndRegistry>["registry"], role: RoleId) {
  const candidates = role === "dev"
    ? [["deepseek", "deepseek-v4-pro"], ["dashscope", "qwen3-coder-plus"], ["deepseek", "deepseek-v4-flash"]]
    : [["deepseek", "deepseek-v4-pro"], ["deepseek", "deepseek-v4-flash"], ["dashscope", "qwen3-coder-plus"], ["zhipu", "glm-4-plus"]]
  for (const [p, id] of candidates) {
    const m = registry.find(p, id)
    if (m) return m
  }
  throw new Error("未配置任何可用模型，请检查 .env")
}

// 按角色决定 thinkingLevel（仅在模型支持 reasoning 时生效）
export function pickThinkingLevel(role: RoleId, modelSupportsReasoning: boolean): "off" | "low" | "medium" | "high" | "xhigh" {
  if (!modelSupportsReasoning) return "off"
  switch (role) {
    case "prd": return "low"        // PRD 以对话为主，轻度思考
    case "design": return "medium"
    case "dev": return "high"       // 开发 代码 需要充分思考
    case "review": return "medium"
  }
}
```

### Patch 3 · `apps/gateway/src/pi/createSession.ts`（角色条件化 noTools/thinkingLevel）

关键修改：

```tsx
// 导入 pickThinkingLevel
import { buildAuthAndRegistry, pickDefaultModel, pickThinkingLevel, type RoleId } from "./modelConfig"

export async function createRoleSession(projectId: string, role: RoleId) {
  const { authStorage, registry } = buildAuthAndRegistry()
  const model = pickDefaultModel(registry, role)

  const cwd = path.resolve(STATE_DIR, "projects", projectId, "workspace")
  const agentDir = path.resolve(STATE_DIR, "projects", projectId, "sessions")
  await fs.mkdir(cwd, { recursive: true })
  await fs.mkdir(agentDir, { recursive: true })

  const sessionFile = path.join(agentDir, `${role}.jsonl`)
  const sessionManager = await SessionManager.open(sessionFile)

  // 决策 B：PRD/Design/Review 禁内置工具走 customTools；Dev 开放 read/edit/write/bash
  const noTools = role === "dev" ? undefined : "builtin"

  // 模型是否支持 reasoning（V4 系列都是 true）
  const supportsReasoning = (model as any).reasoning === true
  const thinkingLevel = pickThinkingLevel(role, supportsReasoning)

  const { session } = await createAgentSession({
    cwd,
    agentDir,
    authStorage,
    modelRegistry: registry,
    model,
    thinkingLevel,
    customTools: toolsForRole(role, projectId),
    sessionManager,
  })

  return { session, model, thinkingLevel }
}
```

### Patch 4 · `apps/gateway/src/ws.ts`（session 切换 dispose）

在 `attachSession` 函数顶部加 3 行：

```tsx
async function attachSession(role: RoleId) {
  // 修补 §2.1：切角色 / 重连时 dispose 旧 session，避免 jsonl 文件锁和 subscribe 队列泄漏
  try { unsubAgent?.() } catch {}
  try { session?.dispose() } catch {}
  unsubAgent = undefined
  session = undefined

  // ... 原有逻辑不变
  const created = await createRoleSession(projectId, role)
  session = created.session
  // ...
}
```

### Patch 5 · `apps/gateway/src/store/artifactStore.ts`（list 正则）

```tsx
async list(projectId: string) {
  const dir = this.dirOf(projectId)
  await fs.mkdir(dir, { recursive: true })
  const files = await fs.readdir(dir)
  // 修补 §2.7：精确匹配版本后缀，避免误杀如 db.view.sql 这类名字
  const versionSuffix = /\.(v\d+|final)$/
  return files
    .filter((f) => !versionSuffix.test(f) && !f.startsWith("."))
    .map((name) => ({ name, version: "latest" }))
}
```

### Patch 6 · `docs/pi-sdk-cheatsheet.md`（覆盖全文）

```markdown
# Pi Coding Agent SDK 速查（以 qzzm-pi/apps/gateway/src/pi 为准）

> 官方：https://pi.dev/docs/latest/sdk
> 本 cheatsheet 在 Day 1 跑通后以实际代码为准重写。Day 2 起增加 `pnpm verify-cheatsheet` 脚本跨验证。

## 包导入
```

import {

createAgentSession,

AuthStorage,

ModelRegistry,

SessionManager,

defineTool,

} from "@earendil-works/pi-coding-agent"

import { Type } from "@sinclair/typebox"

```

## 注册 provider（正确姿势）
```

const authStorage = AuthStorage.create()

authStorage.setRuntimeApiKey("deepseek", apiKey)  // 仅本进程不落盘

const registry = ModelRegistry.create(authStorage)

registry.registerProvider("deepseek", {

baseUrl: "[https://api.deepseek.com](https://api.deepseek.com)",

apiKey,

api: "openai-completions",

models: [{

id: "deepseek-v4-pro",

name: "DeepSeek V4 Pro",

reasoning: true,                  // hybrid 思考/非思考

input: ["text"],

cost: { inputPer1M, outputPer1M },

contextWindow: 1_048_576,

maxTokens: 384_000,

}],

})

const model = registry.find("deepseek", "deepseek-v4-pro")

```
⚠️ 不要使用 `registerCustomModel`、`baseURL`、`api: "openai"`、`supportsThinking` 这些字段——那是旧版本文档的错误拼写。

## createAgentSession
```

const { session } = await createAgentSession({

cwd, agentDir,

authStorage, modelRegistry: registry, model,

thinkingLevel: "off"|"low"|"medium"|"high"|"xhigh",

noTools: "builtin" | undefined,    // "builtin"=禁内置工具、仅走 customTools

customTools: [...],

sessionManager,

})

```

## defineTool
```

const writePrd = defineTool({

name: "write_prd",

label: "写入 PRD",

description: "...",

parameters: Type.Object({

content: Type.String(),

version: Type.Optional(Type.String()),

}, { additionalProperties: false }),

execute: async (toolCallId, params, signal, onUpdate) => {

return {

content: [{ type: "text", text: "OK" }],

details: { path, size },

}

},

})

```
返回必须是 `{ content: ToolResultContent[], details? }`。

## 事件订阅
```

const unsub = session.subscribe((event) => {

switch (event.type) {

case "message_start":

case "message_update":          // event.assistantMessageEvent.{type, text|thinking}

case "message_end":

case "tool_execution_start":    // event.{toolCallId, toolName, params}

case "tool_execution_update":   // event.{toolCallId, update}

case "tool_execution_end":      // event.{toolCallId, result, isError}

case "turn_start":

case "turn_end":

case "agent_start":

case "agent_end":

case "compaction_start":        // Day 6 会用

case "compaction_end":

case "auto_retry_start":

case "auto_retry_end":

}

})

```

## 操作
```

await session.prompt(text, { images?, streamingBehavior?: "steer" | "followUp" })

session.abort()

session.compact(instructions?)

session.dispose()                    // 切换角色/模型时 必须 dispose 旧 session

session.isStreaming

```

## 不要做
- 不要 import 内部子路径
- 不要在 tool execute 里 throw（返回 `{ content, details, isError: true }` 代替）
- 不要并发对同一 session 调 prompt()
- 不要用 `Type.Any()` / `Type.Unknown()` —— DeepSeek 会拒
- 不要依赖 model id `deepseek-chat` / `deepseek-reasoner`（2026-07-24 停用）——用 `deepseek-v4-pro` / `deepseek-v4-flash`
```

### Patch 7 · `.env.example`（补注释 + 可选调 base url）

```
# DeepSeek（首选）——使用 V4 系列 model id
DEEPSEEK_API_KEY=sk-xxx
DEEPSEEK_BASE_URL=https://api.deepseek.com
# DEEPSEEK_MODEL=deepseek-v4-pro       # 进程默认按 role 选模，这里不要写死

# 通义千问（fallback）
DASHSCOPE_API_KEY=
DASHSCOPE_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1

# 智谱（fallback）
ZHIPU_API_KEY=
ZHIPU_BASE_URL=https://open.bigmodel.cn/api/paas/v4

# 服务
GATEWAY_PORT=8787
STATE_DIR=./state
```

---

## 四、提交顺序建议

拆成 4 个 commit，方便后续 code review 和回滚：

```bash
git checkout -b fix/day1-hardening-and-v4pro

# Commit 1: 仓库卫生
git rm -r --cached state
# 替换 .gitignore
git add .gitignore
git commit -m "chore: stop tracking state/, harden .gitignore"

# Commit 2: V4 Pro 升级
# 替换 modelConfig.ts 和 .env.example
git add apps/gateway/src/pi/modelConfig.ts .env.example
git commit -m "feat(model): upgrade to deepseek-v4-pro / v4-flash, add hybrid thinking"

# Commit 3: 角色条件化 + session dispose
# 替换 createSession.ts 和 ws.ts
git add apps/gateway/src/pi/createSession.ts apps/gateway/src/ws.ts
git commit -m "fix(gateway): role-conditional noTools/thinkingLevel; dispose prev session on switch"

# Commit 4: 其他硬伤 + 文档
# 替换 artifactStore.ts 和 pi-sdk-cheatsheet.md
git add apps/gateway/src/store/artifactStore.ts docs/pi-sdk-cheatsheet.md
git commit -m "fix: artifactStore.list regex; rewrite pi-sdk-cheatsheet to match actual API"

# Push
git push -u origin fix/day1-hardening-and-v4pro
```

## 五、验收清单

Claude Code 跑完后你手动验收：

- [ ]  `git status` 不再有 `state/` 下的文件
- [ ]  `pnpm dev` 启动后控制台输出 `[gateway] using model: deepseek-v4-pro`
- [ ]  前端发送一句，响应正常，gateway 日志里能看到 `thinkingLevel: low`（PRD 角色）
- [ ]  点一下顶部角色 tab 切换（即使另三个是 stub），**gateway 不报错** 且旧 session 被 dispose（看日志）
- [ ]  刷新页面后，会话仍会重建（jsonl 持久化）但 UI 是空的——这是 Day 2 主体要解决的，这里只需确认后端不报错
- [ ]  `cat docs/pi-sdk-cheatsheet.md` 中 不再出现 `registerCustomModel`、`baseURL`、`supportsThinking`
- [ ]  点击 prd 表现正常，write_prd 运行成功生成 v1

## 六、下一步

这个 patch 合并后，我开 **Day 2 工程包**，包含：

- 多 project + ProjectSwitcher + URL 路由 `/project/:id`（决策 D）
- 会话分支树 + fork/navigate
- 历史回放（决策 C）
- artifact_snapshot 握手推送（§2.5）
- artifacts/.versions 嵌套迁移（决策 E）
- ArtifactPanel type 分流（md / html / yaml / sql）
- `pnpm verify-cheatsheet` 脚本（决策 A）

预计 ~750 行，仍为 1 天开发量。你说「合完 patch」我就开 Day 2 页。