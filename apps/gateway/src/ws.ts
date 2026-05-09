import type { FastifyInstance } from "fastify"
import type { WebSocket } from "ws"
import { customAlphabet } from "nanoid"
import type { AgentSession } from "@earendil-works/pi-coding-agent"
import { createRoleSession } from "./pi/createSession.js"
import { artifactBus, artifactStore } from "./store/artifactStore.js"
import { projectStore } from "./store/projectStore.js"
import { sessionService, type TreeNode, type HistoryMessage } from "./services/sessionService.js"
import type { RoleId } from "./pi/modelConfig.js"
import { log } from "./lib/log.js"

const mid = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 8)

export type { TreeNode, HistoryMessage }

type ArtifactInfo = { name: string; version: string; size?: number; updatedAt?: number }

type OutMsg =
  | { kind: "hello"; projectId: string; role: RoleId; model: { id: string; name: string }; thinkingLevel: string }
  | { kind: "message_start"; messageId: string; role: "user" | "assistant" }
  | { kind: "text_delta"; messageId: string; delta: string }
  | { kind: "thinking_delta"; messageId: string; delta: string }
  | { kind: "message_end"; messageId: string }
  | { kind: "tool_start"; toolCallId: string; name: string; params: unknown }
  | { kind: "tool_update"; toolCallId: string; chunk: unknown }
  | { kind: "tool_end"; toolCallId: string; isError: boolean; result: unknown }
  | { kind: "turn_end" }
  | { kind: "agent_end" }
  | { kind: "artifact_updated"; artifact: ArtifactInfo }
  | { kind: "artifact_snapshot"; artifacts: ArtifactInfo[] }
  | { kind: "tree_update"; tree: TreeNode[]; currentNodeId?: string }
  | { kind: "history_replay"; messages: HistoryMessage[]; hasMore: boolean; oldest?: string }
  | { kind: "session_cleared" }
  | { kind: "error"; message: string; retryable?: boolean }

type InMsg =
  | { kind: "prompt"; text: string; behavior?: "steer" | "followUp" }
  | { kind: "abort" }
  | { kind: "compact"; instructions?: string }
  | { kind: "switch_role"; role: RoleId }
  | { kind: "fork"; messageId: string }
  | { kind: "navigate"; nodeId: string }
  | { kind: "load_history"; before?: string; limit?: number }

