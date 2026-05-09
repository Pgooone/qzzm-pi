import {
  createAgentSession,
  DefaultResourceLoader,
  SessionManager,
} from "@earendil-works/pi-coding-agent"
import { mkdir } from "node:fs/promises"
import { join } from "node:path"
import { buildAuthAndRegistry, pickDefaultModel, pickThinkingLevel, type RoleId } from "./modelConfig.js"
import { SYSTEM_PROMPTS } from "./prompts.js"
import { buildPrdTools } from "./tools.js"

const STATE_DIR = process.env.STATE_DIR ?? "./state"

function toolsForRole(role: RoleId, projectId: string) {
  switch (role) {
    case "prd":
      return buildPrdTools(projectId)
    default:
      return []
  }
}

export async function createRoleSession(projectId: string, role: RoleId) {
  const { authStorage, registry } = buildAuthAndRegistry()
  const model = pickDefaultModel(registry, role)

  const projectDir = join(STATE_DIR, "projects", projectId)
  const sessionFile = join(projectDir, "sessions", `${role}.jsonl`)
  await mkdir(join(projectDir, "sessions"), { recursive: true })
  await mkdir(join(projectDir, "workspace"), { recursive: true })

  const sessionManager = SessionManager.open(sessionFile)
  const loader = new DefaultResourceLoader({
    cwd: join(projectDir, "workspace"),
    agentDir: join(STATE_DIR, "agent"),
    systemPromptOverride: () => SYSTEM_PROMPTS[role] ?? SYSTEM_PROMPTS.prd,
  })
  await loader.reload()

  // 决策 B：PRD/Design/Review 禁内置工具走 customTools；Dev 开放 read/edit/write/bash
  const noTools = role === "dev" ? undefined : "builtin"

  // 模型是否支持 reasoning（V4 系列都是 true）
  const supportsReasoning = (model as any).reasoning === true
  const thinkingLevel = pickThinkingLevel(role, supportsReasoning)

  const { session } = await createAgentSession({
    cwd: join(projectDir, "workspace"),
    agentDir: join(STATE_DIR, "agent"),
    authStorage,
    modelRegistry: registry,
    model,
    thinkingLevel,
    noTools: noTools as "builtin" | undefined,
    customTools: toolsForRole(role, projectId),
    sessionManager,
    resourceLoader: loader,
  })

  return { session, model, thinkingLevel }
}
