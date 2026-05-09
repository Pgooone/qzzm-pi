# WS 协议（前后端唯一桥）

路径：`ws://localhost:8787/ws/:projectId`

## 客户端 → 服务端 (InMsg)
```
{ kind: "prompt",      text: string, behavior?: "steer"|"followUp" }
{ kind: "abort" }
{ kind: "compact",     instructions?: string }
{ kind: "switch_role", role: "prd"|"design"|"dev"|"review" }
```

## 服务端 → 客户端 (OutMsg)
```
{ kind: "hello",            projectId, role }
{ kind: "message_start",    messageId }
{ kind: "text_delta",       messageId, delta }
{ kind: "thinking_delta",   messageId, delta }
{ kind: "message_end",      messageId }
{ kind: "tool_start",       toolCallId, name, params }
{ kind: "tool_update",      toolCallId, chunk }
{ kind: "tool_end",         toolCallId, isError, result }
{ kind: "turn_end" }
{ kind: "agent_end" }
{ kind: "artifact_updated", artifact: { name, version, size, kind } }
{ kind: "error",            message }
```

## 加新事件 SOP
1. `ws.ts` 的 OutMsg/InMsg 加分支
2. 出站: `session.subscribe` switch 里 send
3. `useAgentSocket.ts` 加 onmessage case
4. `types.ts` 同步 Msg 类型
5. `MessageList.tsx` 加渲染分支
