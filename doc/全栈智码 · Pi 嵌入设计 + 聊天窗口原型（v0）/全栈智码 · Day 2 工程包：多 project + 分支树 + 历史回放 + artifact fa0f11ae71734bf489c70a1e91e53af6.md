# 全栈智码 · Day 2 工程包：多 project + 分支树 + 历史回放 + artifact_snapshot

<aside>
🎯

**前置条件**：`fix/day1-hardening-and-v4pro` 已合入 main。

**本包交付物**：仓库从单 project + 线性会话 → **多 project + 分支会话树 + 刷新不丢**

**估计代码量**：后端 ~420 行，前端 ~380 行，共 ~800 行。估计耗时 6-8 小时（1 天）。

**分支名**：`feat/day2-multi-project-and-branches`

</aside>

## 一、本包交付范围

决策锁板页里锁了 5 件在 Day 2 主体交付的事，全部在本包：

1. **多 project + URL 路由**（决策 D）：顶部加 ProjectSwitcher；`/project/:id` 路由；后端 projectStore、REST `/projects`。
2. **会话分支树 + fork/navigate**：sessionManager.tree() 包装 → SessionSidebar 画树；右键/按钮 fork；点节点 navigate。
3. **历史回放**（决策 C）：连接/刷新/navigate 后服务端推 history_replay；<200 全推，≥200 推最后 50 + load_more。
4. **artifact_snapshot 握手推送**（§2.5）：attachSession 后立即推一条 snapshot，前端初始化 artifacts state。
5. **artifacts/.versions 嵌套迁移**（决策 E）：启动时自动迁移旧文件。
6. **ArtifactPanel type 分流**：.md / .html / .yaml / .sql 不同渲染器。
7. **`pnpm verify-cheatsheet` 脚本**（决策 A）：CI 脚本跨验证 6 个核心 Pi SDK API。

另外小例：artifactStore 加 per-project mutex；WS 协议全面换为服务端发 messageId（为 fork-by-id 服务）。

## 二、文件矩阵

### 后端

| 状态 | 路径 | 说明 |
| --- | --- | --- |
| 新增 | `apps/gateway/src/store/projectStore.ts` | list/create/delete/touch project |
| 新增 | `apps/gateway/src/routes/projects.ts` | REST `/projects` 三个端点 |
| 新增 | `apps/gateway/src/services/sessionService.ts` | tree()/historyPage()/forkAt() 包装 |
| 重构 | `apps/gateway/src/store/artifactStore.ts` | .versions 嵌套 + mutex + migrate() |
| 重构 | `apps/gateway/src/ws.ts` |   • fork/navigate/load_history/snapshot/server-id |
| 修改 | `apps/gateway/src/index.ts` | 启动时跑 migrate；挂 projects routes |
| 修改 | `apps/gateway/src/artifacts.ts` | 适配 .versions；加 GET .../versions 列表 |

### 前端

| 状态 | 路径 | 说明 |
| --- | --- | --- |
| 新增 | `apps/web/src/components/ProjectSwitcher.tsx` | 顶部下拉 + 新建/删除 |
| 重写 | `apps/web/src/components/SessionSidebar.tsx` | 分支树可视化 + fork |
| 重构 | `apps/web/src/components/ArtifactPanel.tsx` | type 分流渲染 |
| 重构 | `apps/web/src/hooks/useAgentSocket.ts` |   • snapshot/history/server-id/reconnect |
| 重构 | `apps/web/src/App.tsx` | react-router 包装 |
| 修改 | `apps/web/src/main.tsx` | BrowserRouter |
| 修改 | `apps/web/src/lib/types.ts` |   • ProjectMeta/TreeNode/HistoryMessage |
| 修改 | `apps/web/package.json` |   • react-router-dom@6 |

### 脚本 & 根

| 状态 | 路径 | 说明 |
| --- | --- | --- |
| 新增 | `scripts/verify-cheatsheet.ts` | tsx 跑，WebFetch pi-mono types.ts 比对 6 个 API |
| 修改 | `package.json` (根) |   • `verify-cheatsheet` script |

## 三、WebSocket 协议变更

### 顶层包装

```tsx
// apps/gateway/src/ws.ts 中的类型应从单体拆出到 packages/shared (可选)
// 或者直接同步到 apps/web/src/lib/types.ts

export type InMsg =
  | { kind: "prompt"; text: string; behavior?: "steer" | "followUp" }
  | { kind: "abort" }
  | { kind: "compact"; instructions?: string }
  | { kind: "switch_role"; role: RoleId }
  | { kind: "fork"; messageId: string }              // 新：从某条服务器发的消息 fork
  | { kind: "navigate"; nodeId: string }             // 新：跳到树上某节点
  | { kind: "load_history"; before?: string; limit?: number } // 新：加载更多历史

export type OutMsg =
  | { kind: "hello"; projectId: string; role: RoleId; model: { id: string; name: string }; thinkingLevel: string }
  | { kind: "message_start"; messageId: string; role: "assistant" | "user"; nodeId?: string }
  | { kind: "text_delta"; messageId: string; chunk: string }
  | { kind: "thinking_delta"; messageId: string; chunk: string }
  | { kind: "message_end"; messageId: string }
  | { kind: "tool_start"; toolCallId: string; toolName: string; params: any }
  | { kind: "tool_update"; toolCallId: string; chunk: any }
  | { kind: "tool_end"; toolCallId: string; result: any; isError: boolean }
  | { kind: "turn_end" }
  | { kind: "agent_end" }
  | { kind: "artifact_updated"; artifact: ArtifactInfo }
  | { kind: "error"; message: string; retryable?: boolean }
  | { kind: "artifact_snapshot"; artifacts: ArtifactInfo[] }       // 新增
  | { kind: "tree_update"; tree: TreeNode[]; currentNodeId?: string } // 新增
  | { kind: "history_replay"; messages: HistoryMessage[]; hasMore: boolean; oldest?: string } // 新增
  | { kind: "session_cleared" }                                     // 新增：切角色后通知前端清空本地消息

export type TreeNode = {
  id: string
  parentId: string | null
  role: "user" | "assistant"
  preview: string  // 首 80 字
  ts: number
  isCurrent?: boolean
}

export type HistoryMessage = {
  id: string
  role: "user" | "assistant"
  text: string
  thinking?: string
  toolCalls?: Array<{ name: string; params: any; result?: any }>
  ts: number
}
```

