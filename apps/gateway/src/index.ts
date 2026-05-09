import dotenv from "dotenv"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { existsSync } from "node:fs"

// Walk up from this file's directory to find .env
const __dirname = dirname(fileURLToPath(import.meta.url))
let dir = __dirname
while (dir !== dirname(dir)) {
  const envPath = join(dir, ".env")
  if (existsSync(envPath)) {
    dotenv.config({ path: envPath })
    break
  }
  dir = dirname(dir)
}

// Fallback: try CWD
if (!process.env.DEEPSEEK_API_KEY) {
  dotenv.config()
}

// 动态 import 确保 dotenv 在所有模块加载前完成
const { log } = await import("./lib/log.js")
const { artifactStore } = await import("./store/artifactStore.js")
const { projectStore } = await import("./store/projectStore.js")
const { registerWsRoutes } = await import("./ws.js")
const { registerArtifactRoutes } = await import("./artifacts.js")
const projectsRoutes = await import("./routes/projects.js")
const exportRoutes = await import("./routes/export.js")

const { default: Fastify } = await import("fastify")
const { default: cors } = await import("@fastify/cors")
const { default: websocket } = await import("@fastify/websocket")

// 启动时一次性迁移 Day 1 旧 artifact 布局
await artifactStore.migrateAll()

const app = Fastify({ logger: false })
await app.register(cors, { origin: true })
await app.register(websocket)

await app.register(projectsRoutes.default, { store: projectStore })
await app.register(exportRoutes.default)
await registerWsRoutes(app)
await registerArtifactRoutes(app)

app.get("/health", async () => ({ ok: true }))

const port = Number(process.env.GATEWAY_PORT ?? 8787)
await app.listen({ port, host: "0.0.0.0" })
log.info(`gateway up on http://localhost:${port}`)
