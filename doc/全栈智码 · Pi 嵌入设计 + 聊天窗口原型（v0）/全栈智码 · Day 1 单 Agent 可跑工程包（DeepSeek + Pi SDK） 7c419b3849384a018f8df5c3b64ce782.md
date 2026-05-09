# 全栈智码 · Day 1 单 Agent 可跑工程包（DeepSeek + Pi SDK）

<aside>
🚀

**目标**：跑通"用户发一句话 → 需求 Agent 生成 PRD → 右侧实时预览 → 一键导出 md"全链路，验证 Pi SDK 嵌入 + 国产模型 + 自定义工具 + 流式事件 + session 分支。

**栈**：前端 React 18 + Vite 5 + Tailwind 3 + shadcn/ui  •  后端 Node 20 + TypeScript + Fastify 4 + @fastify/websocket  •  模型 DeepSeek（备选：通义千问 / 智谱 GLM）  •  无沙箱

**用法**：把整个 `qzzm-pi/` 目录创建出来，按文件落盘，`pnpm i && pnpm dev` 启动；浏览器开 `http://localhost:5173`。

</aside>

## 〇、布局澄清：这是桌面 Web SPA，不是手机版

<aside>
🖥️

**架构上一直是 PC 浏览器单页应用**：顶部 Agent Tab 栏 + 左 224px 会话栏 + 中间 flex-1 聊天主区 + 右 420px 产出物面板，总宽度 **≥ 1280px**，跑在桌面 Chrome / Edge / Safari 全屏窗口里。它不是 PWA、不是 Capacitor、不是 React Native，没有任何移动端壳。

之所以**看起来像手机版**，是因为我之前的 `MessageList` 用了气泡样式（`rounded-2xl` + `max-w-[80%]` + 右靠对齐 user / 左靠对齐 assistant），跟微信、iMessage 视觉很像。我已把它改成 ChatGPT / Claude 那种 **全宽行 + 头像左对齐 + 不加气泡背景** 的桌面 Web 风格 —— 见下文 §四 的新版 `MessageList.tsx`。

</aside>

### 桌面三栏布局（1440px 屏宽示意）

```jsx
┌────────────────────────────────────────────────────────────────────────────────┐
│ 🛠️ 全栈智码    [📝需求 Agent●] [📐设计·灰] [💻开发·灰] [🔍审查·灰]    Provider: DeepSeek │
├──────────┬────────────────────────────────────────────────┬────────────────────┤
│ 会话历史 │                                                │   📄 产出物         │
│          │  ● 你                                           │  ┌──────────────┐  │
│ 📌当前   │    做一个二手书交易平台                          │  │ prd.md   v2  │  │
│          │                                                │  ├──────────────┤  │
│ —分支树— │  🤖 需求 Agent                                  │  │ # 产品需求文档│  │
│   Day 2  │    好的，先确认几个关键点：                      │  │ ## 1. 项目背景│  │
│          │    1. 主要面向学生 / 社区 / 全国？               │  │ 二手书交易…   │  │
│          │    2. 是否需要支付闭环？                         │  │ ## 2. 核心用户│  │
│          │                                                │  │ ...           │  │
│          │    ┌─🔧 write_prd ─────────────── ✓ ┐           │  │               │  │
│          │    │ params: { version: "v1", ... } │           │  │               │  │
│          │    └─────────────────────────────── ┘           │  └──────────────┘  │
│          │    ┌─📄 已生成 prd.md (v1, 4.2KB) → ┐           │  [⬇下载md][docx灰] │
│          │    └────────────────────────────── ┘            │                    │
│          ├────────────────────────────────────────────────┤                    │
│ +新会话  │  [ 输入框：用一句话描述你的产品想法…  ] [发送]   │                    │
└──────────┴────────────────────────────────────────────────┴────────────────────┘
   224px                       flex-1（≥ 800px）                      420px
                            总宽度 ≥ 1280px（桌面浏览器全屏）
```

## 一、项目结构

```
qzzm-pi/
├── package.json                 # pnpm workspaces 根
├── pnpm-workspace.yaml
├── .env.example                 # DeepSeek API Key 等
├── README.md
├── apps/
│   ├── web/                     # 前端聊天窗口
│   │   ├── package.json
│   │   ├── vite.config.ts
│   │   ├── tailwind.config.ts
│   │   ├── postcss.config.js
│   │   ├── tsconfig.json
│   │   ├── index.html
│   │   └── src/
│   │       ├── main.tsx
│   │       ├── App.tsx
│   │       ├── index.css
│   │       ├── lib/types.ts
│   │       ├── lib/utils.ts
│   │       ├── hooks/useAgentSocket.ts
│   │       └── components/
│   │           ├── AgentTabs.tsx
│   │           ├── SessionSidebar.tsx
│   │           ├── ChatWindow.tsx
│   │           ├── MessageList.tsx
│   │           ├── ToolCard.tsx
│   │           ├── ThinkingCard.tsx
│   │           ├── InputBox.tsx
│   │           └── ArtifactPanel.tsx
│   └── gateway/                 # 后端 Gateway + Pi 嵌入
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           ├── index.ts         # Fastify 启动
│           ├── ws.ts            # WebSocket 路由 + Pi 事件桥接
│           ├── artifacts.ts     # 产出物 REST 接口
│           ├── pi/
│           │   ├── modelConfig.ts   # 注册 DeepSeek 为 OpenAI 兼容 provider
│           │   ├── prompts.ts       # 4 个 Agent 的 system prompt
│           │   ├── tools.ts         # write_prd 等自定义工具
│           │   └── createSession.ts # createAgentSession 包装
│           ├── store/
│           │   └── artifactStore.ts
│           └── lib/
│               └── log.ts
└── state/                       # 运行时生成（session 文件 / artifacts）
```

## 二、根工程文件

### `package.json`（根）

```json
{
	"name": "qzzm-pi",
	"private": true,
	"packageManager": "pnpm@9.0.0",
	"scripts": {
		"dev": "pnpm -r --parallel dev",
		"build": "pnpm -r build",
		"clean": "rm -rf state node_modules apps/*/node_modules apps/*/dist"
	}
}
```

### `pnpm-workspace.yaml`

```yaml
packages:
	- 'apps/*'
```

### `.env.example`