### 关键不变项

- `text_delta` / `thinking_delta` / `tool_*` 原有字段保留
- `messageId` 从现在起 **全由服务端发**（以 nanoid 8 位），前端不再生成。fork/navigate 可以按 id 定位。

## 四、REST API 变更

| 方法 | 路径 | 请求/响应 |
| --- | --- | --- |
| GET | `/projects` | → `ProjectMeta[]` |
| POST | `/projects` | `{ name?: string }` → `ProjectMeta` |
| DELETE | `/projects/:id` | → `{ ok: true }` |
| GET | `/projects/:id/tree?role=prd` | → `{ tree: TreeNode[]; currentNodeId?: string }` |
| GET | `/artifacts/:projectId/:name/versions` | → `string[]` |
| GET | `/artifacts/:projectId/:name?version=v1` | → raw markdown（原有路由扩展） |

---

## 五、新文件代码

### 5.1 `apps/gateway/src/store/projectStore.ts`

```tsx
import { promises as fs } from "node:fs"
import path from "node:path"
import { customAlphabet } from "nanoid"

const nano = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 8)

export type ProjectMeta = {
  id: string
  name: string
  createdAt: number
  updatedAt: number
}

export class ProjectStore {
  constructor(private root: string) {}

  private dirOf(id: string) { return path.join(this.root, id) }
  private metaPath(id: string) { return path.join(this.dirOf(id), "meta.json") }

  async list(): Promise<ProjectMeta[]> {
    await fs.mkdir(this.root, { recursive: true })
    const entries = await fs.readdir(this.root, { withFileTypes: true })
    const out: ProjectMeta[] = []
    for (const e of entries) {
      if (!e.isDirectory()) continue
      try {
        const raw = await fs.readFile(this.metaPath(e.name), "utf-8")
        out.push(JSON.parse(raw))
      } catch {
        // 兼容 Day 1 老 project 没 meta.json
        const stat = await fs.stat(this.dirOf(e.name))
        const meta: ProjectMeta = {
          id: e.name,
          name: e.name,
          createdAt: stat.birthtimeMs,
          updatedAt: stat.mtimeMs,
        }
        await fs.writeFile(this.metaPath(e.name), JSON.stringify(meta, null, 2))
        out.push(meta)
      }
    }
    return out.sort((a, b) => b.updatedAt - a.updatedAt)
  }

  async create(name?: string): Promise<ProjectMeta> {
    const id = `proj-${nano()}`
    const now = Date.now()
    const meta: ProjectMeta = {
      id,
      name: name?.trim() || `项目 ${new Date(now).toLocaleString("zh-CN")}`,
      createdAt: now,
      updatedAt: now,
    }
    await fs.mkdir(this.dirOf(id), { recursive: true })
    await fs.writeFile(this.metaPath(id), JSON.stringify(meta, null, 2))
    return meta
  }

  async touch(id: string) {
    try {
      const raw = await fs.readFile(this.metaPath(id), "utf-8")
      const meta: ProjectMeta = JSON.parse(raw)
      meta.updatedAt = Date.now()
      await fs.writeFile(this.metaPath(id), JSON.stringify(meta, null, 2))
    } catch {
      // ignore
    }
  }

  async ensureExists(id: string): Promise<ProjectMeta> {
    try {
      const raw = await fs.readFile(this.metaPath(id), "utf-8")
      return JSON.parse(raw)
    } catch {
      // 首次访问一个从 URL 贴过来的 id，自动创建。
      const now = Date.now()
      const meta: ProjectMeta = { id, name: id, createdAt: now, updatedAt: now }
      await fs.mkdir(this.dirOf(id), { recursive: true })
      await fs.writeFile(this.metaPath(id), JSON.stringify(meta, null, 2))
      return meta
    }
  }

  async remove(id: string) {
    await fs.rm(this.dirOf(id), { recursive: true, force: true })
  }
}
```

### 5.2 `apps/gateway/src/routes/projects.ts`

```tsx
import type { FastifyInstance } from "fastify"
import { ProjectStore } from "../store/projectStore.js"
import { sessionService } from "../services/sessionService.js"

export default async function projectsRoutes(app: FastifyInstance, opts: { store: ProjectStore }) {
  const { store } = opts

  app.get("/projects", async () => {
    return await store.list()
  })

  app.post<{ Body: { name?: string } }>("/projects", async (req) => {
    return await store.create(req.body?.name)
  })

  app.delete<{ Params: { id: string } }>("/projects/:id", async (req) => {
    await store.remove(req.params.id)
    return { ok: true }
  })

  app.get<{ Params: { id: string }; Querystring: { role?: string } }>(
    "/projects/:id/tree",
    async (req) => {
      const role = (req.query.role || "prd") as any
      return await sessionService.getTree(req.params.id, role)
    }
  )
}
```

### 5.3 `apps/gateway/src/services/sessionService.ts`

