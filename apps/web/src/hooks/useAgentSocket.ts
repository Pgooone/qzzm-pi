import { useEffect, useRef, useState, useCallback } from "react"
import type { RoleId, ArtifactInfo, TreeNode, HistoryMessage, Message } from "../lib/types"

function toLocal(h: HistoryMessage): Message {
  return {
    id: h.id,
    role: h.role,
    text: h.text,
    thinking: h.thinking,
    toolCalls: (h.toolCalls ?? []).map((t, i) => ({ id: `${h.id}-t${i}`, name: t.name, params: t.params, result: t.result })),
    ts: h.ts,
  }
}

export function useAgentSocket(projectId: string) {
  const [role, setRole] = useState<RoleId>("prd")
  const [messages, setMessages] = useState<Message[]>([])
  const [artifacts, setArtifacts] = useState<ArtifactInfo[]>([])
  const [tree, setTree] = useState<TreeNode[]>([])
  const [currentNodeId, setCurrentNodeId] = useState<string | undefined>()
  const [hasMoreHistory, setHasMoreHistory] = useState(false)
  const [oldestHistoryId, setOldestHistoryId] = useState<string | undefined>()
  const [streaming, setStreaming] = useState(false)
  const [connected, setConnected] = useState(false)
  const [currentModel, setCurrentModel] = useState<{ id: string; name: string }>({ id: "", name: "" })
  const [thinkingLevel, setThinkingLevel] = useState("off")
  const [compacting, setCompacting] = useState(false)
  const [compactionSummary, setCompactionSummary] = useState<string | undefined>()
  const [autoRetrying, setAutoRetrying] = useState(false)
  const [retryReason, setRetryReason] = useState("")
  const [lastUserText, setLastUserText] = useState("")
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectRef = useRef(0)

  const connect = useCallback(() => {
    const proto = location.protocol === "https:" ? "wss" : "ws"
    const ws = new WebSocket(`${proto}://${location.host}/ws/${projectId}`)
    wsRef.current = ws
    ws.onopen = () => { setConnected(true); reconnectRef.current = 0 }
    ws.onclose = () => {
      setConnected(false)
      const delay = Math.min(5000, 200 * Math.pow(2, reconnectRef.current++))
      setTimeout(() => connect(), delay)
    }
    ws.onmessage = (e) => {
      const m = JSON.parse(e.data)
      switch (m.kind) {
        case "hello":
          setRole(m.role)
          if (m.model?.id) setCurrentModel(m.model)
          setThinkingLevel(m.thinkingLevel ?? "off")
          break
        case "artifact_snapshot":
          setArtifacts(m.artifacts)
          break
        case "history_replay":
          setMessages((prev) => {
            if (prev.length === 0) return m.messages.map(toLocal)
            return [...m.messages.map(toLocal), ...prev]
          })
          setHasMoreHistory(m.hasMore)
          setOldestHistoryId(m.oldest)
          break
        case "tree_update":
          setTree(m.tree)
          setCurrentNodeId(m.currentNodeId)
          break
        case "session_cleared":
          setMessages([])
          break
        case "model_changed":
          if (m.model?.id) setCurrentModel(m.model)
          setThinkingLevel(m.thinkingLevel)
          break
        case "compaction_start":
          setCompacting(true)
          setCompactionSummary(undefined)
          break
        case "compaction_end":
          setCompacting(false)
          setCompactionSummary(m.summary)
          break
        case "auto_retry_start":
          setAutoRetrying(true)
          setRetryReason(m.reason)
          break
        case "auto_retry_end":
          setAutoRetrying(false)
          break
        case "message_start":
          setMessages((prev) => [...prev, { id: m.messageId, role: m.role, text: "", toolCalls: [], ts: Date.now() }])
          if (m.role === "assistant") setStreaming(true)
          break
        case "text_delta":
          setMessages((prev) => prev.map((x) => x.id === m.messageId ? { ...x, text: x.text + m.delta } : x))
          break
        case "thinking_delta":
          setMessages((prev) => prev.map((x) => x.id === m.messageId ? { ...x, thinking: (x.thinking ?? "") + m.delta } : x))
          break
        case "message_end":
          break
        case "tool_start":
          setMessages((prev) => {
            const last = prev.at(-1)
            if (!last) return prev
            return prev.map((x) => x.id === last.id ? { ...x, toolCalls: [...x.toolCalls, { id: m.toolCallId, name: m.name, params: m.params }] } : x)
          })
          break
        case "tool_update":
          break
        case "tool_end":
          setMessages((prev) => prev.map((x) => ({
            ...x,
            toolCalls: x.toolCalls.map((t) => t.id === m.toolCallId ? { ...t, result: m.result, isError: m.isError } : t),
          })))
          break
        case "artifact_updated":
          setArtifacts((prev) => {
            const i = prev.findIndex((a) => a.name === m.artifact.name)
            if (i < 0) return [...prev, m.artifact]
            const next = [...prev]; next[i] = m.artifact; return next
          })
          break
        case "agent_end":
          setStreaming(false)
          break
        case "error":
          setMessages((prev) => [...prev, { id: `err-${Date.now()}`, role: "assistant", text: `❌ ${m.message}`, toolCalls: [], ts: Date.now() }])
          setStreaming(false)
          break
      }
    }
  }, [projectId])

  useEffect(() => {
    connect()
    return () => { wsRef.current?.close() }
  }, [connect])

  const send = useCallback((msg: Record<string, any>) => {
    if (wsRef.current?.readyState === 1) wsRef.current.send(JSON.stringify(msg))
  }, [])

  const prompt = useCallback((text: string) => {
    setLastUserText(text)
    send({ kind: "prompt", text, behavior: "steer" })
  }, [send])

  const retryMessage = useCallback((messageId?: string) => {
    if (lastUserText) send({ kind: "prompt", text: lastUserText, behavior: "steer" })
    else send({ kind: "retry", messageId })
  }, [send, lastUserText])

  return {
    role, messages, artifacts, tree, currentNodeId, streaming, connected,
    hasMoreHistory, oldestHistoryId,
    currentModel, thinkingLevel, compacting, compactionSummary, autoRetrying, retryReason,
    prompt, retryMessage,
    abort: () => send({ kind: "abort" }),
    compact: (instructions?: string) => send({ kind: "compact", instructions }),
    switchRole: (r: RoleId) => send({ kind: "switch_role", role: r }),
    switchModel: (provider: string, modelId: string) => send({ kind: "switch_model", provider, modelId }),
    setThinking: (level: "off" | "low" | "medium" | "high" | "xhigh") => send({ kind: "set_thinking", level }),
    fork: (messageId: string) => send({ kind: "fork", messageId }),
    navigate: (nodeId: string) => send({ kind: "navigate", nodeId }),
    loadMoreHistory: () => oldestHistoryId && send({ kind: "load_history", before: oldestHistoryId, limit: 50 }),
  }
}
