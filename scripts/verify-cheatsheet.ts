// pnpm verify-cheatsheet
// 跨验证 docs/pi-sdk-cheatsheet.md 中的 6 个核心 API 是否与 pi-mono 最新 types.ts 一致
import { readFile } from "node:fs/promises"
import { resolve } from "node:path"

const PI_TYPES_URL =
  "https://raw.githubusercontent.com/badlogic/pi-mono/main/packages/coding-agent/src/types.ts"

const CHECKS: Array<{ name: string; pattern: RegExp; mustExistInTypes: boolean }> = [
  { name: "createAgentSession", pattern: /createAgentSession\s*\(/, mustExistInTypes: true },
  { name: "AuthStorage.create", pattern: /class\s+AuthStorage|AuthStorage\.create/, mustExistInTypes: true },
  { name: "ModelRegistry.registerProvider", pattern: /registerProvider\s*\(/, mustExistInTypes: true },
  { name: "defineTool", pattern: /export\s+(function|const)\s+defineTool/, mustExistInTypes: true },
  { name: "session.subscribe", pattern: /subscribe\s*\(/, mustExistInTypes: true },
  { name: "SessionManager.open", pattern: /SessionManager[\s\S]{0,200}open\s*\(/, mustExistInTypes: true },
]

const FORBIDDEN_IN_CHEATSHEET = [
  "registerCustomModel",
  "baseURL",
  "supportsThinking",
  '"openai"',
]

async function main() {
  const cheatsheet = await readFile(resolve("docs/pi-sdk-cheatsheet.md"), "utf-8")

  const violations: string[] = []

  // 1. 检查禁用词
  for (const w of FORBIDDEN_IN_CHEATSHEET) {
    if (cheatsheet.includes(w)) violations.push(`禁用词 "${w}" 出现在 cheatsheet 中`)
  }

  // 2. 检查上游 types.ts
  const res = await fetch(PI_TYPES_URL)
  if (!res.ok) {
    console.log(`⚠️ 拉不到上游 types.ts (status=${res.status})，跳过此项`)
  } else {
    const types = await res.text()
    for (const c of CHECKS) {
      const inTypes = c.pattern.test(types)
      const inCheat = cheatsheet.includes(c.name) || c.pattern.test(cheatsheet)
      if (c.mustExistInTypes && !inTypes) {
        violations.push(`↑ 上游 types.ts 里没有 ${c.name}，可能 Pi 变更了 API`)
      }
      if (!inCheat) {
        violations.push(`↓ cheatsheet 里没有 ${c.name}，可能遗漏了`)
      }
    }
  }

  if (violations.length === 0) {
    console.log("✅ cheatsheet 与上游一致")
    return
  }
  console.error("❌ cheatsheet 验证失败：")
  for (const v of violations) console.error("  -", v)
  process.exit(1)
}
main().catch((e) => { console.error(e); process.exit(1) })
