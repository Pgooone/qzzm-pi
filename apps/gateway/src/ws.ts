import type { FastifyInstance } from "fastify"
import type { WebSocket } from "ws"
import { nanoid } from "nanoid"
import type { AgentSession } from "@earendil-works/pi-coding-agent"
import { createRoleSession } from "./pi/createSession.js"
import { artifactBus } from "./store/artifactStore.js"
import type { AgentRole } from "./pi/prompts.js"
import { log } from "./lib/log.js"

type OutMsg =
  | { kind: "hello"; projectId: string; role: AgentRole }
  | { kind: "text_delta"; messageId: string; delta: string }
  | { kind: "thinking_delta"; messageId: string; delta: string }
  | { kind: "message_start"; messageId: string }
  | { kind: "message_end"; messageId: string }
  | { kind: "tool_start"; toolCallId: string; name: string; params: unknown }
  | { kind: "tool_update"; toolCallId: string; chunk: unknown }
  | { kind: "tool_end"; toolCallId: string; isError: boolean; result: unknown }
  | { kind: "turn_end" }
  | { kind: "agent_end" }
  | { kind: "artifact_updated"; artifact: { name: string; version: string; size: number; kind: string } }
  | { kind: "error"; message: string }

type InMsg =
  | { kind: "prompt"; text: string; behavior?: "steer" | "followUp" }
  | { kind: "abort" }
  | { kind: "compact"; instructions?: string }
  | { kind: "switch_role"; role: AgentRole }

export async function registerWsRoutes(app: FastifyInstance) {
  app.get("/ws/:projectId", { websocket: true }, async (socket: WebSocket, req) => {
    const projectId = (req.params as { projectId: string }).projectId || nanoid(10)
    let role: AgentRole = "prd"
    let session: AgentSession | undefined
    let unsubAgent: (() => void) | null = null

    const send = (m: OutMsg) => {
      if (socket.readyState === 1) {
        socket.send(JSON.stringify(m))
      }
    }

    const attachSession = async (newRole: AgentRole) => {
      unsubAgent?.()
      role = newRole
      session = await createRoleSession(role, projectId)
      unsubAgent = session.subscribe((event) => {
        switch (event.type) {
          case "message_start":
            send({ kind: "message_start", messageId: event.messageId })
            break
          case "message_update": {
            const e = event.assistantMessageEvent
            if (e.type === "text_delta") send({ kind: "text_delta", messageId: event.messageId, delta: e.delta })
            if (e.type === "thinking_delta") send({ kind: "thinking_delta", messageId: event.messageId, delta: e.delta })
            break
          }
          case "message_end":
            send({ kind: "message_end", messageId: event.messageId })
            break
          case "tool_execution_start":
            send({ kind: "tool_start", toolCallId: event.toolCallId, name: event.toolName, params: event.params })
            break
          case "tool_execution_update":
            send({ kind: "tool_update", toolCallId: event.toolCallId, chunk: event.update })
            break
          case "tool_execution_end":
            send({
              kind: "tool_end",
              toolCallId: event.toolCallId,
              isError: event.isError ?? false,
              result: event.result,
            })
            break
          case "turn_end":
            send({ kind: "turn_end" })
            break
          case "agent_end":
            send({ kind: "agent_end" })
            break
        }
      })
      send({ kind: "hello", projectId, role })
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
      try {
        msg = JSON.parse(raw.toString())
      } catch {
        return send({ kind: "error", message: "invalid json" })
      }
      if (!session) return
      try {
        switch (msg.kind) {
          case "prompt":
            if (session.isStreaming) {
              await session.prompt(msg.text, { streamingBehavior: msg.behavior ?? "steer" })
            } else {
              await session.prompt(msg.text)
            }
            break
          case "abort":
            await session.abort()
            break
          case "compact":
            await session.compact(msg.instructions)
            break
          case "switch_role":
            await attachSession(msg.role)
            break
        }
      } catch (e: unknown) {
        log.error(e)
        send({ kind: "error", message: (e as Error).message })
      }
    })

    socket.on("close", () => {
      unsubAgent?.()
      artifactBus.off("updated", onArtifact)
      session?.dispose()
      log.info(`ws closed project=${projectId}`)
    })
  })
}