```
# DeepSeek（首选，OpenAI 兼容）
DEEPSEEK_API_KEY=sk-xxxx
DEEPSEEK_BASE_URL=https://api.deepseek.com/v1
DEEPSEEK_MODEL=deepseek-chat

# 备选 1：通义千问（DashScope，OpenAI 兼容）
DASHSCOPE_API_KEY=
DASHSCOPE_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
DASHSCOPE_MODEL=qwen2.5-coder-32b-instruct

# 备选 2：智谱 GLM
ZHIPU_API_KEY=
ZHIPU_BASE_URL=https://open.bigmodel.cn/api/paas/v4
ZHIPU_MODEL=glm-4-plus

# Gateway
GATEWAY_PORT=8787
STATE_DIR=./state
```

### `README.md`

```markdown
# 全栈智码 · Day 1

## 启动
```

pnpm i

cp .env.example .env   # 填 DEEPSEEK_API_KEY

pnpm dev

```
打开 http://localhost:5173

## 当前能力
- 顶部 4 个 Agent Tab，Day 1 只激活"需求 Agent"
- 用户发消息 → DeepSeek 流式回复 → 调用 write_prd 工具写出 prd.md
- 右侧产出物面板实时显示 prd.md，点导出下载
- 左侧会话历史（基于 Pi session tree，支持 /fork、/compact）
```

---

## 三、后端 Gateway（apps/gateway）

### `apps/gateway/package.json`

```json
{
	"name": "@qzzm/gateway",
	"version": "0.0.1",
	"private": true,
	"type": "module",
	"scripts": {
		"dev": "tsx watch src/index.ts",
		"build": "tsc -p tsconfig.json",
		"start": "node dist/index.js"
	},
	"dependencies": {
		"@earendil-works/pi-coding-agent": "^0.73.0",
		"@fastify/cors": "^9.0.1",
		"@fastify/static": "^7.0.4",
		"@fastify/websocket": "^10.0.1",
		"@sinclair/typebox": "^0.32.34",
		"dotenv": "^16.4.5",
		"fastify": "^4.28.1",
		"nanoid": "^5.0.7"
	},
	"devDependencies": {
		"@types/node": "^20.14.10",
		"tsx": "^4.16.2",
		"typescript": "^5.5.3"
	}
}
```

### `apps/gateway/tsconfig.json`

```json
{
	"compilerOptions": {
		"target": "ES2022",
		"module": "ESNext",
		"moduleResolution": "Bundler",
		"strict": true,
		"esModuleInterop": true,
		"skipLibCheck": true,
		"resolveJsonModule": true,
		"outDir": "dist",
		"rootDir": "src"
	},
	"include": ["src/**/*"]
}
```

### `apps/gateway/src/index.ts`

```tsx
import "dotenv/config"
import Fastify from "fastify"
import cors from "@fastify/cors"
import websocket from "@fastify/websocket"
import { registerWsRoutes } from "./ws.js"
import { registerArtifactRoutes } from "./artifacts.js"
import { log } from "./lib/log.js"

const app = Fastify({ logger: false })
await app.register(cors, { origin: true })
await app.register(websocket)

await registerWsRoutes(app)
await registerArtifactRoutes(app)

app.get("/health", async () => ({ ok: true }))

const port = Number(process.env.GATEWAY_PORT ?? 8787)
await app.listen({ port, host: "0.0.0.0" })
log.info(`gateway up on http://localhost:${port}`)
```

### `apps/gateway/src/lib/log.ts`

```tsx
export const log = {
	info: (...a: unknown[]) => console.log("[i]", ...a),
	warn: (...a: unknown[]) => console.warn("[!]", ...a),
	error: (...a: unknown[]) => console.error("[x]", ...a),
	debug: (...a: unknown[]) => process.env.DEBUG && console.log("[d]", ...a),
}
```

### `apps/gateway/src/pi/modelConfig.ts`（关键：把国产模型注册成 OpenAI 兼容 provider）

```tsx
import { AuthStorage, ModelRegistry } from "@earendil-works/pi-coding-agent"

/**
 * Pi 内置 anthropic / openai / gemini / copilot 等 provider。
 * DeepSeek、通义、智谱都提供 OpenAI 兼容端点，我们走 "openai" provider + 自定义 baseURL + 自定义 modelId。
 * 这是 Pi SDK 推荐的接入国产模型方式，无需写自定义 provider。
 */
export function buildAuthAndRegistry() {
	const authStorage = AuthStorage.create() // ~/.pi/agent/auth.json
	const modelRegistry = ModelRegistry.create(authStorage)

	// DeepSeek（首选）
	if (process.env.DEEPSEEK_API_KEY) {
		authStorage.setRuntimeApiKey("deepseek", process.env.DEEPSEEK_API_KEY)
		modelRegistry.registerCustomModel({
			provider: "deepseek",
			id: process.env.DEEPSEEK_MODEL ?? "deepseek-chat",
			baseURL: process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com/v1",
			api: "openai", // OpenAI 兼容
			contextWindow: 128_000,
			maxOutputTokens: 8_192,
			supportsThinking: false,
		})
	}

	// 通义千问（备选 1）
	if (process.env.DASHSCOPE_API_KEY) {
		authStorage.setRuntimeApiKey("dashscope", process.env.DASHSCOPE_API_KEY)
		modelRegistry.registerCustomModel({
			provider: "dashscope",
			id: process.env.DASHSCOPE_MODEL ?? "qwen2.5-coder-32b-instruct",
			baseURL: process.env.DASHSCOPE_BASE_URL ?? "https://dashscope.aliyuncs.com/compatible-mode/v1",
			api: "openai",
			contextWindow: 131_072,
			maxOutputTokens: 8_192,
		})
	}

	// 智谱 GLM（备选 2）
	if (process.env.ZHIPU_API_KEY) {
		authStorage.setRuntimeApiKey("zhipu", process.env.ZHIPU_API_KEY)
		modelRegistry.registerCustomModel({
			provider: "zhipu",
			id: process.env.ZHIPU_MODEL ?? "glm-4-plus",
			baseURL: process.env.ZHIPU_BASE_URL ?? "https://open.bigmodel.cn/api/paas/v4",
			api: "openai",
			contextWindow: 128_000,
			maxOutputTokens: 4_096,
		})
	}

	return { authStorage, modelRegistry }
}