```tsx
import path from "node:path"
import { promises as fs } from "node:fs"
import { SessionManager } from "@earendil-works/pi-coding-agent"
import type { RoleId } from "../pi/modelConfig.js"
import type { TreeNode, HistoryMessage } from "../ws.js"

const STATE_DIR = process.env.STATE_DIR ?? "./state"

function sessionFile(projectId: string, role: RoleId) {
  return path.join(STATE_DIR, "projects", projectId, "sessions", `${role}.jsonl`)
}

async function readJsonl(file: string): Promise<any[]> {
  try {
    const raw = await fs.readFile(file, "utf-8")
    return raw.split("\n").filter(Boolean).map((l) => JSON.parse(l))
  } catch {
    return []
  }
}

function toPreview(s: string): string {
  const flat = (s || "").replace(/\s+/g, " ").trim()
  return flat.length > 80 ? flat.slice(0, 80) + "…" : flat
}

export const sessionService = {
  /**
   * 返回会话分支树。Day 2 阶段先用最简单的“从 jsonl 重建线性树”实现，
   * 后续如果 Pi SDK 的 sessionManager.tree() 提供更丰富的 fork 元数据，再接入。
   */
  async getTree(projectId: string, role: RoleId): Promise<{ tree: TreeNode[]; currentNodeId?: string }> {
    const file = sessionFile(projectId, role)
    const lines = await readJsonl(file)
    let prevId: string | null = null
    const tree: TreeNode[] = []
    for (const ev of lines) {
      // 仅采样 user 和 assistant 的 message_end 作为节点
      if (ev.kind === "user_message" || (ev.type === "message_end" && ev.role)) {
        const id = ev.id || ev.messageId
        if (!id) continue
        tree.push({
          id,
          parentId: prevId,
          role: ev.role || "assistant",
          preview: toPreview(ev.text || ev.content || ""),
          ts: ev.ts || Date.now(),
        })
        prevId = id
      }
    }
    return { tree, currentNodeId: tree.at(-1)?.id }
  },

  /**
   * 返回历史消息页。决策 C：\<200 全推；≥200 只推最后 50 条 + hasMore。
   */
  async getHistory(projectId: string, role: RoleId, before?: string, limit = 50): Promise<{ messages: HistoryMessage[]; hasMore: boolean; oldest?: string }> {
    const file = sessionFile(projectId, role)
    const lines = await readJsonl(file)
    const all: HistoryMessage[] = lines
      .filter((ev) => ev.kind === "user_message" || ev.type === "message_end")
      .map((ev, i) => ({
        id: ev.id || ev.messageId || `legacy-${i}`,
        role: (ev.role || "assistant") as "user" | "assistant",
        text: ev.text || ev.content || "",
        thinking: ev.thinking,
        toolCalls: ev.toolCalls,
        ts: ev.ts || 0,
      }))

    if (all.length < 200 && !before) {
      return { messages: all, hasMore: false }
    }
    let endIdx = all.length
    if (before) {
      endIdx = all.findIndex((m) => m.id === before)
      if (endIdx < 0) endIdx = all.length
    }
    const start = Math.max(0, endIdx - limit)
    const slice = all.slice(start, endIdx)
    return {
      messages: slice,
      hasMore: start > 0,
      oldest: slice[0]?.id,
    }
  },
}
```

### 5.4 `apps/web/src/components/ProjectSwitcher.tsx`

