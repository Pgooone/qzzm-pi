# 全栈智码 · Day 1 实跑回顾 + Day 2-6 修正项（Pgooone/qzzm-pi review）

<aside>
📦

**review 对象**：[github.com/Pgooone/qzzm-pi](http://github.com/Pgooone/qzzm-pi)

**结论先行**：Day 1 跑通验证了 SDK 嵌入路径可行；但暴露出 **5 类、共 14 个**必须在 Day 2-6 期间修掉的问题，外加 **1 处文档与代码的关键漂移**。下面给出全清单 + 路线图修正 + 6 个新决策点。

</aside>

## 一、最重要的发现：cheatsheet 漂移（必须立刻修）

你的实际跑通代码里，Pi SDK 注册模型用的是 **`registerProvider`**，不是我 cheatsheet 里写的 `registerCustomModel`。Claude Code 联网 WebFetch 把它改对了，但 `docs/pi-sdk-cheatsheet.md` 没回填。

| 位置 | cheatsheet 当前写的（错） | 仓库实际跑通的（对） |
| --- | --- | --- |
| 方法名 | `registerCustomModel({ provider, id, baseURL, ... })` | `registerProvider("deepseek", { baseUrl, apiKey, api, models:[...] })` |
| API 参数 | `api: "openai"` | `api: "openai-completions"` |
| baseUrl 大小写 | `baseURL` | `baseUrl` |
| 模型字段 | `{ supportsThinking, contextWindow, maxOutputTokens }` | `{ name, reasoning, input:["text"], cost:{...}, contextWindow, maxTokens }` |
| API Key 注入 | 未写 | `registerProvider` 的 options 里直接传 `apiKey`，**且**仍要 `authStorage.setRuntimeApiKey(...)`（双写） |

<aside>
⚠️

**Day 2 第一件事**：把 `docs/pi-sdk-cheatsheet.md` 替换为以仓库 `apps/gateway/src/pi/modelConfig.ts` 为标准的版本，否则后面 Day 3-6 的所有 LLM 相关改动都会带着错认知前进。

</aside>

---

## 二、Day 1 既有代码的 14 个改进点（按严重度排序）

### 🔴 高危（影响 Day 2-6 推进）

#### 2.1 `attachSession` 切换不 dispose 旧 session（apps/gateway/src/ws.ts:43）

现状：`switch_role` 只 `unsubAgent?.()`，**没有 `prevSession?.dispose()`**。只有 socket close 才 dispose。Day 6 加模型切换 chip 后，每切一次就泄漏一个 session（含 jsonl 文件锁、ResourceLoader、subscribe 队列）。

**修法**：`attachSession` 第一行加 `try { session?.dispose() } catch {}`。

#### 2.2 `noTools: "builtin"` 硬编码（apps/gateway/src/pi/createSession.ts:46）

所有 4 个角色都禁用了 Pi 内置 read/edit/write/bash。**Day 5 开发 Agent 要靠这些工具改代码**，不能再禁。

**修法**：改成 `noTools: role === "prd" || role === "design" || role === "review" ? "builtin" : undefined`（dev 时打开），同步更新 `agent-roles.md`。

#### 2.3 `thinkingLevel: "off"` 硬编码（同上 47）

Day 6 "thinking 折叠卡" 的展示需要至少某个角色开 thinking。

**修法**：role 映射表 `{ prd: "low", design: "medium", dev: "high", review: "medium" }`。但要注意 deepseek-chat 不支持 thinking，所以**必须和模型选择联动**：只有 deepseek-reasoner / qwen3-thinking 才打开。

#### 2.4 page reload 丢消息（apps/web/src/hooks/useAgentSocket.ts）

刷新就清空 `messages` 数组。即便 jsonl 在磁盘里，前端也看不到。Day 2 路线图里"历史回放"已经覆盖，但**优先级要提到 Day 2 第一项**。

#### 2.5 page reload 丢 artifact（apps/web/src/components/ArtifactPanel.tsx）

ArtifactPanel 只靠 WS 的 `artifact_updated` 推送。首次连接没有现存清单 → 已有的 PRD 看不到。

**修法**：`attachSession` 成功后，gateway 立即推一条 `{kind:"artifact_snapshot", artifacts:[...]}`；前端 hook 接收后初始化 `artifacts` state。**今天就能加**，不用等 Day 3。

### 🟡 中危（Day 2-3 期间收掉）

#### 2.6 `state/` 被 commit 到 GitHub

你这次提交把 `state/projects/proj-nda3qllf/sessions/prd.jsonl`（143KB）等都推上去了。`.gitignore` 只有 53 字节。

**修法**：`.gitignore` 加 `state/`、`.env`、`*.log`、`node_modules/`、`dist/`、`.DS_Store`、`*.tsbuildinfo`。Day 2 工程包里给一份完整模板。

#### 2.7 `artifactStore.list` 的过滤误杀（apps/gateway/src/store/artifactStore.ts:50）

`!f.includes(".v")` 会误杀任何文件名含 `.v` 子串的 artifact（例如未来的 `db.view.sql`）。

**修法**：精确正则 `/\.(v\d+|final)$/`。

#### 2.8 项目 ID 锁在浏览器 localStorage（apps/web/src/App.tsx）

换浏览器 / 清缓存 = 新 project。多浏览器协作不可能。

**修法**：Day 2 路线图的 `ProjectSwitcher` 解决；**但还要增加** URL 路由 `/project/:id`，让用户能贴链接分享。

#### 2.9 `readPrd` 不接受 version（apps/gateway/src/pi/tools.ts:30）

当前只读最新版本。Day 4 设计 Agent handoff 时往往要读"已 final 的 PRD"，不是当前草稿。

**修法**：`parameters: Type.Object({ version: Type.Optional(Type.String()) })`，并在 artifactStore 加 `loadVersion(projectId, name, version)`。

#### 2.10 `prompts.ts` 里 design/dev/review 仍是占位字符串（apps/gateway/src/pi/prompts.ts:18-20）

现在写的是 "`[Day 2 接入] 你是设计 Agent...`" 这种 1 行 stub。Day 4/5 接 Agent 之前必须补成完整 prompt（每条至少 200 行级别）。

**修法**：放到对应天的工程包里完整产出，**不要在 Day 2 改这块**（避免误用未完成的 prompt）。

### 🟢 低危（Day 6 收尾时收）

#### 2.11 InputBox 没有 compact 按钮（apps/web/src/components/InputBox.tsx）

useAgentSocket 暴露了 `compact` 但 UI 入口缺失。

**修法**：Day 6 在 InputBox 左下角加 `/compact` 小按钮 + 弹个 `instructions` 输入框。

#### 2.12 没有 compaction_*/auto_retry_*/turn_start/agent_start 事件处理（apps/gateway/src/ws.ts）

这些事件 Pi SDK 已经发，gateway 没转。Day 6 要补，否则 "压缩中卡" 和 "自动重试" 看不见。

#### 2.13 没有错误重试 UI（apps/web/src/hooks/useAgentSocket.ts case "error"）

现在 error 只渲染一条文字，没"重试"/"换模型重试"。Day 6 加。

#### 2.14 modelConfig.ts 的小错（apps/gateway/src/pi/modelConfig.ts:17）

`name: "DeepSeek V4 Pro"` — 实际 DeepSeek 当前是 V3.x（deepseek-chat / deepseek-reasoner）。Claude Code 误改了。

**修法**：改回 `"DeepSeek Chat"`，并加注释说明 reasoning 字段需要随模型换。

---

## 三、Day 2-6 路线图修正项

基于上面的发现，原路线图需要做 **11 处插入或调整**：

### Day 2 必须新增的事项（在原 "多 project + 分支树 + 历史回放" 之外）

| 新增项 | 对应改进点 | 预计代码量 |
| --- | --- | --- |
| **回填 cheatsheet**（registerProvider/baseUrl/api） | §一 | 30 行 doc |
| **修 .gitignore**（排除 state/） | §2.6 | 10 行 |
| **attachSession 加 prevSession.dispose** | §2.1 | 3 行 |
| **artifact_snapshot 握手推送**（gateway + hook 双改） | §2.5 | 50 行 |
| **artifactStore.list 改精确正则** | §2.7 | 1 行 |
| **URL 路由 /project/:id**（react-router-dom） | §2.8 | 40 行 |

→ Day 2 包总代码量从 ~600 行 → **~750 行**。仍可一天完成。

### Day 3 修正

- ArtifactPanel **已经有 docx/pdf 占位按钮但 404**，Day 3 直接接管即可，**不需要再改 UI**，只补后端。前端只加 `useExportJob` hook 和进度状态。
- → Day 3 包代码量 ~700 行 → **~600 行**（少一处 UI 重构）。

### Day 4 必须新增

- ArtifactPanel **必须扩展 type 分流**：根据 artifact name 后缀（.md / .html / .yaml / .sql）选择不同渲染器。当前只有 ReactMarkdown 一种。**这件事其实在 Day 2 加 artifact_snapshot 时一起做掉更好**。
- design Agent 完整 prompt 取代占位字符串（§2.10）。
- read_prd 加 version 参数（§2.9）。

### Day 5 必须新增

- createSession **必须支持按角色配 noTools**（§2.2）。
- createSession **必须支持按角色选模型**：dev 默认 `deepseek-coder` 或 `qwen3-coder-plus`，其他默认 `deepseek-chat`。原路线图 §九.6 的决策这里要落地。
- dev/review 的完整 prompt（§2.10）。

### Day 6 必须新增

- thinking 仅在模型支持时打开（§2.3）。
- session 切换的 dispose 修正必须**已在 Day 2 落地**，否则 Day 6 的模型切换会更严重泄漏。
- compaction/auto_retry/turn_start/agent_start 全套事件转发（§2.12）。
- 错误重试 + compact 按钮（§2.11、§2.13）。

---

## 四、新增的 6 个待确认决策点

这些是 review 出来的、原路线图里没覆盖的：

### 决策 A · cheatsheet 维护策略

- **推荐**：建一个 `pnpm verify-cheatsheet` 脚本（用 Claude Code 的 /verify-api 跑一遍 6 个核心 API：registerProvider、createAgentSession、defineTool、subscribe、prompt、[SessionManager.open](http://SessionManager.open)），每周日跑 + 每次升级 Pi 跑。
- 备选：每次报错才人肉更新（成本低但容易滞后，已经是当前状态）

### 决策 B · `noTools` 默认值

- **推荐**：PRD/Design/Review 用 `"builtin"`（关内置工具，强制走 customTools，可控），Dev 用 `undefined`（开放 read/edit/write/bash/grep/glob，赋能代码生成）
- 备选 A：全角色都开放（dev 体验最好但 PRD/Design 容易乱写文件）
- 备选 B：全角色都禁（dev 写不了代码，不可行）

### 决策 C · 历史回放策略（前端首次连）

- **推荐**：< 200 条全推；≥ 200 条只推最后 50 条 + 「加载更多历史」按钮
- 备选 A：永远全推（你目前 prd.jsonl 已经 143KB / 单 project 700+ 条消息，全推会卡前端）
- 备选 B：只推会话元数据，消息按需加载（实现复杂）

### 决策 D · 多浏览器协作

- **推荐**：Day 2 只做 URL 路由 `/project/:id` 让用户能贴链接，**不做实时协同**。两个人同时操作同一 project 会互相覆盖，文档里说明清楚。
- 备选 A：上 Yjs / CRDT 真协同（+3-5 天工作量，赛事不推荐）
- 备选 B：完全不管多浏览器（你现在的状态）

### 决策 E · artifacts 版本存储结构

- 现状：`artifacts/prd.md`（最新）+ `artifacts/prd.md.v1`、`prd.md.v2`、`prd.md.final`（历史）平铺在同一目录
- **推荐**：改成 `artifacts/prd.md`（最新）+ `artifacts/.versions/prd.md/v1`、`v2`、`final`（历史进子目录）。同时支持后续 design/dev 的多 artifact 不互相打架。
- 备选：保持现状（list 过滤更复杂，但迁移代价小）

### 决策 F · DeepSeek 模型命名修正

- 现状：`modelConfig.ts` 写 `name: "DeepSeek V4 Pro"`（错，DeepSeek 当前没有 V4）
- **推荐**：改成 `"DeepSeek Chat"`，同时在 modelConfig 里加一组 `deepseek-reasoner`（reasoning: true）作为 thinking 模型可选项（Day 6 切换用）
- 备选：保留错的命名，UI 里随便显示（不专业）

---

## 五、推荐执行顺序

<aside>
🛣️

**Day 2 起手 30 分钟**（在写新功能之前必须做）：

1. 回填 `docs/pi-sdk-cheatsheet.md`（决策 A 顺便定）
2. 修 `.gitignore`，删掉 git 里已经跟踪的 `state/`（`git rm -r --cached state`）
3. 修 `attachSession` 加 `prevSession?.dispose()`（决策 B 顺便定）
4. 修 `artifactStore.list` 正则
5. （可选）modelConfig.ts 把 "V4 Pro" 改回去

这 5 件事是 30 分钟内能做完的硬伤修复，做完再开 Day 2 主体（多 project + 分支树 + 历史回放 + artifact_snapshot）。

</aside>

## 六、需要你拍板的清单

请回复：

1. **§一 cheatsheet 漂移修法**：直接接受我以 modelConfig.ts 为标准回填 cheatsheet 吗？（推荐：是）
2. **§四 决策 A-F**：6 个全部按推荐走吗？还是某几个改？
3. **§三 路线图修正后的代码量**：Day 2 涨到 ~750 行、Day 3 降到 ~600 行，整体节奏不变，OK 吗？
4. **是否在 Day 2 包发出前先单独发一个「Day 1 硬伤修复 patch」**（只含 §五 的 5 件事 + 一份回填后的 cheatsheet），让你先合并 → 再开 Day 2 主体？这样 PR 边界清晰、回滚成本低。**强烈推荐这么做。**

你回个「按推荐执行」或「X 改成 Y」，我就开第一个 patch（§五 那 5 件事）。