# DeepSeek / 通义 / 智谱 接入坑

## DeepSeek
- baseURL: `https://api.deepseek.com/v1`（结尾的 /v1 不能少）
- 模型：`deepseek-chat`（V3）、`deepseek-reasoner`（R1）
- contextWindow: 128k
- 函数调用兼容 OpenAI tools 协议，但对 JSON Schema 严格
- 不要用 Type.Any()、Type.Unknown()
- 嵌套对象建议加 additionalProperties: false

## 通义千问 (DashScope)
- baseURL: `https://dashscope.aliyuncs.com/compatible-mode/v1`
- 模型：`qwen-max`、`qwen2.5-coder-32b-instruct`

## 智谱 GLM
- baseURL: `https://open.bigmodel.cn/api/paas/v4`
- 模型：`glm-4-plus`

## 模型切换
改 .env 填对应 API_KEY，重启即可。
pickDefaultModel 按 deepseek → dashscope → zhipu 顺序选第一个有 key 的。
