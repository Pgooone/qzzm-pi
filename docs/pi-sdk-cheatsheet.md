# Pi Coding Agent SDK 速查（以 qzzm-pi/apps/gateway/src/pi 为准）

> 官方：https://pi.dev/docs/latest/sdk
> 本 cheatsheet 在 Day 1 跑通后以实际代码为准重写。Day 2 起增加 `pnpm verify-cheatsheet` 脚本跨验证。

## 包导入
```ts
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
```ts
const authStorage = AuthStorage.create()
authStorage.setRuntimeApiKey("deepseek", apiKey)  // 仅本进程不落盘
const registry = ModelRegistry.create(authStorage)
registry.registerProvider("deepseek", {
  baseUrl: "https://api.deepseek.com",
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
```ts
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
```ts
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
```ts
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
```ts
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
