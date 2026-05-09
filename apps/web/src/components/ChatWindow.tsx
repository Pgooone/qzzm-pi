import { useAgentSocket } from "../hooks/useAgentSocket"
import { AgentTabs } from "./AgentTabs"
import { SessionSidebar } from "./SessionSidebar"
import { MessageList } from "./MessageList"
import { InputBox } from "./InputBox"
import { ArtifactPanel } from "./ArtifactPanel"
import { ModelChip } from "./ModelChip"
import { ThinkingSlider } from "./ThinkingSlider"
import { CompactCard, AutoRetryCard } from "./CompactCard"

export function ChatWindow({ projectId }: { projectId: string }) {
  const sock = useAgentSocket(projectId)
  return (
    <div className="flex flex-col h-full">
      <AgentTabs role={sock.role} onChange={sock.switchRole} />
      <div className="flex items-center gap-3 px-3 py-1 border-b bg-gray-50/80">
        <ModelChip current={sock.currentModel.id ? sock.currentModel : undefined} onChange={sock.switchModel} />
        <span className="text-gray-300">|</span>
        <ThinkingSlider value={sock.thinkingLevel} onChange={sock.setThinking} disabled={false} />
        <div className="ml-auto flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full ${sock.connected ? "bg-green-500" : "bg-red-400"}`} />
          <span className="text-xs text-gray-400">{sock.connected ? "已连接" : "重连中…"}</span>
        </div>
      </div>
      {sock.autoRetrying && <AutoRetryCard reason={sock.retryReason} success={false} />}
      {sock.compacting && <CompactCard status="running" />}
      {sock.compactionSummary && <CompactCard status="done" summary={sock.compactionSummary} />}
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
          <MessageList messages={sock.messages} onRetry={sock.retryMessage} />
          <InputBox streaming={sock.streaming} onSend={sock.prompt} onAbort={sock.abort} onCompact={() => sock.compact()} />
        </div>
        <ArtifactPanel projectId={projectId} artifacts={sock.artifacts} />
      </div>
    </div>
  )
}
