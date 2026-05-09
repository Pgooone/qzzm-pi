# 全栈智码 · Day 1（Claude Code 工作手册）

> 你（Claude Code）每次开 session 都会自动读取这个文件。它是项目宪法。
> 细节通过 `@docs/xxx.md` 按需展开看，不要跳过本文件直接编码。

## 1. 项目一句话
基于 Pi Coding Agent SDK 嵌入 4 个专业 Agent（需求/设计/开发/审查），
Day 1 只激活需求 Agent，验证流式 + 自定义工具 + 国产模型 + 产出物链路。

## 2. 技术栈（不要替换）
- 前端：React 18 + Vite 5 + Tailwind 3 + lucide-react + react-markdown
- 后端：Node 20 + TypeScript + Fastify 4 + @fastify/websocket + @earendil-works/pi-coding-agent ^0.74
- 模型：DeepSeek 主力（OpenAI 兼容），通义千问 / 智谱 GLM 备选
- 包管理：pnpm 9 + workspaces
- 不用：沙箱、Docker、Redis、数据库（一切落盘到 ./state/）

## 3. 跑起来
```
pnpm i
cp .env.example .env   # 必填 DEEPSEEK_API_KEY
pnpm dev               # 同时起 web@5173 + gateway@8787
```
浏览器开 http://localhost:5173

## 4. 文件地图（不要乱挪）
- `apps/web/src/components/`            — 所有 UI 组件
- `apps/web/src/hooks/useAgentSocket.ts` — 唯一的 WS 客户端
- `apps/gateway/src/pi/`                 — Pi SDK 嵌入相关都在这
- `apps/gateway/src/ws.ts`               — 前后端协议唯一桥
- `apps/gateway/src/store/artifactStore.ts` — 落盘 + 事件总线
- `state/projects/<id>/`                 — 运行时数据

## 5. Do
- 加新工具 → `apps/gateway/src/pi/tools.ts` 用 `defineTool` + typebox
- 加新 Agent 角色 → @docs/agent-roles.md
- 改 WS 消息 → 同时改 `ws.ts` + `useAgentSocket.ts` + `lib/types.ts`
- 加新国产模型 → `modelConfig.ts` 仿照 DeepSeek 注册
- 任何产物 → `artifactStore.save()`，不要直接 fs.writeFile
- 中文优先，注释简洁，函数组件

## 6. Don't
- ❌ 不要换 Pi SDK 包名 / 主版本
- ❌ 不要改聊天 UI 回气泡样式（已经是桌面 Web 风格）
- ❌ 不要在 web 端直接写文件 — 一切产物经 gateway artifactStore
- ❌ 不要在 prompts.ts 里硬编码 PRD 模板
- ❌ 不要把 API Key 写进代码 — 只走 .env
- ❌ 不要给前端加 Redux/Zustand
- ❌ 不要在 ws.ts 里写业务逻辑 — 只做事件转发
- ❌ 不要 import Pi SDK 的内部子路径

## 7. 关键参考
- @docs/pi-sdk-cheatsheet.md           — Pi API 速查（防幻觉）
- @docs/pi-integration-architecture.md — 多 Agent 嵌入模式
- @docs/agent-roles.md                 — 4 Agent 职责 + handoff 契约
- @docs/ws-protocol.md                 — WS 消息契约
- @docs/conventions.md                 — TS / 命名 / 提交约定
- @docs/deepseek-notes.md              — DeepSeek/Qwen/GLM 接入坑