export function pickDefaultModel(registry: ReturnType<typeof buildAuthAndRegistry>["modelRegistry"]) {
	const order: Array<[string, string]> = [
		["deepseek", process.env.DEEPSEEK_MODEL ?? "deepseek-chat"],
		["dashscope", process.env.DASHSCOPE_MODEL ?? "qwen2.5-coder-32b-instruct"],
		["zhipu", process.env.ZHIPU_MODEL ?? "glm-4-plus"],
	]
	for (const [provider, id] of order) {
		const m = registry.find(provider, id)
		if (m) return m
	}
	throw new Error("未配置任何国产模型 API Key，请编辑 .env")
}
```

<aside>
⚠️

**注意**：`registerCustomModel` 是 Pi 0.73 之后的便捷 API；如果你装的版本字段名不同，回退方案是写一个 `~/.pi/agent/models.json`（Pi 启动时会自动读取），格式：

```json
[{ "provider": "deepseek", "id": "deepseek-chat", "baseURL": "https://api.deepseek.com/v1", "api": "openai", "contextWindow": 128000 }]
```

然后在 `.env` 里 `OPENAI_API_KEY` 位置改用 Pi 的 fallback resolver 即可。本工程默认走 SDK 注册路径，最干净。

</aside>

### `apps/gateway/src/pi/prompts.ts`

```tsx
export const SYSTEM_PROMPTS = {
	prd: `你是"全栈智码"平台的需求 Agent。你的唯一任务：把用户的一句话/资料/想法，转化为高质量 PRD（产品需求文档）的 markdown 文件，并通过工具 write_prd 写入 artifacts/prd.md。

PRD 必须包含：
1. 项目背景与目标
2. 核心用户与场景（用户故事 As a / I want / So that 形式）
3. 功能列表（按优先级 P0/P1/P2 分级）
4. 非功能需求（性能 / 安全 / 兼容性）
5. 验收标准（每个 P0 功能至少 3 条）
6. 里程碑与风险

工作方式：
- 用户信息不足时，最多追问 2 轮关键问题，然后给出第一版 PRD 草稿
- 每次修改都用 write_prd 写入新版本（version 用 v1 / v2 / v3...）
- 用户说"定稿"时，写一版 final 并提示用户可点导出
- 全程使用中文`,

	design: `[Day 2 接入] 你是设计 Agent...`,
	dev: `[Day 5 接入] 你是开发 Agent...`,
	review: `[Day 5 接入] 你是审查 Agent...`,
} as const

export type AgentRole = keyof typeof SYSTEM_PROMPTS
```

### `apps/gateway/src/store/artifactStore.ts`

```tsx
import { mkdir, readFile, writeFile, readdir, stat } from "node:fs/promises"
import { join } from "node:path"
import { EventEmitter } from "node:events"

const STATE_DIR = process.env.STATE_DIR ?? "./state"

export const artifactBus = new EventEmitter()

export interface ArtifactRecord {
	projectId: string
	name: string // e.g. prd.md
	version: string // v1 / v2 / final
	path: string
	size: number
	updatedAt: number
	kind: "prd" | "design" | "code" | "review"
}

function projectDir(projectId: string) {
	return join(STATE_DIR, "projects", projectId, "artifacts")
}

export const artifactStore = {
	async save(projectId: string, name: string, content: string, version: string, kind: ArtifactRecord["kind"]) {
		const dir = projectDir(projectId)
		await mkdir(dir, { recursive: true })
		const latest = join(dir, name)
		const versioned = join(dir, `${name}.${version}`)
		await writeFile(latest, content, "utf8")
		await writeFile(versioned, content, "utf8")
		const rec: ArtifactRecord = {
			projectId,
			name,
			version,
			path: latest,
			size: Buffer.byteLength(content, "utf8"),
			updatedAt: Date.now(),
			kind,
		}
		artifactBus.emit("updated", rec)
		return rec
	},

	async load(projectId: string, name: string) {
		const path = join(projectDir(projectId), name)
		const content = await readFile(path, "utf8")
		const s = await stat(path)
		return { content, size: s.size, updatedAt: s.mtimeMs, path }
	},

	async list(projectId: string) {
		const dir = projectDir(projectId)
		try {
			const files = await readdir(dir)
			return files.filter((f) => !f.includes(".v") && !/\.final$/.test(f))
		} catch {
			return []
		}
	},
}
```

### `apps/gateway/src/pi/tools.ts`

```tsx
import { defineTool } from "@earendil-works/pi-coding-agent"
import { Type } from "@sinclair/typebox"
import { artifactStore } from "../store/artifactStore.js"

export function buildPrdTools(projectId: string) {
	const writePrd = defineTool({
		name: "write_prd",
		label: "写入 PRD",
		description: "把最终 PRD 全文写入 artifacts/prd.md。每次修改都应调用此工具产生新版本。",
		parameters: Type.Object({
			content: Type.String({ description: "完整的 PRD markdown 文本" }),
			version: Type.String({ description: "版本号 v1 / v2 / final" }),
		}),
		execute: async (_id, { content, version }) => {
			const rec = await artifactStore.save(projectId, "prd.md", content, version, "prd")
			return {
				content: [
					{ type: "text", text: `已写入 prd.md（${version}，${rec.size} 字节）。用户可在右侧面板预览或导出。` },
				],
				details: { path: rec.path, version, size: rec.size },
			}
		},
	})

	const readPrd = defineTool({
		name: "read_prd",
		label: "读取当前 PRD",
		description: "读取 artifacts/prd.md 的最新版本，便于在用户要求修改时基于现状改写。",
		parameters: Type.Object({}),
		execute: async () => {
			try {
				const { content, size } = await artifactStore.load(projectId, "prd.md")
				return { content: [{ type: "text", text: content }], details: { size } }
			} catch {
				return { content: [{ type: "text", text: "prd.md 还不存在，请先写入第一版。" }], details: {} }
			}
		},
	})

	return [writePrd, readPrd]
}
```

### `apps/gateway/src/pi/createSession.ts`

```tsx
import {
	createAgentSession,
	DefaultResourceLoader,
	SessionManager,
} from "@earendil-works/pi-coding-agent"
import { mkdir } from "node:fs/promises"
import { join } from "node:path"
import { buildAuthAndRegistry, pickDefaultModel } from "./modelConfig.js"
import { SYSTEM_PROMPTS, type AgentRole } from "./prompts.js"
import { buildPrdTools } from "./tools.js"

const { authStorage, modelRegistry } = buildAuthAndRegistry()
const defaultModel = pickDefaultModel(modelRegistry)

const STATE_DIR = process.env.STATE_DIR ?? "./state"

function toolsForRole(role: AgentRole, projectId: string) {
	switch (role) {
		case "prd":
			return buildPrdTools(projectId)
		default:
			return []
	}
}

