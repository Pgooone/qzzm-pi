import { useAgentSocket } from "../hooks/useAgentSocket"
import { AgentTabs } from "./AgentTabs"
import { SessionSidebar } from "./SessionSidebar"
import { MessageList } from "./MessageList"
import { InputBox } from "./InputBox"
import { ArtifactPanel } from "./ArtifactPanel"

export function ChatWindow({ projectId }: { projectId: string }) {
  const sock = useAgentSocket(projectId)
  return (
    <div className="flex flex-col h-full">
      <AgentTabs role={sock.role} onChange={sock.switchRole} />
      <div className="flex flex-1 min-h-0">
        <SessionSidebar
          tree={sock.tree}
          currentNodeId={sock.currentNodeId}
          hasMore={sock.hasMoreHistory}
          onLoadMore={sock.loadMoreHistory}
          onNavigate={sock.navigate}
          onFork={sock.fork}
        />
        <div className="flex-1 flex flex-col min-w-0">
          <MessageList messages={sock.messages} />
          <InputBox streaming={sock.streaming} onSend={sock.prompt} onAbort={sock.abort} />
        </div>
        <ArtifactPanel projectId={projectId} artifacts={sock.artifacts} />
      </div>
    </div>
  )
}
