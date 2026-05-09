export const ALLOW_PREFIXES = [
  "ls", "cd", "pwd", "cat", "mkdir", "touch", "echo",
  "node", "npm", "pnpm", "npx",
  "git status", "git diff", "git log",
]

export const DENY_SUBSTRINGS = [
  "rm -rf", "rm /", "sudo ", "curl http", "wget ", "chmod 777",
  "git push", "dd if=", "mkfs", "shutdown", "reboot",
  "> /etc/", ">> /etc/",
]

export function isAllowed(cmd: string): { ok: boolean; reason?: string } {
  const c = cmd.trim()
  for (const d of DENY_SUBSTRINGS) {
    if (c.includes(d)) return { ok: false, reason: `含黑名单片段: ${d}` }
  }
  // 多命令拆分检查
  if (c.includes("&&") || c.includes(";") || c.includes("|")) {
    for (const sub of c.split(/&&|;|\|/)) {
      const r = isAllowed(sub.trim())
      if (!r.ok) return r
    }
    return { ok: true }
  }
  if (ALLOW_PREFIXES.some((p) => c.startsWith(p))) return { ok: true }
  return { ok: false, reason: `不在白名单: ${c.split(" ")[0]}` }
}