export async function createRoleSession(role: AgentRole, projectId: string) {
	const projectDir = join(STATE_DIR, "projects", projectId)
	const sessionFile = join(projectDir, "sessions", `${role}.jsonl`)
	await mkdir(join(projectDir, "sessions"), { recursive: true })
	await mkdir(join(projectDir, "workspace"), { recursive: true })

	const sessionManager = SessionManager.open(sessionFile)
	const loader = new DefaultResourceLoader({
		cwd: join(projectDir, "workspace"),
		agentDir: join(STATE_DIR, "agent"),
		systemPromptOverride: () => SYSTEM_PROMPTS[role],
	})
	await loader.reload()

	const { session } = await createAgentSession({
		cwd: join(projectDir, "workspace"),
		agentDir: join(STATE_DIR, "agent"),
		authStorage,
		modelRegistry,
		model: defaultModel,
		thinkingLevel: "off", // DeepSeek-chat 暂不支持 thinking；用 deepseek-reasoner 时改 medium
		customTools: toolsForRole(role, projectId),
		sessionManager,
		resourceLoader: loader,
	})
	return session
}

export { defaultModel, modelRegistry }
```

### `apps/gateway/src/ws.ts`（核心：把 Pi 事件桥接到前端）

```tsx
import type { FastifyInstance } from "fastify"
import { nanoid } from "nanoid"
import type { AgentSession } from "@earendil-works/pi-coding-agent"
import { createRoleSession } from "./pi/createSession.js"
import { artifactBus } from "./store/artifactStore.js"
import type { AgentRole } from "./pi/prompts.js"
import { log } from "./lib/log.js"

type OutMsg =
	| { kind: "hello"; projectId: string; role: AgentRole }
	| { kind: "text_delta"; messageId: string; delta: string }
	| { kind: "thinking_delta"; messageId: string; delta: string }
	| { kind: "message_start"; messageId: string }
	| { kind: "message_end"; messageId: string }
	| { kind: "tool_start"; toolCallId: string; name: string; params: unknown }
	| { kind: "tool_update"; toolCallId: string; chunk: unknown }
	| { kind: "tool_end"; toolCallId: string; isError: boolean; result: unknown }
	| { kind: "turn_end" }
	| { kind: "agent_end" }
	| { kind: "artifact_updated"; artifact: { name: string; version: string; size: number; kind: string } }
	| { kind: "error"; message: string }

type InMsg =
	| { kind: "prompt"; text: string; behavior?: "steer" | "followUp" }
	| { kind: "abort" }
	| { kind: "compact"; instructions?: string }
	| { kind: "switch_role"; role: AgentRole }

export async function registerWsRoutes(app: FastifyInstance) {
	app.get("/ws/:projectId", { websocket: true }, async (conn, req) => {
		const projectId = (req.params as { projectId: string }).projectId || nanoid(10)
		let role: AgentRole = "prd"
		let session: AgentSession | undefined
		let unsubAgent: (() => void) | null = null

		const send = (m: OutMsg) => conn.socket.send(JSON.stringify(m))

		const attachSession = async (newRole: AgentRole) => {
			unsubAgent?.()
			role = newRole
			session = await createRoleSession(role, projectId)
			unsubAgent = session.subscribe((event) => {
				switch (event.type) {
					case "message_start":
						send({ kind: "message_start", messageId: event.messageId })
						break
					case "message_update": {
						const e = event.assistantMessageEvent
						if (e.type === "text_delta") send({ kind: "text_delta", messageId: event.messageId, delta: e.delta })
						if (e.type === "thinking_delta") send({ kind: "thinking_delta", messageId: event.messageId, delta: e.delta })
						break
					}
					case "message_end":
						send({ kind: "message_end", messageId: event.messageId })
						break
					case "tool_execution_start":
						send({ kind: "tool_start", toolCallId: event.toolCallId, name: event.toolName, params: event.params })
						break
					case "tool_execution_update":
						send({ kind: "tool_update", toolCallId: event.toolCallId, chunk: event.update })
						break
					case "tool_execution_end":
						send({
							kind: "tool_end",
							toolCallId: event.toolCallId,
							isError: event.isError ?? false,
							result: event.result,
						})
						break
					case "turn_end":
						send({ kind: "turn_end" })
						break
					case "agent_end":
						send({ kind: "agent_end" })
						break
				}
			})
			send({ kind: "hello", projectId, role })
		}

		await attachSession("prd")

		// 工件更新 → 推给该连接（按 projectId 过滤）
		const onArtifact = (rec: { projectId: string; name: string; version: string; size: number; kind: string }) => {
			if (rec.projectId !== projectId) return
			send({ kind: "artifact_updated", artifact: rec })
		}
		artifactBus.on("updated", onArtifact)

		conn.socket.on("message", async (raw) => {
			let msg: InMsg
			try {
				msg = JSON.parse(raw.toString())
			} catch {
				return send({ kind: "error", message: "invalid json" })
			}
			if (!session) return
			try {
				switch (msg.kind) {
					case "prompt":
						if (session.isStreaming) {
							await session.prompt(msg.text, { streamingBehavior: msg.behavior ?? "steer" })
						} else {
							await session.prompt(msg.text)
						}
						break
					case "abort":
						await session.abort()
						break
					case "compact":
						await session.compact(msg.instructions)
						break
					case "switch_role":
						await attachSession(msg.role)
						break
				}
			} catch (e: unknown) {
				log.error(e)
				send({ kind: "error", message: (e as Error).message })
			}
		})

		conn.socket.on("close", () => {
			unsubAgent?.()
			artifactBus.off("updated", onArtifact)
			session?.dispose()
			log.info(`ws closed project=${projectId}`)
		})
	})
}
```

### `apps/gateway/src/artifacts.ts`

```tsx
import type { FastifyInstance } from "fastify"
import { artifactStore } from "./store/artifactStore.js"

export async function registerArtifactRoutes(app: FastifyInstance) {
	app.get("/artifacts/:projectId", async (req) => {
		const { projectId } = req.params as { projectId: string }
		return { files: await artifactStore.list(projectId) }
	})

	app.get("/artifacts/:projectId/:name", async (req, reply) => {
		const { projectId, name } = req.params as { projectId: string; name: string }
		const { content } = await artifactStore.load(projectId, name)
		reply.header("content-type", "text/markdown; charset=utf-8")
		return content
	})

	app.get("/artifacts/:projectId/:name/download", async (req, reply) => {
		const { projectId, name } = req.params as { projectId: string; name: string }
		const { content } = await artifactStore.load(projectId, name)
		reply
			.header("content-type", "text/markdown; charset=utf-8")
			.header("content-disposition", `attachment; filename="${name}"`)
			.send(content)
	})
}
```

---

## 四、前端 Web（apps/web）

### `apps/web/package.json`

```json
{
	"name": "@qzzm/web",
	"version": "0.0.1",
	"private": true,
	"type": "module",
	"scripts": {
		"dev": "vite",
		"build": "tsc -b && vite build",
		"preview": "vite preview"
	},
	"dependencies": {
		"clsx": "^2.1.1",
		"lucide-react": "^0.408.0",
		"react": "^18.3.1",
		"react-dom": "^18.3.1",
		"react-markdown": "^9.0.1",
		"remark-gfm": "^4.0.0",
		"tailwind-merge": "^2.4.0"
	},
	"devDependencies": {
		"@types/react": "^18.3.3",
		"@types/react-dom": "^18.3.0",
		"@vitejs/plugin-react": "^4.3.1",
		"autoprefixer": "^10.4.19",
		"postcss": "^8.4.39",
		"tailwindcss": "^3.4.4",
		"typescript": "^5.5.3",
		"vite": "^5.3.3"
	}
}
```

### `apps/web/vite.config.ts`

```tsx
import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"

