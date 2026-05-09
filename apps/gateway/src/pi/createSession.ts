import {
  createAgentSession,
  DefaultResourceLoader,
  SessionManager,
} from "@earendil-works/pi-coding-agent"
import { mkdir } from "node:fs/promises"
import { join } from "node:path"
import { buildAuthAndRegistry, pickDefaultModel } from "./modelConfig.js"
import { SYSTEM_PROMPTS, type AgentRole } from "./prompts.js"
import { buildPrdTools } from "./tools.js"

const { authStorage, modelRegistry } = buildAuthAndRegistry()
const defaultModel = pickDefaultModel(modelRegistry)

const STATE_DIR = process.env.STATE_DIR ?? "./state"

function toolsForRole(role: AgentRole, projectId: string) {
  switch (role) {
    case "prd":
      return buildPrdTools(projectId)
    default:
      return []
  }
}

export async function createRoleSession(role: AgentRole, projectId: string) {
  const projectDir = join(STATE_DIR, "projects", projectId)
  const sessionFile = join(projectDir, "sessions", `${role}.jsonl`)
  await mkdir(join(projectDir, "sessions"), { recursive: true })
  await mkdir(join(projectDir, "workspace"), { recursive: true })

  const sessionManager = SessionManager.open(sessionFile)
  const loader = new DefaultResourceLoader({
    cwd: join(projectDir, "workspace"),
    agentDir: join(STATE_DIR, "agent"),
    systemPromptOverride: () => SYSTEM_PROMPTS[role],
  })
  await loader.reload()

  const { session } = await createAgentSession({
    cwd: join(projectDir, "workspace"),
    agentDir: join(STATE_DIR, "agent"),
    authStorage,
    modelRegistry,
    model: defaultModel,
    thinkingLevel: "off",
    noTools: "builtin",
    customTools: toolsForRole(role, projectId),
    sessionManager,
    resourceLoader: loader,
  })
  return session
}

export { defaultModel, modelRegistry }
