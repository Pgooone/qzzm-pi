import { PRD_PROMPT } from "./prompts/prd.js"
import { DESIGN_PROMPT } from "./prompts/design.js"
import { DEV_PROMPT } from "./prompts/dev.js"

export const SYSTEM_PROMPTS = {
  prd: PRD_PROMPT,
  design: DESIGN_PROMPT,
  dev: DEV_PROMPT,
  review: `[Day 6 接入] 你是审查 Agent...`,
} as const

export type AgentRole = keyof typeof SYSTEM_PROMPTS