export default defineConfig({
	plugins: [react()],
	server: {
		port: 5173,
		proxy: {
			"/ws": { target: "ws://localhost:8787", ws: true },
			"/artifacts": { target: "http://localhost:8787", changeOrigin: true },
		},
	},
})
```

### `apps/web/tailwind.config.ts`

```tsx
import type { Config } from "tailwindcss"
export default {
	content: ["./index.html", "./src/**/*.{ts,tsx}"],
	theme: { extend: {} },
	plugins: [],
} satisfies Config
```

### `apps/web/postcss.config.js`

```jsx
export default { plugins: { tailwindcss: {}, autoprefixer: {} } }
```

### `apps/web/tsconfig.json`

```json
{
	"compilerOptions": {
		"target": "ES2022",
		"lib": ["ES2022", "DOM", "DOM.Iterable"],
		"module": "ESNext",
		"moduleResolution": "Bundler",
		"jsx": "react-jsx",
		"strict": true,
		"esModuleInterop": true,
		"skipLibCheck": true,
		"resolveJsonModule": true,
		"allowSyntheticDefaultImports": true
	},
	"include": ["src"]
}
```

### `apps/web/index.html`

```html
<!doctype html>
<html lang="zh-CN">
	<head>
		<meta charset="UTF-8" />
		<meta name="viewport" content="width=device-width, initial-scale=1.0" />
		<title>全栈智码 · Day 1</title>
	</head>
	<body>
		<div id="root"></div>
		<script type="module" src="/src/main.tsx"></script>
	</body>
</html>
```

### `apps/web/src/index.css`

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root { color-scheme: light; }
html, body, #root { height: 100%; margin: 0; }
body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif; }
```

### `apps/web/src/main.tsx`

```tsx
import React from "react"
import ReactDOM from "react-dom/client"
import App from "./App"
import "./index.css"

ReactDOM.createRoot(document.getElementById("root")!).render(
	<React.StrictMode>
		<App />
	</React.StrictMode>,
)
```

### `apps/web/src/lib/types.ts`

```tsx
export type AgentRole = "prd" | "design" | "dev" | "review"

export type Msg =
	| { id: string; kind: "user"; text: string }
	| { id: string; kind: "assistant"; text: string; thinking?: string; done: boolean }
	| { id: string; kind: "tool"; toolCallId: string; name: string; params: unknown; chunks: string[]; result?: unknown; isError?: boolean; done: boolean }
	| { id: string; kind: "artifact"; name: string; version: string; size: number; artifactKind: string }
	| { id: string; kind: "error"; text: string }

export interface ArtifactInfo { name: string; version: string; size: number; kind: string }
```

### `apps/web/src/lib/utils.ts`

```tsx
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs))
}
export function nid() {
	return Math.random().toString(36).slice(2, 10)
}
```

### `apps/web/src/hooks/useAgentSocket.ts`

```tsx
import { useCallback, useEffect, useRef, useState } from "react"
import type { AgentRole, ArtifactInfo, Msg } from "../lib/types"
import { nid } from "../lib/utils"

export function useAgentSocket(projectId: string) {
	const [role, setRole] = useState<AgentRole>("prd")
	const [messages, setMessages] = useState<Msg[]>([])
	const [artifacts, setArtifacts] = useState<ArtifactInfo[]>([])
	const [streaming, setStreaming] = useState(false)
	const wsRef = useRef<WebSocket | null>(null)
	const currentAssistantIdRef = useRef<string | null>(null)

	useEffect(() => {
		const proto = location.protocol === "https:" ? "wss" : "ws"
		const ws = new WebSocket(`${proto}://${location.host}/ws/${projectId}`)
		wsRef.current = ws

		ws.onmessage = (ev) => {
			const m = JSON.parse(ev.data)
			switch (m.kind) {
				case "hello":
					setRole(m.role)
					break
				case "message_start": {
					const id = nid()
					currentAssistantIdRef.current = id
					setStreaming(true)
					setMessages((prev) => [...prev, { id, kind: "assistant", text: "", thinking: "", done: false }])
					break
				}
				case "text_delta":
					setMessages((prev) => prev.map((x) => (x.id === currentAssistantIdRef.current && x.kind === "assistant" ? { ...x, text: x.text + m.delta } : x)))
					break
				case "thinking_delta":
					setMessages((prev) => prev.map((x) => (x.id === currentAssistantIdRef.current && x.kind === "assistant" ? { ...x, thinking: (x.thinking ?? "") + m.delta } : x)))
					break
				case "message_end":
					setMessages((prev) => prev.map((x) => (x.id === currentAssistantIdRef.current && x.kind === "assistant" ? { ...x, done: true } : x)))
					currentAssistantIdRef.current = null
					break
				case "tool_start":
					setMessages((prev) => [...prev, { id: nid(), kind: "tool", toolCallId: m.toolCallId, name: m.name, params: m.params, chunks: [], done: false }])
					break
				case "tool_update":
					setMessages((prev) => prev.map((x) => (x.kind === "tool" && x.toolCallId === m.toolCallId ? { ...x, chunks: [...x.chunks, String(m.chunk?.text ?? JSON.stringify(m.chunk))] } : x)))
					break
				case "tool_end":
					setMessages((prev) => prev.map((x) => (x.kind === "tool" && x.toolCallId === m.toolCallId ? { ...x, result: m.result, isError: m.isError, done: true } : x)))
					break
				case "artifact_updated":
					setArtifacts((prev) => {
						const rest = prev.filter((a) => a.name !== m.artifact.name)
						return [...rest, m.artifact]
					})
					setMessages((prev) => [...prev, { id: nid(), kind: "artifact", name: m.artifact.name, version: m.artifact.version, size: m.artifact.size, artifactKind: m.artifact.kind }])
					break
				case "agent_end":
					setStreaming(false)
					break
				case "error":
					setMessages((prev) => [...prev, { id: nid(), kind: "error", text: m.message }])
					setStreaming(false)
					break
			}
		}
		return () => ws.close()
	}, [projectId])

	const send = useCallback((text: string) => {
		if (!wsRef.current || wsRef.current.readyState !== 1) return
		setMessages((prev) => [...prev, { id: nid(), kind: "user", text }])
		wsRef.current.send(JSON.stringify({ kind: "prompt", text, behavior: "steer" }))
	}, [])

	const abort = useCallback(() => wsRef.current?.send(JSON.stringify({ kind: "abort" })), [])
	const compact = useCallback(() => wsRef.current?.send(JSON.stringify({ kind: "compact" })), [])
	const switchRole = useCallback((r: AgentRole) => wsRef.current?.send(JSON.stringify({ kind: "switch_role", role: r })), [])

	return { role, messages, artifacts, streaming, send, abort, compact, switchRole }
}
```

### `apps/web/src/components/AgentTabs.tsx`

```tsx
import type { AgentRole } from "../lib/types"
import { cn } from "../lib/utils"

