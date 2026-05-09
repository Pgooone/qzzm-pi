import { PRD_PROMPT } from "./prompts/prd.js"
import { DESIGN_PROMPT } from "./prompts/design.js"
import { DEV_PROMPT } from "./prompts/dev.js"
import { REVIEW_PROMPT } from "./prompts/review.js"

export const SYSTEM_PROMPTS = {
  prd: PRD_PROMPT,
  design: DESIGN_PROMPT,
  dev: DEV_PROMPT,
  review: REVIEW_PROMPT,
} as const

export type AgentRole = keyof typeof SYSTEM_PROMPTS
