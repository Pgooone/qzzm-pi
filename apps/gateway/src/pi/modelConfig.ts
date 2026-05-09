import { AuthStorage, ModelRegistry } from "@earendil-works/pi-coding-agent"

export function buildAuthAndRegistry() {
  const authStorage = AuthStorage.create()
  const registry = ModelRegistry.create(authStorage)

  // ===== DeepSeek V4 系列（2026-04-24 发布，hybrid thinking/non-thinking）=====
  // 文档：https://api-docs.deepseek.com/news/news260424
  // ⚠️ 旧别名 deepseek-chat / deepseek-reasoner 将于 2026-07-24 停用
  if (process.env.DEEPSEEK_API_KEY) {
    authStorage.setRuntimeApiKey("deepseek", process.env.DEEPSEEK_API_KEY)
    registry.registerProvider("deepseek", {
      baseUrl: process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com",
      apiKey: process.env.DEEPSEEK_API_KEY,
      api: "openai-completions",
      models: [
        {
          id: "deepseek-v4-pro",
          name: "DeepSeek V4 Pro",
          reasoning: true, // hybrid：thinkingLevel:"off" 走非思考，"high"/"xhigh" 走思考
          input: ["text"],
          // 75% off 优惠价格（2026-05-31 之前）
          cost: { inputPer1M: 0.435, outputPer1M: 0.87, cacheReadPer1M: 0.0435 },
          contextWindow: 1_048_576,
          maxTokens: 384_000,
        },
        {
          id: "deepseek-v4-flash",
          name: "DeepSeek V4 Flash",
          reasoning: true,
          input: ["text"],
          cost: { inputPer1M: 0.14, outputPer1M: 0.28, cacheReadPer1M: 0.014 },
          contextWindow: 1_048_576,
          maxTokens: 384_000,
        },
      ],
    })
  }

  // ===== 通义千问（fallback）=====
  if (process.env.DASHSCOPE_API_KEY) {
    authStorage.setRuntimeApiKey("dashscope", process.env.DASHSCOPE_API_KEY)
    registry.registerProvider("dashscope", {
      baseUrl: process.env.DASHSCOPE_BASE_URL ?? "https://dashscope.aliyuncs.com/compatible-mode/v1",
      apiKey: process.env.DASHSCOPE_API_KEY,
      api: "openai-completions",
      models: [
        {
          id: "qwen3-coder-plus",
          name: "通义千问 3 Coder Plus",
          reasoning: false,
          input: ["text"],
          cost: { inputPer1M: 4.0, outputPer1M: 16.0 },
          contextWindow: 256_000,
          maxTokens: 32_768,
        },
      ],
    })
  }

  // ===== 智谱 GLM（fallback）=====
  if (process.env.ZHIPU_API_KEY) {
    authStorage.setRuntimeApiKey("zhipu", process.env.ZHIPU_API_KEY)
    registry.registerProvider("zhipu", {
      baseUrl: process.env.ZHIPU_BASE_URL ?? "https://open.bigmodel.cn/api/paas/v4",
      apiKey: process.env.ZHIPU_API_KEY,
      api: "openai-completions",
      models: [
        {
          id: "glm-4-plus",
          name: "智谱 GLM-4 Plus",
          reasoning: false,
          input: ["text"],
          cost: { inputPer1M: 7.0, outputPer1M: 7.0 },
          contextWindow: 128_000,
          maxTokens: 4_096,
        },
      ],
    })
  }

  return { authStorage, registry }
}

export type RoleId = "prd" | "design" | "dev" | "review"

// 按角色选默认模型，首选 V4 Pro，其他作为 fallback
export function pickDefaultModel(registry: ReturnType<typeof buildAuthAndRegistry>["registry"], role: RoleId) {
  const candidates = role === "dev"
    ? [["deepseek", "deepseek-v4-pro"], ["dashscope", "qwen3-coder-plus"], ["deepseek", "deepseek-v4-flash"]]
    : [["deepseek", "deepseek-v4-pro"], ["deepseek", "deepseek-v4-flash"], ["dashscope", "qwen3-coder-plus"], ["zhipu", "glm-4-plus"]]
  for (const [p, id] of candidates) {
    const m = registry.find(p, id)
    if (m) return m
  }
  throw new Error("未配置任何可用模型，请检查 .env")
}

// 按角色决定 thinkingLevel（仅在模型支持 reasoning 时生效）
export function pickThinkingLevel(role: RoleId, modelSupportsReasoning: boolean): "off" | "low" | "medium" | "high" | "xhigh" {
  if (!modelSupportsReasoning) return "off"
  switch (role) {
    case "prd": return "low"
    case "design": return "medium"
    case "dev": return "high"
    case "review": return "medium"
  }
}
