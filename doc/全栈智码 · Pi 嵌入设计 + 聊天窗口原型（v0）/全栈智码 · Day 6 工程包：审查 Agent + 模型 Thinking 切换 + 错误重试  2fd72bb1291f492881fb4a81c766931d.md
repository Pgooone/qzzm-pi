# 全栈智码 · Day 6 工程包：审查 Agent + 模型/Thinking 切换 + 错误重试 + Compact

<aside>
🎯

**前置**：Day 5 已合入 main。

**交付物**：

1. 审查 Agent（[review.md](http://review.md) + test-report.xlsx + [bug-list.md](http://bug-list.md)）
2. ModelChip 下拉切换模型、ThinkingSlider 调思考强度
3. Compact 按钮 + compaction_*/auto_retry_* 事件 UI
4. 错误重试按钮 + “换模型重试”

**代码量**：prompt ~250 行 · tools ~80 行 · 前端 · ~280 行。估计 6-7 小时。

**分支名**：`feat/day6-review-and-polish`

</aside>

## 一、审查 Agent 职责

- 读 [design.md](http://design.md) + workspace 代码 + (可选) PRD
- 产出三个 artifact：
    1. [**review.md**](http://review.md) 代码质量审查：一致性 · 安全 · 性能 · 可读性 · 测试覆盖
    2. [**bug-list.md**](http://bug-list.md) bug 清单（以表格，能被 Day 3 导出为 xlsx）
    3. [**test-report.md**](http://test-report.md) 测试报告：跟踪 [design.md](http://design.md) 里的 user journey 逐个检查实际代码是否覆盖

## 二、文件矩阵

| 状态 | 路径 | 说明 |
| --- | --- | --- |
| 新增 | `apps/gateway/src/pi/prompts/review.ts` | 审查 prompt |
| 新增 | `apps/gateway/src/pi/tools/reviewTools.ts` | read_code/run_tests/write_review |
| 修改 | `apps/gateway/src/pi/tools.ts` | review case |
| 修改 | `apps/gateway/src/ws.ts` |   • compaction_*/auto_retry_* 转发 + switch_model handler |
| 新增 | `apps/web/src/components/ModelChip.tsx` | 下拉切换模型 |
| 新增 | `apps/web/src/components/ThinkingSlider.tsx` | 5 档思考强度 |
| 新增 | `apps/web/src/components/CompactCard.tsx` | 压缩中卡 |
| 修改 | `apps/web/src/components/InputBox.tsx` |   • Compact 按钮 |
| 修改 | `apps/web/src/components/MessageList.tsx` | error 气泡加重试按钮 |
| 修改 | `apps/web/src/hooks/useAgentSocket.ts` |   • compaction/retry 状态 + switchModel/setThinking |

## 三、WS 协议最后一轮扩展

```tsx
export type InMsg = ... 
  | { kind: "switch_model"; provider: string; modelId: string }
  | { kind: "set_thinking"; level: "off" | "low" | "medium" | "high" | "xhigh" }
  | { kind: "retry"; messageId?: string }

export type OutMsg = ...
  | { kind: "compaction_start" }
  | { kind: "compaction_end"; summary?: string }
  | { kind: "auto_retry_start"; reason: string }
  | { kind: "auto_retry_end"; success: boolean }
  | { kind: "model_changed"; model: { id: string; name: string }; thinkingLevel: string }
```

`ws.ts` 里订阅 Pi 事件加入：

```tsx
case "compaction_start": send({ kind: "compaction_start" }); break
case "compaction_end":   send({ kind: "compaction_end", summary: event.summary }); break
case "auto_retry_start": send({ kind: "auto_retry_start", reason: event.reason }); break
case "auto_retry_end":   send({ kind: "auto_retry_end", success: !event.failed }); break
```

InMsg 处理：

```tsx
case "switch_model":
  send({ kind: "session_cleared" }) // 不丢消息则不发 cleared；V4 hybrid 只改 thinking 不需要
  // 重建 session 或 如果同 provider、仅换 thinkingLevel 则调 session.setThinkingLevel(...)
  break
case "set_thinking":
  // 如 Pi 提供 session.setThinkingLevel(level) 则直接调；否则重建 session
  break
case "retry":
  // 在上下文中重发最后一条 user message
  break
```

<aside>
⚠️

Day 6 开始前请 Claude Code WebFetch types.ts 确认 `session.setThinkingLevel(...)` 是否存在。不存在则走 “重建 session” 路径（V4 同模型，刷新会话代价小）。

</aside>

## 四、ModelChip + ThinkingSlider

```tsx
// apps/web/src/components/ModelChip.tsx
import { ChevronDown } from "lucide-react"
import { useState } from "react"

const MODELS = [
  { provider: "deepseek", id: "deepseek-v4-pro", name: "DeepSeek V4 Pro" },
  { provider: "deepseek", id: "deepseek-v4-flash", name: "DeepSeek V4 Flash" },
  { provider: "dashscope", id: "qwen3-coder-plus", name: "通义 Qwen3 Coder" },
  { provider: "zhipu", id: "glm-4-plus", name: "智谱 GLM-4 Plus" },
]

export function ModelChip({ current, onChange }: { current?: { id: string; name: string }; onChange: (provider: string, id: string) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <button className="flex items-center gap-1 px-2 py-1 text-xs rounded border hover:bg-gray-50" onClick={() => setOpen((v) => !v)}>
        {current?.name ?? "选模型"} <ChevronDown className="w-3 h-3" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-56 bg-white border border-gray-200 rounded-md shadow-lg z-50">
          {MODELS.map((m) => (
            <button key={m.id} className={`w-full px-3 py-2 text-xs text-left hover:bg-gray-50 ${current?.id === m.id ? "bg-blue-50" : ""}`}
              onClick={() => { setOpen(false); onChange(m.provider, m.id) }}>
              {m.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
```

```tsx
// ThinkingSlider.tsx——5 档 + "同模型切换思考强度"
import { Brain } from "lucide-react"

const LEVELS = ["off", "low", "medium", "high", "xhigh"] as const
export function ThinkingSlider({ value, onChange, disabled }: { value: string; onChange: (v: typeof LEVELS[number]) => void; disabled?: boolean }) {
  return (
    <div className="flex items-center gap-1 text-xs" title={disabled ? "当前模型不支持 thinking" : "调节思考强度"}>
      <Brain className="w-3 h-3 text-gray-400" />
      {LEVELS.map((l) => (
        <button key={l} disabled={disabled}
          className={`px-1.5 py-0.5 rounded ${value === l ? "bg-purple-100 text-purple-700" : "text-gray-400 hover:text-gray-700"} disabled:opacity-30`}
          onClick={() => onChange(l)}>
          {l}
        </button>
      ))}
    </div>
  )
}
```

## 五、错误重试 + Compact 按钮

```tsx
// MessageList.tsx error 气泡里加
if (m.text.startsWith("❌")) {
  return <div>
    <div>{m.text}</div>
    <button onClick={() => retry(m.id)} className="text-xs text-blue-600 hover:underline">重试</button>
    <button onClick={() => retryWithModel(m.id, "deepseek-v4-flash")} className="text-xs text-blue-600 hover:underline ml-2">换 V4 Flash 重试</button>
  </div>
}
```

```tsx
// InputBox.tsx 左下角加
<button onClick={() => {
  const ins = prompt("压缩说明（可留空）")
  onCompact(ins ?? undefined)
}} className="text-xs text-gray-400 hover:text-gray-700" title="/compact">
  压缩上下文
</button>
```

## 六、CompactCard 状态卡

```tsx
// 在 streaming 上方显示一条
function CompactCard({ status, summary }: { status: "running" | "done"; summary?: string }) {
  return (
    <div className="my-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded text-xs flex items-center gap-2">
      {status === "running" ? "压缩上下文中…" : <>压缩完成。{summary && <span className="text-gray-500">{summary.slice(0, 80)}</span>}</>}
    </div>
  )
}
```

## 七、提交顺序

```bash
git checkout -b feat/day6-review-and-polish

# 1. 审查 Agent
git add apps/gateway/src/pi/prompts/review.ts apps/gateway/src/pi/tools/reviewTools.ts apps/gateway/src/pi/tools.ts apps/gateway/src/pi/prompts.ts
git commit -m "feat(review): review agent prompt and tools"

# 2. ws 协议扩展
git add apps/gateway/src/ws.ts
git commit -m "feat(ws): compaction/auto_retry events; switch_model/set_thinking/retry handlers"

# 3. 前端 ModelChip + ThinkingSlider + CompactCard
git add apps/web/src/components/ModelChip.tsx apps/web/src/components/ThinkingSlider.tsx apps/web/src/components/CompactCard.tsx
git commit -m "feat(web): model chip, thinking slider, compact card"

# 4. 错误重试 + compact 按钮 + hook 扩展
git add apps/web/src/components/MessageList.tsx apps/web/src/components/InputBox.tsx apps/web/src/hooks/useAgentSocket.ts apps/web/src/lib/types.ts
git commit -m "feat(web): error retry, compact button, hook extensions"

git push -u origin feat/day6-review-and-polish
```

## 八、验收清单

- [ ]  点 ModelChip，选 V4 Flash → 下一次提问生效，后端 WS 推 `model_changed`
- [ ]  ThinkingSlider 拖 high → 后端调 `setThinkingLevel("high")` 或重建 session；V4 Flash 选 off 时为同模型 non-thinking
- [ ]  闲聊超 60 轮后，Pi 自动 compaction，UI 出现 “压缩上下文中…” 黄色卡，结束后变 “压缩完成”
- [ ]  点 InputBox “压缩上下文” 按钮，同样出黄卡
- [ ]  人为拔 API key 让请求报错 → error 气泡出 “重试”和 “换 V4 Flash 重试”，点 “重试” 能重发
- [ ]  点 review tab 输入“开始”：Agent 依次调 read_design → read_code → (可选) run_tests → write_review × 3（[review.md](http://review.md) · [bug-list.md](http://bug-list.md) · [test-report.md](http://test-report.md)）
- [ ]  [bug-list.md](http://bug-list.md) 点 “导出 .xlsx”：Day 3 接管的脚本能识别其中表格生成 sheet
- [ ]  auto_retry：人为让上游 5xx（例如改 base_url 为错误端点）后Agent 调用 → UI 出现 “auto retry…” 及原因提示

## 九、下一步

Day 6 合入 main 后，**六天路径走完**。推荐后续三件事：

1. **赛事演示脚本**：准备一个从需求 → 设计 → 代码 → 审查 走完的 demo project（推荐选 “企业差旅报销系统”这种中等复杂度）。创建 `scripts/demo.sh`，预装 prompts。
2. **部署**：准备 Dockerfile + docker-compose，state 目录挂卷，上阐云（运行起来 ≈ 1G 内存，2C2G 就够）。
3. **项目介绍页**：为评委准备一份 README + 架构图（可复用 Day 4 的 ui-prototype.html 生产流程为产品面里面）。

## 十、依赖总结表

Day 1-6 合集后的全部依赖：

| 包 | 位置 | 用途 |
| --- | --- | --- |
| @earendil-works/pi-coding-agent | gateway | Pi SDK |
| fastify、@fastify/websocket | gateway | HTTP/WS 服务 |
| @sinclair/typebox | gateway | tool params 校验 |
| nanoid | gateway | id 生成 |
| marked、docx、puppeteer、exceljs | gateway (Day 3) | 导出三件套 |
| react、react-dom、react-router-dom | web (Day 2) | 前端 |
| react-markdown、remark-gfm | web | artifact 渲染 |
| lucide-react | web | 图标 |
| tailwindcss | web | 样式 |
| tsx | root | verify-cheatsheet 脚本跑法 |