# 全栈智码 · Day 1

## 启动

```bash
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