```tsx
import { useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { ChevronDown, Plus, Trash2 } from "lucide-react"
import type { ProjectMeta } from "../lib/types"

export function ProjectSwitcher() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [list, setList] = useState<ProjectMeta[]>([])
  const current = list.find((p) => p.id === projectId)

  const load = async () => {
    const r = await fetch("/projects").then((r) => r.json())
    setList(r)
  }

  useEffect(() => { load() }, [])

  const onCreate = async () => {
    const name = window.prompt("项目名称（可留空）") ?? undefined
    const meta = await fetch("/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    }).then((r) => r.json())
    setOpen(false)
    navigate(`/project/${meta.id}`)
    await load()
  }

  const onDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!window.confirm("确认删除该项目？所有会话和产出物会被删除。")) return
    await fetch(`/projects/${id}`, { method: "DELETE" })
    await load()
    if (id === projectId && list.length > 1) {
      const next = list.find((p) => p.id !== id)
      if (next) navigate(`/project/${next.id}`)
    }
  }

  return (
    <div className="relative">
      <button
        className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-gray-200 hover:bg-gray-50 text-sm"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="max-w-[180px] truncate">{current?.name ?? "选择项目"}</span>
        <ChevronDown className="w-4 h-4 text-gray-400" />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 w-72 bg-white border border-gray-200 rounded-md shadow-lg z-50">
          <button
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 border-b border-gray-100"
            onClick={onCreate}
          >
            <Plus className="w-4 h-4" /> 新建项目
          </button>
          <div className="max-h-80 overflow-y-auto">
            {list.map((p) => (
              <button
                key={p.id}
                className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-sm text-left hover:bg-gray-50 ${p.id === projectId ? "bg-blue-50" : ""}`}
                onClick={() => { setOpen(false); navigate(`/project/${p.id}`) }}
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate">{p.name}</div>
                  <div className="text-xs text-gray-400">{new Date(p.updatedAt).toLocaleString("zh-CN")}</div>
                </div>
                <Trash2
                  className="w-4 h-4 text-gray-300 hover:text-red-500"
                  onClick={(e) => onDelete(p.id, e)}
                />
              </button>
            ))}
            {list.length === 0 && (
              <div className="px-3 py-6 text-center text-sm text-gray-400">
                还没有项目，点击上方 “新建” 开始
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
```

### 5.5 `scripts/verify-cheatsheet.ts`

```tsx
// 跑法：pnpm verify-cheatsheet
// 作用：跨验证 docs/pi-sdk-cheatsheet.md 中的 6 个核心 API 是否与 pi-mono 最新 types.ts 一致。
import { promises as fs } from "node:fs"
import path from "node:path"

const PI_TYPES_URL =
  "https://raw.githubusercontent.com/badlogic/pi-mono/main/packages/coding-agent/src/types.ts"

const CHECKS: Array<{ name: string; pattern: RegExp; mustExistInTypes: boolean }> = [
  { name: "createAgentSession", pattern: /createAgentSession\s*\(/, mustExistInTypes: true },
  { name: "AuthStorage.create", pattern: /class\s+AuthStorage|AuthStorage\.create/, mustExistInTypes: true },
  { name: "ModelRegistry.registerProvider", pattern: /registerProvider\s*\(/, mustExistInTypes: true },
  { name: "defineTool", pattern: /export\s+(function|const)\s+defineTool/, mustExistInTypes: true },
  { name: "session.subscribe", pattern: /subscribe\s*\(/, mustExistInTypes: true },
  { name: "SessionManager.open", pattern: /SessionManager[\s\S]{0,200}open\s*\(/, mustExistInTypes: true },
]

const FORBIDDEN_IN_CHEATSHEET = [
  "registerCustomModel",
  "baseURL", // 错拼写（正确是 baseUrl）
  "supportsThinking",
  '"openai"', // 应为 "openai-completions"
]

async function main() {
  const cheatsheet = await fs.readFile(path.resolve("docs/pi-sdk-cheatsheet.md"), "utf-8")

  // 1. 检查禁用词
  const violations: string[] = []
  for (const w of FORBIDDEN_IN_CHEATSHEET) {
    if (cheatsheet.includes(w)) violations.push(w)
  }

  // 2. 检查上游 types.ts
  const res = await fetch(PI_TYPES_URL)
  if (!res.ok) {
    console.error(`⚠️ 拉不劰上游 types.ts (status=${res.status})，打鱼跳过此项。`)
  } else {
    const types = await res.text()
    for (const c of CHECKS) {
      const inTypes = c.pattern.test(types)
      const inCheat = cheatsheet.includes(c.name) || c.pattern.test(cheatsheet)
      if (c.mustExistInTypes && !inTypes) {
        violations.push(`↑ 上游 types.ts 里没有 ${c.name}，可能 Pi 变更了 API。请手动检查。`)
      }
      if (!inCheat) {
        violations.push(`↓ cheatsheet 里没有 ${c.name}，可能遗漏了。`)
      }
    }
  }

  if (violations.length === 0) {
    console.log("✅ cheatsheet 与上游一致")
    return
  }
  console.error("❌ cheatsheet 验证失败：")
  for (const v of violations) console.error("  -", v)
  process.exit(1)
}
main().catch((e) => { console.error(e); process.exit(1) })
```

根 `package.json` scripts 添加：

```json
{
  "scripts": {
    "verify-cheatsheet": "tsx scripts/verify-cheatsheet.ts"
  },
  "devDependencies": {
    "tsx": "^4.0.0"
  }
}
```

---

## 六、重写文件关键代码

### 6.1 `apps/gateway/src/store/artifactStore.ts`（.versions 嵌套 + mutex + migrate）

```tsx
import { promises as fs } from "node:fs"
import path from "node:path"
import { EventEmitter } from "node:events"

export type ArtifactInfo = { name: string; version: string; size?: number; updatedAt?: number }

export const artifactBus = new EventEmitter()

const STATE_DIR = process.env.STATE_DIR ?? "./state"

// 简单的 per-project mutex，避免 save 并发造成 latest／version 不一致
const locks = new Map<string, Promise<unknown>>()
function withLock<T>(projectId: string, fn: () => Promise<T>): Promise<T> {
  const prev = locks.get(projectId) ?? Promise.resolve()
  const next = prev.then(fn, fn)
  locks.set(projectId, next.catch(() => {}))
  return next as Promise<T>
}

function artDir(projectId: string) {
  return path.join(STATE_DIR, "projects", projectId, "artifacts")
}
function versionsDir(projectId: string, name: string) {
  return path.join(artDir(projectId), ".versions", name)
}

export const artifactStore = {
  async save(projectId: string, name: string, version: string, content: string) {
    return withLock(projectId, async () => {
      const v = (version || "").replace(/^[vV]+/, "")
      const verLabel = version === "final" ? "final" : v ? `v${v}` : "v1"

      await fs.mkdir(artDir(projectId), { recursive: true })
      await fs.mkdir(versionsDir(projectId, name), { recursive: true })

      const latestPath = path.join(artDir(projectId), name)
      const versionPath = path.join(versionsDir(projectId, name), `${verLabel}${path.extname(name) || ".md"}`)
      await fs.writeFile(latestPath, content)
      await fs.writeFile(versionPath, content)

      const info: ArtifactInfo = { name, version: verLabel, size: Buffer.byteLength(content), updatedAt: Date.now() }
      artifactBus.emit("updated", projectId, info)
      return info
    })
  },

  async list(projectId: string): Promise<ArtifactInfo[]> {
    const dir = artDir(projectId)
    await fs.mkdir(dir, { recursive: true })
    const files = await fs.readdir(dir, { withFileTypes: true })
    const out: ArtifactInfo[] = []
    for (const f of files) {
      if (!f.isFile()) continue           // 跳过 .versions 目录
      if (f.name.startsWith(".")) continue
      const stat = await fs.stat(path.join(dir, f.name))
      out.push({ name: f.name, version: "latest", size: stat.size, updatedAt: stat.mtimeMs })
    }
    return out
  },

  async listVersions(projectId: string, name: string): Promise<string[]> {
    try {
      const files = await fs.readdir(versionsDir(projectId, name))
      return files.map((f) => f.replace(/\.[^.]+$/, "")).sort()
    } catch {
      return []
    }
  },

  async load(projectId: string, name: string, version?: string): Promise<string> {
    if (!version || version === "latest") {
      return await fs.readFile(path.join(artDir(projectId), name), "utf-8")
    }
    const ext = path.extname(name) || ".md"
    return await fs.readFile(path.join(versionsDir(projectId, name), `${version}${ext}`), "utf-8")
  },

  /**
   * 迁移 Day 1 的平铺版本文件 → .versions 嵌套。幂等。
   * 例：prd.md.v1 → .versions/prd.md/v1.md
   */
  async migrate(projectId: string) {
    const dir = artDir(projectId)
    let entries: string[] = []
    try { entries = await fs.readdir(dir) } catch { return }
    for (const f of entries) {
      const m = f.match(/^(.+?)\.(v\d+|final)$/)
      if (!m) continue
      const [, baseName, label] = m
      const ext = path.extname(baseName) || ".md"
      const dest = path.join(versionsDir(projectId, baseName), `${label}${ext}`)
      await fs.mkdir(path.dirname(dest), { recursive: true })
      await fs.rename(path.join(dir, f), dest)
    }
  },

  async migrateAll() {
    const root = path.join(STATE_DIR, "projects")
    let pids: string[] = []
    try { pids = await fs.readdir(root) } catch { return }
    for (const pid of pids) await this.migrate(pid)
  },
}
```

### 6.2 `apps/gateway/src/ws.ts`（核心改动，在 Day 1 hardening 基础上）

在 socket 连接后的部分重写 `attachSession` 和增加几个 handler：

```tsx
import { customAlphabet } from "nanoid"
import { sessionService } from "./services/sessionService.js"
import { projectStore } from "./store/projectStore.js" // 在 index.ts 里实例化后传入

const mid = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 8)

async function attachSession(role: RoleId) {
  // Day 1 hardening 保留
  try { unsubAgent?.() } catch {}
  try { session?.dispose() } catch {}
  unsubAgent = undefined
  session = undefined

  await projectStore.ensureExists(projectId)
  await projectStore.touch(projectId)

  const created = await createRoleSession(projectId, role)
  session = created.session

  // 推 hello
  send({
    kind: "hello",
    projectId,
    role,
    model: { id: (created.model as any).id, name: (created.model as any).name },
    thinkingLevel: created.thinkingLevel,
  })

  // 推 artifact 快照（§2.5）
  const arts = await artifactStore.list(projectId)
  send({ kind: "artifact_snapshot", artifacts: arts })

  // 推历史（决策 C）
  const hist = await sessionService.getHistory(projectId, role)
  send({ kind: "history_replay", messages: hist.messages, hasMore: hist.hasMore, oldest: hist.oldest })

  // 推分支树
  const tree = await sessionService.getTree(projectId, role)
  send({ kind: "tree_update", tree: tree.tree, currentNodeId: tree.currentNodeId })

  // 订阅事件转发（以下为关键改动：服务端发 messageId）
  let currentMessageId: string | null = null
  unsubAgent = session.subscribe((event: any) => {
    switch (event.type) {
      case "message_start": {
        currentMessageId = mid()
        send({ kind: "message_start", messageId: currentMessageId, role: "assistant" })
        break
      }
      case "message_update": {
        const e = event.assistantMessageEvent
        if (!currentMessageId) return
        if (e?.type === "text_delta") send({ kind: "text_delta", messageId: currentMessageId, chunk: e.text })
        else if (e?.type === "thinking_delta") send({ kind: "thinking_delta", messageId: currentMessageId, chunk: e.thinking })
        break
      }
      case "message_end": {
        if (currentMessageId) send({ kind: "message_end", messageId: currentMessageId })
        currentMessageId = null
        break
      }
      case "tool_execution_start":
        send({ kind: "tool_start", toolCallId: event.toolCallId, toolName: event.toolName, params: event.params })
        break
      case "tool_execution_update":
        send({ kind: "tool_update", toolCallId: event.toolCallId, chunk: event.update })
        break
      case "tool_execution_end":
        send({ kind: "tool_end", toolCallId: event.toolCallId, result: event.result, isError: !!event.isError })
        break
      case "turn_end":
        send({ kind: "turn_end" })
        break
      case "agent_end":
        send({ kind: "agent_end" })
        // 发送最新树
        sessionService.getTree(projectId, role).then((t) =>
          send({ kind: "tree_update", tree: t.tree, currentNodeId: t.currentNodeId })
        )
        break
    }
  })
}

// === 消息处理增加 ===
socket.on("message", async (raw) => {
  let msg: InMsg
  try { msg = JSON.parse(raw.toString()) } catch { return }

  switch (msg.kind) {
    case "prompt":
      // 服务端为该用户消息分配 id，同步推一条 message_start (role: "user")
      const userId = mid()
      send({ kind: "message_start", messageId: userId, role: "user" })
      send({ kind: "text_delta", messageId: userId, chunk: msg.text })
      send({ kind: "message_end", messageId: userId })
      await session?.prompt(msg.text, { streamingBehavior: msg.behavior ?? "steer" })
      await projectStore.touch(projectId)
      break
    case "abort":
      session?.abort()
      break
    case "compact":
      session?.compact(msg.instructions)
      break
    case "switch_role":
      send({ kind: "session_cleared" }) // 告诉前端清空本地消息
      await attachSession(msg.role)
      break
    case "fork": {
      // Pi sessionManager.fork(messageId) 是未来能力；Day 2 阶段用“重建 session 并限制到指定 id”的最简实现
      send({ kind: "session_cleared" })
      // 调用 session.fork(...) 或 sessionManager.tree() 指定节点，留位。
      // 如果 Pi 当前版本不支持，用 sessionService 的 “多 session 文件” 兑现：
      //   复制 jsonl 到 sessions/${role}.${forkSuffix}.jsonl，仅保留到指定 id 为止
      // 进度详见 sessionService.forkAt() 实现（TODO）
      break
    }
    case "navigate":
      // 同上，需依赖 sessionManager.navigate 能力。Day 2 先推一条 history_replay 同节点 id 作为最后条
      const h = await sessionService.getHistory(projectId, currentRole, msg.nodeId, 50)
      send({ kind: "history_replay", messages: h.messages, hasMore: h.hasMore, oldest: h.oldest })
      break
    case "load_history": {
      const r = await sessionService.getHistory(projectId, currentRole, msg.before, msg.limit ?? 50)
      send({ kind: "history_replay", messages: r.messages, hasMore: r.hasMore, oldest: r.oldest })
      break
    }
  }
})
```

<aside>
⚠️

**关于 fork/navigate 的实现限制**：Pi SDK 的 sessionManager API 在本项目进行到这一步时，可能只提供了 `tree()` 读取、不一定提供 `fork()` 写入。**请 Claude Code 首先 WebFetch** [https://raw.githubusercontent.com/badlogic/pi-mono/main/packages/coding-agent/src/types.ts](https://raw.githubusercontent.com/badlogic/pi-mono/main/packages/coding-agent/src/types.ts) **核实**：

- 如果 `sessionManager.fork(messageId)` 存在：直接调用，Day 2 一次性做完。
- 如果不存在：Day 2 只提供“**只读查看**”（navigate 只推历史不改 session 状态，fork 按钮临时置灰 + tooltip），并在 README 标类为「fork 写入能力待 Pi 上游升级」。

**本包默认走底底方案（只读）**，不阻塞 Day 3-6。

</aside>

### 6.3 `apps/web/src/hooks/useAgentSocket.ts`（重构要点）

```tsx
import { useEffect, useRef, useState } from "react"
import type { OutMsg, InMsg, RoleId, ArtifactInfo, TreeNode, HistoryMessage } from "../lib/types"

export type Message = {
  id: string
  role: "user" | "assistant"
  text: string
  thinking?: string
  toolCalls: Array<{ id: string; name: string; params: any; result?: any; isError?: boolean }>
  ts: number
}

export function useAgentSocket(projectId: string) {
  const [role, setRole] = useState<RoleId>("prd")
  const [messages, setMessages] = useState<Message[]>([])
  const [artifacts, setArtifacts] = useState<ArtifactInfo[]>([])
  const [tree, setTree] = useState<TreeNode[]>([])
  const [currentNodeId, setCurrentNodeId] = useState<string | undefined>()
  const [hasMoreHistory, setHasMoreHistory] = useState(false)
  const [oldestHistoryId, setOldestHistoryId] = useState<string | undefined>()
  const [streaming, setStreaming] = useState(false)
  const [connected, setConnected] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectRef = useRef(0)

  const connect = () => {
    const proto = location.protocol === "https:" ? "wss" : "ws"
    const ws = new WebSocket(`${proto}://${location.host}/ws/${projectId}`)
    wsRef.current = ws
    ws.onopen = () => { setConnected(true); reconnectRef.current = 0 }
    ws.onclose = () => {
      setConnected(false)
      // 指数退避重连：200ms → 最多 5s
      const delay = Math.min(5000, 200 * Math.pow(2, reconnectRef.current++))
      setTimeout(() => connect(), delay)
    }
    ws.onmessage = (e) => {
      const m = JSON.parse(e.data) as OutMsg
      switch (m.kind) {
        case "hello":
          setRole(m.role)
          break
        case "artifact_snapshot":
          setArtifacts(m.artifacts)
          break
        case "history_replay":
          // 如果是首次（messages 为空）直接填；如果是 加载更多，拼在前面
          setMessages((prev) => {
            if (prev.length === 0) return m.messages.map(toLocal)
            return [...m.messages.map(toLocal), ...prev]
          })
          setHasMoreHistory(m.hasMore)
          setOldestHistoryId(m.oldest)
          break
        case "tree_update":
          setTree(m.tree)
          setCurrentNodeId(m.currentNodeId)
          break
        case "session_cleared":
          setMessages([])
          break
        case "message_start":
          setMessages((prev) => [...prev, { id: m.messageId, role: m.role, text: "", toolCalls: [], ts: Date.now() }])
          if (m.role === "assistant") setStreaming(true)
          break
        case "text_delta":
          setMessages((prev) => prev.map((x) => x.id === m.messageId ? { ...x, text: x.text + m.chunk } : x))
          break
        case "thinking_delta":
          setMessages((prev) => prev.map((x) => x.id === m.messageId ? { ...x, thinking: (x.thinking ?? "") + m.chunk } : x))
          break
        case "message_end":
          // no-op。streaming 下面由 agent_end 清理
          break
        case "tool_start":
          setMessages((prev) => {
            const last = prev.at(-1)
            if (!last) return prev
            return prev.map((x) => x === last ? { ...x, toolCalls: [...x.toolCalls, { id: m.toolCallId, name: m.toolName, params: m.params }] } : x)
          })
          break
        case "tool_update":
          // 现阶段只作为心跳，不更新 UI
          break
        case "tool_end":
          setMessages((prev) => prev.map((x) => ({
            ...x,
            toolCalls: x.toolCalls.map((t) => t.id === m.toolCallId ? { ...t, result: m.result, isError: m.isError } : t),
          })))
          break
        case "artifact_updated":
          setArtifacts((prev) => {
            const i = prev.findIndex((a) => a.name === m.artifact.name)
            if (i < 0) return [...prev, m.artifact]
            const next = [...prev]; next[i] = m.artifact; return next
          })
          break
        case "agent_end":
          setStreaming(false)
          break
        case "error":
          setMessages((prev) => [...prev, { id: `err-${Date.now()}`, role: "assistant", text: `❌ ${m.message}`, toolCalls: [], ts: Date.now() }])
          setStreaming(false)
          break
      }
    }
  }

  useEffect(() => {
    connect()
    return () => { wsRef.current?.close() }
  }, [projectId])

  const send = (m: InMsg) => wsRef.current?.send(JSON.stringify(m))

  return {
    role, messages, artifacts, tree, currentNodeId, streaming, connected,
    hasMoreHistory, oldestHistoryId,
    prompt: (text: string) => send({ kind: "prompt", text, behavior: "steer" }),
    abort: () => send({ kind: "abort" }),
    compact: (instructions?: string) => send({ kind: "compact", instructions }),
    switchRole: (r: RoleId) => send({ kind: "switch_role", role: r }),
    fork: (messageId: string) => send({ kind: "fork", messageId }),
    navigate: (nodeId: string) => send({ kind: "navigate", nodeId }),
    loadMoreHistory: () => oldestHistoryId && send({ kind: "load_history", before: oldestHistoryId, limit: 50 }),
  }
}

function toLocal(h: HistoryMessage): Message {
  return {
    id: h.id,
    role: h.role,
    text: h.text,
    thinking: h.thinking,
    toolCalls: (h.toolCalls ?? []).map((t, i) => ({ id: `${h.id}-t${i}`, name: t.name, params: t.params, result: t.result })),
    ts: h.ts,
  }
}
```

### 6.4 `apps/web/src/components/SessionSidebar.tsx`（重写）

```tsx
import { GitBranch, MessageSquare, Bot, User } from "lucide-react"
import type { TreeNode } from "../lib/types"

export function SessionSidebar({
  tree, currentNodeId, hasMore, onLoadMore, onNavigate, onFork,
}: {
  tree: TreeNode[]
  currentNodeId?: string
  hasMore: boolean
  onLoadMore: () => void
  onNavigate: (nodeId: string) => void
  onFork: (nodeId: string) => void
}) {
  return (
    <aside className="w-56 border-r border-gray-200 bg-gray-50 flex flex-col">
      <div className="px-3 py-2 text-xs text-gray-500 flex items-center gap-1.5">
        <GitBranch className="w-3.5 h-3.5" /> 会话树 ({tree.length})
      </div>
      {hasMore && (
        <button className="text-xs text-blue-600 hover:underline px-3 py-1" onClick={onLoadMore}>
          加载更早历史
        </button>
      )}
      <div className="flex-1 overflow-y-auto">
        {tree.map((n) => (
          <div
            key={n.id}
            className={`group relative px-3 py-2 cursor-pointer hover:bg-white border-l-2 ${n.id === currentNodeId ? "border-blue-500 bg-white" : "border-transparent"}`}
            onClick={() => onNavigate(n.id)}
          >
            <div className="flex items-start gap-2">
              {n.role === "user"
                ? <User className="w-3.5 h-3.5 mt-0.5 text-gray-400 shrink-0" />
                : <Bot className="w-3.5 h-3.5 mt-0.5 text-purple-500 shrink-0" />}
              <div className="text-xs text-gray-700 line-clamp-2 flex-1 min-w-0">{n.preview}</div>
            </div>
            <button
              className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 text-xs text-gray-400 hover:text-blue-600"
              onClick={(e) => { e.stopPropagation(); onFork(n.id) }}
              title="从这里 fork"
            >
              ⦂
            </button>
          </div>
        ))}
        {tree.length === 0 && (
          <div className="px-3 py-6 text-center text-xs text-gray-400">还没有对话</div>
        )}
      </div>
    </aside>
  )
}
```

### 6.5 `apps/web/src/components/ArtifactPanel.tsx`（type 分流）

```tsx
import { useEffect, useState } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { Download, FileText, Code, Layout } from "lucide-react"
import type { ArtifactInfo } from "../lib/types"

function kindOf(name: string): "md" | "html" | "yaml" | "sql" | "text" {
  const ext = name.toLowerCase().split(".").pop() ?? ""
  if (ext === "md" || ext === "markdown") return "md"
  if (ext === "html" || ext === "htm") return "html"
  if (ext === "yaml" || ext === "yml") return "yaml"
  if (ext === "sql") return "sql"
  return "text"
}

function iconOf(k: string) {
  if (k === "html") return <Layout className="w-3 h-3" />
  if (k === "sql" || k === "yaml") return <Code className="w-3 h-3" />
  return <FileText className="w-3 h-3" />
}

export function ArtifactPanel({ projectId, artifacts }: { projectId: string; artifacts: ArtifactInfo[] }) {
  const [active, setActive] = useState<string | null>(null)
  const [content, setContent] = useState("")

  useEffect(() => {
    if (!active) return
    fetch(`/artifacts/${projectId}/${encodeURIComponent(active)}`)
      .then((r) => r.text())
      .then(setContent)
  }, [active, projectId, artifacts])

  useEffect(() => {
    if (!active && artifacts.length > 0) setActive(artifacts[0].name)
  }, [artifacts, active])

  const k = active ? kindOf(active) : "text"

  return (
    <aside className="w-[420px] border-l border-gray-200 bg-white flex flex-col">
      <div className="px-4 py-3 text-sm font-medium border-b border-gray-100">产出物</div>
      <div className="flex flex-wrap gap-1 px-3 py-2 border-b border-gray-100">
        {artifacts.length === 0 && <span className="text-xs text-gray-400">还没有产出物，先和需求 Agent 聊聊吧</span>}
        {artifacts.map((a) => (
          <button
            key={a.name}
            onClick={() => setActive(a.name)}
            className={`flex items-center gap-1 px-2 py-1 text-xs rounded border ${active === a.name ? "bg-blue-50 border-blue-300 text-blue-700" : "hover:bg-gray-50"}`}
          >
            {iconOf(kindOf(a.name))}
            {a.name}
            <span className="text-gray-400">{a.version}</span>
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-auto">
        {!active && <div className="p-6 text-xs text-gray-400">选择上方标签预览</div>}
        {active && k === "md" && (
          <div className="prose prose-sm max-w-none p-6">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
          </div>
        )}
        {active && k === "html" && (
          <iframe
            title={active}
            srcDoc={content}
            className="w-full h-full border-0"
            sandbox="allow-scripts allow-same-origin"
          />
        )}
        {active && (k === "yaml" || k === "sql" || k === "text") && (
          <pre className="p-6 text-xs whitespace-pre-wrap font-mono">{content}</pre>
        )}
      </div>
      {active && (
        <div className="flex gap-2 px-3 py-2 border-t border-gray-100">
          <a
            href={`/artifacts/${projectId}/${encodeURIComponent(active)}/download`}
            className="flex items-center gap-1 px-2 py-1 text-xs rounded border hover:bg-gray-50"
          >
            <Download className="w-3 h-3" /> 下载原文
          </a>
          {/* Day 3 由后端提供 /export/docx /export/pdf 端点，这里作为占位保留 */}
          <button className="px-2 py-1 text-xs rounded border text-gray-300 cursor-not-allowed" title="Day 3 接入">导出 .docx</button>
          <button className="px-2 py-1 text-xs rounded border text-gray-300 cursor-not-allowed" title="Day 3 接入">导出 .pdf</button>
        </div>
      )}
    </aside>
  )
}
```

### 6.6 `apps/web/src/App.tsx` + `main.tsx`

```tsx
// App.tsx
import { Routes, Route, Navigate, useParams } from "react-router-dom"
import { useEffect, useState } from "react"
import { ChatWindow } from "./components/ChatWindow"
import { ProjectSwitcher } from "./components/ProjectSwitcher"
import type { ProjectMeta } from "./lib/types"

function ProjectPage() {
  const { projectId } = useParams<{ projectId: string }>()
  if (!projectId) return null
  return (
    <div className="h-screen flex flex-col">
      <header className="h-12 px-4 flex items-center gap-3 border-b border-gray-200">
        <span className="font-semibold">全栈智码</span>
        <ProjectSwitcher />
      </header>
      <ChatWindow projectId={projectId} />
    </div>
  )
}

function Bootstrap() {
  const [list, setList] = useState<ProjectMeta[]>([])
  useEffect(() => {
    fetch("/projects").then((r) => r.json()).then(setList)
  }, [])
  if (list.length > 0) return <Navigate to={`/project/${list[0].id}`} replace />
  return (
    <div className="h-screen flex items-center justify-center">
      <button
        className="px-4 py-2 bg-blue-600 text-white rounded"
        onClick={async () => {
          const r = await fetch("/projects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) }).then((r) => r.json())
          location.replace(`/project/${r.id}`)
        }}
      >创建你的第一个项目</button>
    </div>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/project/:projectId" element={<ProjectPage />} />
      <Route path="*" element={<Bootstrap />} />
    </Routes>
  )
}
```

```tsx
// main.tsx
import React from "react"
import ReactDOM from "react-dom/client"
import { BrowserRouter } from "react-router-dom"
import App from "./App"
import "./index.css"

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
)
```

### 6.7 `apps/gateway/src/index.ts`（启动插入）

```tsx
// 在 dotenv 成功后增加：
import { ProjectStore } from "./store/projectStore.js"
import projectsRoutes from "./routes/projects.js"
import { artifactStore } from "./store/artifactStore.js"

const STATE_DIR = process.env.STATE_DIR ?? "./state"
export const projectStore = new ProjectStore(path.join(STATE_DIR, "projects"))

// 启动时一次性迁移 Day 1 旧 artifact 布局
await artifactStore.migrateAll()

await app.register(projectsRoutes, { store: projectStore })
```

## 七、提交顺序

```bash
git checkout -b feat/day2-multi-project-and-branches

# 1. 后端 项目 store + REST
git add apps/gateway/src/store/projectStore.ts apps/gateway/src/routes/projects.ts
git commit -m "feat(gateway): add ProjectStore and /projects REST routes"

# 2. 后端 sessionService + ws 协议扩展
git add apps/gateway/src/services/sessionService.ts apps/gateway/src/ws.ts
git commit -m "feat(gateway): server-issued messageId, history replay, tree, snapshot"

# 3. artifactStore .versions 重构
git add apps/gateway/src/store/artifactStore.ts apps/gateway/src/index.ts apps/gateway/src/artifacts.ts
git commit -m "refactor(artifact): nested .versions dir, mutex, startup migration"

# 4. 前端 router + ProjectSwitcher
git add apps/web/package.json apps/web/src/main.tsx apps/web/src/App.tsx apps/web/src/components/ProjectSwitcher.tsx
git commit -m "feat(web): react-router, ProjectSwitcher, /project/:id"

# 5. 前端 hook 重构 + SessionSidebar + ArtifactPanel
git add apps/web/src/hooks/useAgentSocket.ts apps/web/src/components/SessionSidebar.tsx apps/web/src/components/ArtifactPanel.tsx apps/web/src/lib/types.ts
git commit -m "feat(web): branch tree, history replay, artifact type routing"

# 6. verify-cheatsheet
git add scripts/verify-cheatsheet.ts package.json
git commit -m "chore: add verify-cheatsheet script"

git push -u origin feat/day2-multi-project-and-branches
```

## 八、验收清单

- [ ]  `pnpm dev` 启动后控制台输出 `[gateway] migrated N artifacts under .versions/`
- [ ]  顶部点 ProjectSwitcher，能看到 Day 1 遗留的 3 个 project（e2e-test-001、proj-nda3qllf、proj-zxhj9ylp）
- [ ]  顶部点 “新建项目”，URL 跳到 `/project/proj-xxx`，会话为空
- [ ]  进旧 project，**刷新后消息仍在**（history_replay 生效），**artifact 也在**（snapshot 生效）
- [ ]  右侧列表列出会话树，点节点能跳（只读 navigate）
- [ ]  点 fork 按钮：如 Pi SDK 支持 fork 则生效；不支持则提示“待 Pi 升级”不会报错
- [ ]  artifact 面板能点开 .md（markdown 渲染）、.html（iframe）、.yaml/.sql（原文）
- [ ]  `pnpm verify-cheatsheet` 跰起来绿色输出 `✅ cheatsheet 与上游一致`
- [ ]  state/projects/<任一>/artifacts 下 **不再有 [prd.md](http://prd.md).v1** 文件，进了 .versions/[prd.md/v1.md](http://prd.md/v1.md)
- [ ]  临时断网 5s 后重联，前端能自动重连（看 connected 状态切换）

## 九、下一步

Day 2 合入 main 后，我依次开：

- **Day 3 工程包**：导出三件套（md → docx via pandoc · md → pdf via puppeteer headless · 表格 → xlsx via exceljs） + Day 3 接接 ArtifactPanel 中占位的 docx/pdf 按钮 + 导出进度事件
- **Day 4 工程包**：设计 Agent 完整 prompt + write_design 工具 + 产出 单文件 HTML+Tailwind CDN 高保真原型 + ArtifactPanel iframe 已在 Day 2 接好
- **Day 5 工程包**：开发 Agent 完整 prompt + 3 套 scaffold 模板（React+Express · Next.js · Vue+Express） + 软沙箱 + dev 角色 noTools=undefined 打开 + Pi 内置工具验证
- **Day 6 工程包**：审查 Agent + thinking slider + 模型切换 chip + compaction/auto_retry 事件 UI + 错误重试 + compact 按钮 + ModelChip

每天的包都会是“1 页 + 可执行”，按 Day 1/Day 2 这个密度来。