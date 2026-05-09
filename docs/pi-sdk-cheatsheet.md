# Pi Coding Agent SDK 速查（v0.74）

> 官方在线文档：https://pi.dev/docs/latest/sdk

## 包导入
```ts
import {
  createAgentSession,
  AuthStorage,
  ModelRegistry,
  SessionManager,
  DefaultResourceLoader,
  defineTool,
  codingTools,       // 内置：read/write/edit/bash/grep/glob 等
  readOnlyTools,     // 内置：只读子集
} from "@earendil-works/pi-coding-agent"
import { Type } from "@sinclair/typebox"
```

## createAgentSession 完整签名
```ts
const { session } = await createAgentSession({
  cwd: string,
  agentDir: string,
  authStorage: AuthStorage,
  modelRegistry: ModelRegistry,
  model: ModelDescriptor,
  thinkingLevel: "off"|"minimal"|"low"|"medium"|"high"|"xhigh",
  customTools?: Tool[],
  sessionManager?: SessionManager,
  resourceLoader?: DefaultResourceLoader,
})
```

## AuthStorage + ModelRegistry
```ts
const authStorage = AuthStorage.create()
authStorage.setRuntimeApiKey("deepseek", apiKey)  // 仅本进程，不落盘
const registry = ModelRegistry.create(authStorage)
registry.registerCustomModel({
  provider: "deepseek",
  id: "deepseek-chat",
  baseURL: "https://api.deepseek.com/v1",
  api: "openai",
  contextWindow: 128_000,
  maxOutputTokens: 8_192,
  supportsThinking: false,
})
const model = registry.find("deepseek", "deepseek-chat")
```

## defineTool 标准模板
```ts
const writePrd = defineTool({
  name: "write_prd",
  label: "写入 PRD",
  description: "...",
  parameters: Type.Object({
    content: Type.String({ description: "..." }),
    version: Type.String(),
  }, { additionalProperties: false }),
  execute: async (toolCallId, params, signal, onUpdate) => {
    return {
      content: [{ type: "text", text: "OK" }],
      details: { path: "/abs/path", size: 1234 },
    }
  },
})
```
返回必须是 `{ content: ToolResultContent[], details? }`，不要返回 string。

## 事件订阅
```ts
const unsub = session.subscribe((event) => {
  switch (event.type) {
    case "message_start":
    case "message_update": {
      const e = event.assistantMessageEvent
      // e.type ∈ "text_delta" | "thinking_delta"
      break
    }
    case "message_end":
    case "tool_execution_start":   // event.toolCallId, event.toolName, event.params
    case "tool_execution_update":  // event.toolCallId, event.update
    case "tool_execution_end":     // event.toolCallId, event.result, event.isError
    case "turn_start":
    case "turn_end":
    case "agent_start":
    case "agent_end":
  }
})
```

## 操作
```ts
await session.prompt(text, { images?, streamingBehavior?: "steer" | "followUp" })
session.abort()
session.compact(instructions?)
session.dispose()
session.isStreaming   // boolean
```

## ❌ 不要做
- 不要 import 内部子路径
- 不要在 tool execute 里 throw
- 不要并发对同一 session 调 prompt()
- 不要用 Type.Any() / Type.Unknown() — DeepSeek 会拒
