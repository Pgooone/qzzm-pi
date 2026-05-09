export type AgentRole = "prd" | "design" | "dev" | "review"

export type Msg =
  | { id: string; kind: "user"; text: string }
  | { id: string; kind: "assistant"; text: string; thinking?: string; done: boolean }
  | { id: string; kind: "tool"; toolCallId: string; name: string; params: unknown; chunks: string[]; result?: unknown; isError?: boolean; done: boolean }
  | { id: string; kind: "artifact"; name: string; version: string; size: number; artifactKind: string }
  | { id: string; kind: "error"; text: string }

export interface ArtifactInfo { name: string; version: string; size: number; kind: string }