export async function registerWsRoutes(app: FastifyInstance) {
  app.get("/ws/:projectId", { websocket: true }, async (socket: WebSocket, req) => {
    const projectId = (req.params as { projectId: string }).projectId || `proj-${mid()}`
    let role: RoleId = "prd"
    let session: AgentSession | undefined
    let unsubAgent: (() => void) | null = null

    const send = (m: OutMsg) => {
      if (socket.readyState === 1) socket.send(JSON.stringify(m))
    }

    const attachSession = async (newRole: RoleId) => {
      try { unsubAgent?.() } catch { /* ignore */ }
      try { session?.dispose() } catch { /* ignore */ }
      unsubAgent = null
      session = undefined

      await projectStore.ensureExists(projectId)
      await projectStore.touch(projectId)

      role = newRole
      const created = await createRoleSession(projectId, role)
      session = created.session

      send({
        kind: "hello",
        projectId,
        role,
        model: { id: (created.model as any).id, name: (created.model as any).name },
        thinkingLevel: created.thinkingLevel,
      })

      // 推 artifact 快照
      const arts = await artifactStore.list(projectId)
      send({ kind: "artifact_snapshot", artifacts: arts })

      // 推历史回放
      const hist = await sessionService.getHistory(projectId, role)
      send({ kind: "history_replay", messages: hist.messages, hasMore: hist.hasMore, oldest: hist.oldest })

      // 推分支树
      const tree = await sessionService.getTree(projectId, role)
      send({ kind: "tree_update", tree: tree.tree, currentNodeId: tree.currentNodeId })

      // 订阅事件转发（服务端发 messageId）
      let currentMessageId: string | null = null
      unsubAgent = session.subscribe((event: any) => {
        switch (event.type) {
          case "message_start": {
            currentMessageId = mid()
            send({ kind: "message_start", messageId: currentMessageId, role: "assistant" })
            break
          }
          case "message_update": {
            const e = event.assistantMessageEvent
            if (!currentMessageId) return
            if (e?.type === "text_delta") send({ kind: "text_delta", messageId: currentMessageId, delta: e.delta ?? e.text ?? "" })
            else if (e?.type === "thinking_delta") send({ kind: "thinking_delta", messageId: currentMessageId, delta: e.delta ?? e.thinking ?? "" })
            break
          }
          case "message_end": {
            if (currentMessageId) send({ kind: "message_end", messageId: currentMessageId })
            currentMessageId = null
            break
          }
          case "tool_execution_start":
            send({ kind: "tool_start", toolCallId: event.toolCallId, name: event.toolName, params: event.params })
            break
          case "tool_execution_update":
            send({ kind: "tool_update", toolCallId: event.toolCallId, chunk: event.update })
            break
          case "tool_execution_end":
            send({ kind: "tool_end", toolCallId: event.toolCallId, result: event.result, isError: !!event.isError })
            break
          case "turn_end":
            send({ kind: "turn_end" })
            break
          case "agent_end":
            send({ kind: "agent_end" })
            sessionService.getTree(projectId, role).then((t) =>
              send({ kind: "tree_update", tree: t.tree, currentNodeId: t.currentNodeId })
            )
            break
        }
      })
    }

    try {
      await attachSession("prd")
    } catch (e: unknown) {
      log.error("attachSession failed:", e)
      send({ kind: "error", message: `会话创建失败: ${(e as Error).message}` })
      socket.close()
      return
    }

    const onArtifact = (rec: { projectId: string; name: string; version: string; size: number; kind: string }) => {
      if (rec.projectId !== projectId) return
      send({ kind: "artifact_updated", artifact: rec })
    }
    artifactBus.on("updated", onArtifact)

    socket.on("message", async (raw) => {
      let msg: InMsg
      try { msg = JSON.parse(raw.toString()) } catch { return }
      if (!session) return
      try {
        switch (msg.kind) {
          case "prompt": {
            const userId = mid()
            send({ kind: "message_start", messageId: userId, role: "user" })
            send({ kind: "text_delta", messageId: userId, delta: msg.text })
            send({ kind: "message_end", messageId: userId })
            await session.prompt(msg.text, { streamingBehavior: msg.behavior ?? "steer" })
            await projectStore.touch(projectId)
            break
          }
          case "abort":
            await session.abort()
            break
          case "compact":
            await session.compact(msg.instructions)
            break
          case "switch_role":
            send({ kind: "session_cleared" })
            await attachSession(msg.role)
            break
          case "fork":
            // Day 2 只读实现：fork 按钮临时置灰，提示待 Pi 升级
            send({ kind: "error", message: "Fork 写入能力待 Pi SDK 上游升级，当前仅支持只读查看。", retryable: false })
            break
          case "navigate": {
            const h = await sessionService.getHistory(projectId, role, msg.nodeId, 50)
            send({ kind: "history_replay", messages: h.messages, hasMore: h.hasMore, oldest: h.oldest })
            break
          }
          case "load_history": {
            const r = await sessionService.getHistory(projectId, role, msg.before, msg.limit ?? 50)
            send({ kind: "history_replay", messages: r.messages, hasMore: r.hasMore, oldest: r.oldest })
            break
          }
        }
      } catch (e: unknown) {
        log.error(e)
        send({ kind: "error", message: (e as Error).message })
      }
    })

    socket.on("close", () => {
      unsubAgent?.()
      artifactBus.off("updated", onArtifact)
      try { session?.dispose() } catch { /* ignore */ }
      log.info(`ws closed project=${projectId}`)
    })
  })
}
