export type RoleId = "prd" | "design" | "dev" | "review"

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

export interface ProjectMeta {
  id: string
  name: string
  createdAt: number
  updatedAt: number
}

export interface ArtifactInfo { name: string; version: string; size?: number; updatedAt?: number }

export interface Message {
  id: string
  role: "user" | "assistant"
  text: string
  thinking?: string
  toolCalls: Array<{ id: string; name: string; params: any; result?: any; isError?: boolean }>
  ts: number
}
