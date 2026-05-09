# 4 Agent 职责契约

| Role | Tab | 输入 | 工具 | 产出 | 移交给 |
|---|---|---|---|---|---|
| 需求 prd | 📝 | 用户描述 | write_prd, read_prd | artifacts/prd.md | 设计读 prd.md |
| 设计 design | 📐 (Day 4) | prd.md | write_design, gen_ui_html | artifacts/design.md, artifacts/ui/*.html | 开发读两者 |
| 开发 dev | 💻 (Day 5) | prd.md + design.md | Pi codingTools | apps/<生成项目>/ 整个代码树 | 审查 |
| 审查 review | 🔍 (Day 5) | 代码 + 文档 | readOnlyTools + write_review | artifacts/review.md | 回到需求/开发循环 |

## 系统提示词位置
`apps/gateway/src/pi/prompts.ts` 的 `SYSTEM_PROMPTS` 对象。

## 加新角色 SOP
1. `prompts.ts` 加 system prompt
2. `tools.ts` 写 `buildXxxTools(projectId)` 函数
3. `createSession.ts` 在 `toolsForRole` switch 加 case
4. 前端 `AgentTabs.tsx` 把对应 tab 的 enabled 改 true
5. 不需要改 ws.ts（事件透传通用）
