import { useAgentSocket } from "../hooks/useAgentSocket"
import { AgentTabs } from "./AgentTabs"
import { SessionSidebar } from "./SessionSidebar"
import { MessageList } from "./MessageList"
import { InputBox } from "./InputBox"
import { ArtifactPanel } from "./ArtifactPanel"

export function ChatWindow({ projectId }: { projectId: string }) {
  const { role, messages, artifacts, streaming, send, abort, switchRole } = useAgentSocket(projectId)
  return (
    <div className="flex flex-col h-full">
      <AgentTabs role={role} onChange={switchRole} />
      <div className="flex flex-1 min-h-0">
        <SessionSidebar projectId={projectId} />
        <div className="flex-1 flex flex-col min-w-0">
          <MessageList messages={messages} />
          <InputBox streaming={streaming} onSend={send} onAbort={abort} />
        </div>
        <ArtifactPanel projectId={projectId} artifacts={artifacts} />
      </div>
    </div>
  )
}
