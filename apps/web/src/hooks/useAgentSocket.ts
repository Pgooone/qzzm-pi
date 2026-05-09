import { useCallback, useEffect, useRef, useState } from "react"
import type { AgentRole, ArtifactInfo, Msg } from "../lib/types"
import { nid } from "../lib/utils"

export function useAgentSocket(projectId: string) {
  const [role, setRole] = useState<AgentRole>("prd")
  const [messages, setMessages] = useState<Msg[]>([])
  const [artifacts, setArtifacts] = useState<ArtifactInfo[]>([])
  const [streaming, setStreaming] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)
  const currentAssistantIdRef = useRef<string | null>(null)

  useEffect(() => {
    const proto = location.protocol === "https:" ? "wss" : "ws"
    const ws = new WebSocket(`${proto}://${location.host}/ws/${projectId}`)
    wsRef.current = ws

    ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data)
      switch (m.kind) {
        case "hello":
          setRole(m.role)
          break
        case "message_start": {
          const id = nid()
          currentAssistantIdRef.current = id
          setStreaming(true)
          setMessages((prev) => [...prev, { id, kind: "assistant", text: "", thinking: "", done: false }])
          break
        }
        case "text_delta":
          setMessages((prev) => prev.map((x) => (x.id === currentAssistantIdRef.current && x.kind === "assistant" ? { ...x, text: x.text + m.delta } : x)))
          break
        case "thinking_delta":
          setMessages((prev) => prev.map((x) => (x.id === currentAssistantIdRef.current && x.kind === "assistant" ? { ...x, thinking: (x.thinking ?? "") + m.delta } : x)))
          break
        case "message_end":
          setMessages((prev) => prev.map((x) => (x.id === currentAssistantIdRef.current && x.kind === "assistant" ? { ...x, done: true } : x)))
          currentAssistantIdRef.current = null
          break
        case "tool_start":
          setMessages((prev) => [...prev, { id: nid(), kind: "tool", toolCallId: m.toolCallId, name: m.name, params: m.params, chunks: [], done: false }])
          break
        case "tool_update":
          setMessages((prev) => prev.map((x) => (x.kind === "tool" && x.toolCallId === m.toolCallId ? { ...x, chunks: [...x.chunks, String(m.chunk?.text ?? JSON.stringify(m.chunk))] } : x)))
          break
        case "tool_end":
          setMessages((prev) => prev.map((x) => (x.kind === "tool" && x.toolCallId === m.toolCallId ? { ...x, result: m.result, isError: m.isError, done: true } : x)))
          break
        case "artifact_updated":
          setArtifacts((prev) => {
            const rest = prev.filter((a) => a.name !== m.artifact.name)
            return [...rest, m.artifact]
          })
          setMessages((prev) => [...prev, { id: nid(), kind: "artifact", name: m.artifact.name, version: m.artifact.version, size: m.artifact.size, artifactKind: m.artifact.kind }])
          break
        case "agent_end":
          setStreaming(false)
          break
        case "error":
          setMessages((prev) => [...prev, { id: nid(), kind: "error", text: m.message }])
          setStreaming(false)
          break
      }
    }
    return () => ws.close()
  }, [projectId])

  const send = useCallback((text: string) => {
    if (!wsRef.current || wsRef.current.readyState !== 1) return
    setMessages((prev) => [...prev, { id: nid(), kind: "user", text }])
    wsRef.current.send(JSON.stringify({ kind: "prompt", text, behavior: "steer" }))
  }, [])

  const abort = useCallback(() => wsRef.current?.send(JSON.stringify({ kind: "abort" })), [])
  const compact = useCallback(() => wsRef.current?.send(JSON.stringify({ kind: "compact" })), [])
  const switchRole = useCallback((r: AgentRole) => wsRef.current?.send(JSON.stringify({ kind: "switch_role", role: r })), [])

  return { role, messages, artifacts, streaming, send, abort, compact, switchRole }
}