const tabs: Array<{ key: AgentRole; label: string; emoji: string; enabled: boolean }> = [
	{ key: "prd", label: "需求", emoji: "📝", enabled: true },
	{ key: "design", label: "设计", emoji: "📐", enabled: false },
	{ key: "dev", label: "开发", emoji: "💻", enabled: false },
	{ key: "review", label: "审查", emoji: "🔍", enabled: false },
]

export function AgentTabs({ role, onChange }: { role: AgentRole; onChange: (r: AgentRole) => void }) {
	return (
		<div className="flex items-center gap-1 px-3 h-12 border-b bg-white">
			<div className="text-base font-semibold mr-4">🛠️ 全栈智码</div>
			{tabs.map((t) => (
				<button
					key={t.key}
					disabled={!t.enabled}
					onClick={() => t.enabled && onChange(t.key)}
					className={cn(
						"px-3 py-1 rounded-md text-sm transition",
						role === t.key ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-100",
						!t.enabled && "opacity-40 cursor-not-allowed",
					)}
				>
					{t.emoji} {t.label} Agent
					{!t.enabled && <span className="ml-1 text-[10px] opacity-70">即将上线</span>}
				</button>
			))}
			<div className="ml-auto text-xs text-gray-500">Provider: DeepSeek</div>
		</div>
	)
}
```

### `apps/web/src/components/SessionSidebar.tsx`

```tsx
export function SessionSidebar({ projectId }: { projectId: string }) {
	return (
		<aside className="w-56 border-r bg-gray-50 flex flex-col">
			<div className="p-3 text-xs uppercase text-gray-500">会话历史</div>
			<div className="flex-1 overflow-auto px-2 space-y-1 text-sm">
				<div className="px-2 py-1.5 rounded bg-white border text-gray-800">📌 当前会话<div className="text-[11px] text-gray-500 mt-0.5">{projectId}</div></div>
				<div className="px-2 py-1 text-gray-400 text-xs">— 分支树将在 Day 2 接入 —</div>
			</div>
			<button className="m-2 px-3 py-1.5 text-sm rounded bg-blue-600 text-white hover:bg-blue-700">+ 新会话</button>
		</aside>
	)
}
```

### `apps/web/src/components/ToolCard.tsx`

```tsx
import { useState } from "react"
import { ChevronDown, ChevronRight, Loader2, CheckCircle2, XCircle, Wrench } from "lucide-react"

