import { join } from "node:path"
import { readFile } from "node:fs/promises"
import type { RoleId } from "../pi/modelConfig.js"

const STATE_DIR = process.env.STATE_DIR ?? "./state"

function sessionFile(projectId: string, role: RoleId) {
  return join(STATE_DIR, "projects", projectId, "sessions", `${role}.jsonl`)
}

async function readJsonl(file: string): Promise<any[]> {
  try {
    const raw = await readFile(file, "utf-8")
    return raw.split("\n").filter(Boolean).map((l) => JSON.parse(l))
  } catch {
    return []
  }
}

function toPreview(s: string): string {
  const flat = (s || "").replace(/\s+/g, " ").trim()
  return flat.length > 80 ? flat.slice(0, 80) + "…" : flat
}

export interface TreeNode {
  id: string
  parentId: string | null
  role: "user" | "assistant"
  preview: string
  ts: number
  isCurrent?: boolean
}

export interface HistoryMessage {
  id: string
  role: "user" | "assistant"
  text: string
  thinking?: string
  toolCalls?: Array<{ name: string; params: any; result?: any }>
  ts: number
}

export const sessionService = {
  async getTree(projectId: string, role: RoleId): Promise<{ tree: TreeNode[]; currentNodeId?: string }> {
    const file = sessionFile(projectId, role)
    const lines = await readJsonl(file)
    let prevId: string | null = null
    const tree: TreeNode[] = []
    for (const ev of lines) {
      const isUser = ev.type === "message" && ev.message?.role === "user"
      const isAssistant = ev.type === "message" && ev.message?.role === "assistant"
      if (!isUser && !isAssistant) continue
      const id = ev.id
      if (!id) continue
      const content = ev.message?.content
      let text = ""
      if (typeof content === "string") text = content
      else if (Array.isArray(content)) {
        text = content.filter((c: any) => c.type === "text").map((c: any) => c.text).join(" ")
      }
      tree.push({
        id,
        parentId: prevId,
        role: isUser ? "user" : "assistant",
        preview: toPreview(text),
        ts: new Date(ev.timestamp).getTime(),
      })
      prevId = id
    }
    return { tree, currentNodeId: tree.at(-1)?.id }
  },

  async getHistory(projectId: string, role: RoleId, before?: string, limit = 50): Promise<{ messages: HistoryMessage[]; hasMore: boolean; oldest?: string }> {
    const file = sessionFile(projectId, role)
    const lines = await readJsonl(file)
    const all: HistoryMessage[] = []
    for (const ev of lines) {
      if (ev.type !== "message") continue
      const role = ev.message?.role as "user" | "assistant" | undefined
      if (!role) continue
      const content = ev.message?.content
      let text = ""
      let toolCalls: HistoryMessage["toolCalls"] = []
      if (typeof content === "string") {
        text = content
      } else if (Array.isArray(content)) {
        for (const c of content) {
          if (c.type === "text") text += c.text
          else if (c.type === "toolCall") {
            toolCalls.push({ name: c.name || c.toolName, params: c.arguments || c.params })
          }
        }
      }
      all.push({
        id: ev.id,
        role,
        text,
        thinking: undefined,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        ts: new Date(ev.timestamp).getTime(),
      })
    }

    if (all.length < 200 && !before) {
      return { messages: all, hasMore: false }
    }
    let endIdx = all.length
    if (before) {
      const idx = all.findIndex((m) => m.id === before)
      if (idx >= 0) endIdx = idx
    }
    const start = Math.max(0, endIdx - limit)
    const slice = all.slice(start, endIdx)
    return {
      messages: slice,
      hasMore: start > 0,
      oldest: slice[0]?.id,
    }
  },
}
