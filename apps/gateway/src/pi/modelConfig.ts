import { AuthStorage, ModelRegistry } from "@earendil-works/pi-coding-agent"

export function buildAuthAndRegistry() {
  const authStorage = AuthStorage.create()
  const modelRegistry = ModelRegistry.create(authStorage)

  // DeepSeek（首选）
  if (process.env.DEEPSEEK_API_KEY) {
    authStorage.setRuntimeApiKey("deepseek", process.env.DEEPSEEK_API_KEY)
    modelRegistry.registerProvider("deepseek", {
      baseUrl: process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com/v1",
      apiKey: process.env.DEEPSEEK_API_KEY,
      api: "openai-completions",
      models: [{
        id: process.env.DEEPSEEK_MODEL ?? "deepseek-chat",
        name: "DeepSeek V4 Pro",
        reasoning: false,
        input: ["text"],
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        contextWindow: 128_000,
        maxTokens: 8_192,
      }],
    })
  }

  // 通义千问（备选 1）
  if (process.env.DASHSCOPE_API_KEY) {
    authStorage.setRuntimeApiKey("dashscope", process.env.DASHSCOPE_API_KEY)
    modelRegistry.registerProvider("dashscope", {
      baseUrl: process.env.DASHSCOPE_BASE_URL ?? "https://dashscope.aliyuncs.com/compatible-mode/v1",
      apiKey: process.env.DASHSCOPE_API_KEY,
      api: "openai-completions",
      models: [{
        id: process.env.DASHSCOPE_MODEL ?? "qwen2.5-coder-32b-instruct",
        name: "通义千问 Coder",
        reasoning: false,
        input: ["text"],
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        contextWindow: 131_072,
        maxTokens: 8_192,
      }],
    })
  }

  // 智谱 GLM（备选 2）
  if (process.env.ZHIPU_API_KEY) {
    authStorage.setRuntimeApiKey("zhipu", process.env.ZHIPU_API_KEY)
    modelRegistry.registerProvider("zhipu", {
      baseUrl: process.env.ZHIPU_BASE_URL ?? "https://open.bigmodel.cn/api/paas/v4",
      apiKey: process.env.ZHIPU_API_KEY,
      api: "openai-completions",
      models: [{
        id: process.env.ZHIPU_MODEL ?? "glm-4-plus",
        name: "智谱 GLM-4 Plus",
        reasoning: false,
        input: ["text"],
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        contextWindow: 128_000,
        maxTokens: 4_096,
      }],
    })
  }

  return { authStorage, modelRegistry }
}

export function pickDefaultModel(registry: ReturnType<typeof buildAuthAndRegistry>["modelRegistry"]) {
  const order: Array<[string, string]> = [
    ["deepseek", process.env.DEEPSEEK_MODEL ?? "deepseek-chat"],
    ["dashscope", process.env.DASHSCOPE_MODEL ?? "qwen2.5-coder-32b-instruct"],
    ["zhipu", process.env.ZHIPU_MODEL ?? "glm-4-plus"],
  ]
  for (const [provider, id] of order) {
    const m = registry.find(provider, id)
    if (m) return m
  }
  throw new Error("未配置任何国产模型 API Key，请编辑 .env")
}