export function ToolCard({ name, params, chunks, result, isError, done }: { name: string; params: unknown; chunks: string[]; result?: unknown; isError?: boolean; done: boolean }) {
	const [open, setOpen] = useState(false)
	const Icon = !done ? Loader2 : isError ? XCircle : CheckCircle2
	const color = !done ? "text-orange-500" : isError ? "text-red-500" : "text-green-600"
	return (
		<div className="my-2 border border-orange-200 bg-orange-50/40 rounded-lg overflow-hidden">
			<button onClick={() => setOpen(!open)} className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-orange-50">
				{open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
				<Wrench className="w-4 h-4 text-orange-500" />
				<span className="font-mono">{name}</span>
				<Icon className={`w-4 h-4 ml-auto ${color} ${!done ? "animate-spin" : ""}`} />
			</button>
			{open && (
				<div className="px-3 py-2 border-t border-orange-200 text-xs space-y-2 bg-white">
					<div><div className="text-gray-500 mb-1">参数</div><pre className="bg-gray-50 p-2 rounded overflow-auto max-h-40">{JSON.stringify(params, null, 2)}</pre></div>
					{chunks.length > 0 && <div><div className="text-gray-500 mb-1">流式输出</div><pre className="bg-gray-50 p-2 rounded overflow-auto max-h-40">{chunks.join("")}</pre></div>}
					{done && <div><div className="text-gray-500 mb-1">结果</div><pre className="bg-gray-50 p-2 rounded overflow-auto max-h-40">{JSON.stringify(result, null, 2)}</pre></div>}
				</div>
			)}
		</div>
	)
}
```

### `apps/web/src/components/ThinkingCard.tsx`

```tsx
import { useState } from "react"
import { ChevronDown, ChevronRight, Brain } from "lucide-react"

export function ThinkingCard({ text }: { text: string }) {
	const [open, setOpen] = useState(false)
	if (!text) return null
	return (
		<div className="my-2 border border-purple-200 bg-purple-50/40 rounded-lg">
			<button onClick={() => setOpen(!open)} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-purple-700">
				{open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
				<Brain className="w-4 h-4" />
				<span>思考过程（{text.length} 字）</span>
			</button>
			{open && <pre className="px-3 pb-2 text-xs whitespace-pre-wrap text-purple-900 font-mono">{text}</pre>}
		</div>
	)
}
```

### `apps/web/src/components/MessageList.tsx`（**已改成桌面 Web 风格：全宽行 + 头像，无气泡**）

```tsx
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { FileText, AlertCircle, Bot, User } from "lucide-react"
import type { Msg } from "../lib/types"
import { ToolCard } from "./ToolCard"
import { ThinkingCard } from "./ThinkingCard"
import { useEffect, useRef } from "react"

/**
 * 桌面 Web 三栏布局中间列。仿 ChatGPT / Claude / openclaw：
 * - 整列白底，不用 chat 气泡
 * - 内容包裹在 max-w-3xl 居中容器里，长行不会拉到两端
 * - 用户 / Agent 用 32px 头像区分，全宽显示文字
 * - 工具卡 / artifact 提示对齐到内容主列（与头像左侧对齐）
 */
export function MessageList({ messages }: { messages: Msg[] }) {
	const endRef = useRef<HTMLDivElement>(null)
	useEffect(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), [messages])

	return (
		<div className="flex-1 overflow-auto bg-white">
			<div className="max-w-3xl mx-auto px-8 py-8 space-y-7">
				{messages.length === 0 && (
					<div className="text-center text-gray-400 text-sm mt-24">
						<div className="text-2xl mb-2">📝</div>
						<div>需求 Agent 已就绪。用一句话或一段描述讲清楚你的产品想法。</div>
					</div>
				)}
				{messages.map((m) => {
					if (m.kind === "user")
						return (
							<div key={m.id} className="flex gap-4">
								<div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center flex-shrink-0">
									<User className="w-4 h-4" />
								</div>
								<div className="flex-1 min-w-0 pt-1">
									<div className="text-xs text-gray-500 mb-1">你</div>
									<div className="whitespace-pre-wrap text-gray-900 leading-relaxed">{m.text}</div>
								</div>
							</div>
						)
					if (m.kind === "assistant")
						return (
							<div key={m.id} className="flex gap-4">
								<div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 text-white flex items-center justify-center flex-shrink-0">
									<Bot className="w-4 h-4" />
								</div>
								<div className="flex-1 min-w-0 pt-1">
									<div className="text-xs text-gray-500 mb-1">需求 Agent</div>
									<ThinkingCard text={m.thinking ?? ""} />
									<div className="prose prose-sm max-w-none text-gray-900 leading-relaxed">
										<ReactMarkdown remarkPlugins={[remarkGfm]}>{m.text || (m.done ? "" : "▍")}</ReactMarkdown>
									</div>
								</div>
							</div>
						)
					if (m.kind === "tool")
						return (
							<div key={m.id} className="flex gap-4">
								<div className="w-8 flex-shrink-0" />
								<div className="flex-1 min-w-0"><ToolCard {...m} /></div>
							</div>
						)
					if (m.kind === "artifact")
						return (
							<div key={m.id} className="flex gap-4">
								<div className="w-8 flex-shrink-0" />
								<div className="flex-1 flex items-center gap-2 bg-green-50 border border-green-200 text-green-800 rounded-lg px-3 py-2 text-sm">
									<FileText className="w-4 h-4" />
									<span>已生成 <b>{m.name}</b>（{m.version}，{(m.size / 1024).toFixed(1)} KB）</span>
									<span className="ml-auto text-xs text-green-600">→ 右侧产出物面板查看 / 导出</span>
								</div>
							</div>
						)
					if (m.kind === "error")
						return (
							<div key={m.id} className="flex gap-4">
								<div className="w-8 flex-shrink-0" />
								<div className="flex-1 flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-sm">
									<AlertCircle className="w-4 h-4" /> {m.text}
								</div>
							</div>
						)
					return null
				})}
				<div ref={endRef} />
			</div>
		</div>
	)
}
```

<aside>
🎨

**这一改动的视觉差异**：

- 不再有"用户消息靠右蓝气泡 / Agent 靠左白气泡"的对话框形态
- 改成单列从上往下流的 ChatGPT 排版：头像 + 角色名 + 内容
- 长 markdown / 表格 / 代码块在 ~640px 主列里舒展，不再被气泡裁切
- 工具卡和 artifact 提示会**与正文左对齐**（和头像列错开 8 + gap-4 = 48px），看起来更像 IDE 而不是 IM
</aside>

### `apps/web/src/components/InputBox.tsx`

```tsx
import { useState } from "react"
import { Send, Square } from "lucide-react"

export function InputBox({ streaming, onSend, onAbort }: { streaming: boolean; onSend: (t: string) => void; onAbort: () => void }) {
	const [text, setText] = useState("")
	const submit = () => {
		const v = text.trim()
		if (!v) return
		onSend(v)
		setText("")
	}
	return (
		<div className="border-t bg-white p-3">
			<div className="flex items-end gap-2 bg-gray-50 border rounded-xl p-2">
				<textarea
					value={text}
					onChange={(e) => setText(e.target.value)}
					onKeyDown={(e) => {
						if (e.key === "Enter" && !e.shiftKey) {
							e.preventDefault()
							submit()
						}
					}}
					placeholder="用一句话或一段描述讲清楚你的产品想法，或粘贴已有资料… (Enter 发送，Shift+Enter 换行)"
					rows={3}
					className="flex-1 bg-transparent resize-none outline-none text-sm"
				/>
				{streaming ? (
					<button onClick={onAbort} className="p-2 rounded-lg bg-red-500 text-white hover:bg-red-600"><Square className="w-4 h-4" /></button>
				) : (
					<button onClick={submit} className="p-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"><Send className="w-4 h-4" /></button>
				)}
			</div>
		</div>
	)
}
```

### `apps/web/src/components/ArtifactPanel.tsx`

```tsx
import { useEffect, useState } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { Download, FileText } from "lucide-react"
import type { ArtifactInfo } from "../lib/types"

export function ArtifactPanel({ projectId, artifacts }: { projectId: string; artifacts: ArtifactInfo[] }) {
	const [active, setActive] = useState<string | null>(null)
	const [content, setContent] = useState<string>("")

	useEffect(() => {
		if (!active) return
		fetch(`/artifacts/${projectId}/${active}`).then((r) => r.text()).then(setContent)
	}, [active, projectId, artifacts])

	useEffect(() => {
		if (!active && artifacts.length > 0) setActive(artifacts[0].name)
	}, [artifacts, active])

	return (
		<aside className="w-[420px] border-l bg-white flex flex-col">
			<div className="p-3 border-b text-sm font-semibold flex items-center gap-2"><FileText className="w-4 h-4" /> 产出物</div>
			<div className="flex gap-1 px-3 py-2 border-b overflow-x-auto">
				{artifacts.length === 0 && <div className="text-xs text-gray-400">还没有产出物，先和需求 Agent 聊聊吧</div>}
				{artifacts.map((a) => (
					<button key={a.name} onClick={() => setActive(a.name)} className={`px-2 py-1 text-xs rounded border ${active === a.name ? "bg-blue-50 border-blue-300 text-blue-700" : "hover:bg-gray-50"}`}>
						{a.name} <span className="text-gray-400">{a.version}</span>
					</button>
				))}
			</div>
			<div className="flex-1 overflow-auto px-4 py-3">
				{active ? (
					<div className="prose prose-sm max-w-none"><ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown></div>
				) : (
					<div className="text-xs text-gray-400 mt-10 text-center">选择左侧标签预览</div>
				)}
			</div>
			{active && (
				<div className="border-t p-3 flex gap-2">
					<a href={`/artifacts/${projectId}/${active}/download`} className="flex-1 text-center text-sm px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700 flex items-center justify-center gap-1">
						<Download className="w-4 h-4" /> 下载 .md
					</a>
					<button disabled className="flex-1 text-sm px-3 py-1.5 rounded border opacity-50" title="Day 3 接入">导出 .docx</button>
					<button disabled className="flex-1 text-sm px-3 py-1.5 rounded border opacity-50" title="Day 3 接入">导出 .pdf</button>
				</div>
			)}
		</aside>
	)
}
```

### `apps/web/src/components/ChatWindow.tsx`

```tsx
import { useAgentSocket } from "../hooks/useAgentSocket"
import { AgentTabs } from "./AgentTabs"
import { SessionSidebar } from "./SessionSidebar"
import { MessageList } from "./MessageList"
import { InputBox } from "./InputBox"
import { ArtifactPanel } from "./ArtifactPanel"

export function ChatWindow({ projectId }: { projectId: string }) {
	const { role, messages, artifacts, streaming, send, abort, switchRole } = useAgentSocket(projectId)
	return (
		<div className="flex flex-col h-full">
			<AgentTabs role={role} onChange={switchRole} />
			<div className="flex flex-1 min-h-0">
				<SessionSidebar projectId={projectId} />
				<div className="flex-1 flex flex-col min-w-0">
					<MessageList messages={messages} />
					<InputBox streaming={streaming} onSend={send} onAbort={abort} />
				</div>
				<ArtifactPanel projectId={projectId} artifacts={artifacts} />
			</div>
		</div>
	)
}
```

### `apps/web/src/App.tsx`

```tsx
import { useMemo } from "react"
import { ChatWindow } from "./components/ChatWindow"

export default function App() {
	const projectId = useMemo(() => {
		const k = "qzzm:projectId"
		let v = localStorage.getItem(k)
		if (!v) {
			v = `proj-${Math.random().toString(36).slice(2, 10)}`
			localStorage.setItem(k, v)
		}
		return v
	}, [])
	return <ChatWindow projectId={projectId} />
}
```

---

## 五、跑起来 & 验收清单

```bash
cd qzzm-pi
pnpm i
cp .env.example .env
# 编辑 .env，填 DEEPSEEK_API_KEY
pnpm dev
# 访问 http://localhost:5173
```

### Day 1 验收（你照着测一遍即可知道 Pi 在我们需求下怎么跑）

- [ ]  **流式**：发"做一个二手书交易平台"，能看到 DeepSeek 逐字吐 token
- [ ]  **追问**：Agent 会主动问 1-2 个澄清问题（验证 system prompt 生效）
- [ ]  **工具调用**：你说"先出第一版"后，能看到橙色 `write_prd` 工具卡，参数里有完整 PRD 内容，状态从 ⏳ 变 ✓
- [ ]  **Artifact**：消息流出现绿色"已生成 [prd.md](http://prd.md)"提示，右侧面板自动加载并 markdown 渲染 PRD
- [ ]  **多轮修改**：你说"加一节关于支付的内容"，Agent 调 `read_prd` 读旧版 + `write_prd` 写 v2，右侧自动刷新
- [ ]  **打断**：流式中点红色方块按钮，能 abort
- [ ]  **下载**：点产出物面板的"下载 .md"，浏览器下载完整 [prd.md](http://prd.md)
- [ ]  **会话持久化**：刷新页面（localStorage 留着 projectId），后端 `state/projects/<id>/sessions/prd.jsonl` 文件累加

---

## 六、Day 2~5 接续点（已经埋好了）

<aside>
🪜

所有扩展位都在代码里留好了，按顺序补：

- **Day 2**：`SessionSidebar` 接 `sessionManager.tree()` 渲染分支树；`ws.ts` 加 `fork` 消息处理
- **Day 3**：`ArtifactPanel` 的 docx/pdf 按钮接 `pandoc` 或 `puppeteer` 服务
- **Day 4**：`prompts.ts` 填设计 Agent prompt；`tools.ts` 加 `gen_ui_prototype`；新增 `/handoff/prd-to-design` REST
- **Day 5**：开发/审查 Agent 直接复用 Pi 自带 `codingTools`，把 `createSession.ts` 的 `customTools` 改 `tools: codingTools` 即可
</aside>

---

## 七、踩坑预案

| 症状 | 原因 | 处置 |
| --- | --- | --- |
| 启动报"未配置任何国产模型 API Key" | .env 未填 | 填 `DEEPSEEK_API_KEY` 后重启 |
| `registerCustomModel is not a function` | pi-coding-agent 版本字段差异 | 降级方案：在 `~/.pi/agent/models.json` 里手写一行 DeepSeek 配置（页内有示例） |
| DeepSeek 报 400 工具参数错误 | OpenAI 兼容 API 对工具 schema 有些严格 | 已用 `@sinclair/typebox` 标准 JSON Schema，应该 OK；若仍出错改成 `Type.Object({...}, { additionalProperties: false })` |
| 中文乱码 / 思考一直显示 `▍` | WS 帧未 flush | 检查浏览器 devtools Network → WS，看 `text_delta` 是否到达；不到就是后端没订阅成功 |
| 页面刷新后会话丢失 | 正常：当前 projectId 一致但前端没回填历史 | Day 2 加 `GET /sessions/:projectId/:role` 读 jsonl 并回放 |

[Day 1 配套文档（喂给 Claude Code，防止它瞎写）](%E5%85%A8%E6%A0%88%E6%99%BA%E7%A0%81%20%C2%B7%20Day%201%20%E5%8D%95%20Agent%20%E5%8F%AF%E8%B7%91%E5%B7%A5%E7%A8%8B%E5%8C%85%EF%BC%88DeepSeek%20+%20Pi%20SDK%EF%BC%89/Day%201%20%E9%85%8D%E5%A5%97%E6%96%87%E6%A1%A3%EF%BC%88%E5%96%82%E7%BB%99%20Claude%20Code%EF%BC%8C%E9%98%B2%E6%AD%A2%E5%AE%83%E7%9E%8E%E5%86%99%EF%BC%89%20cd0c5f616a754ee49613e396614dd086.md)