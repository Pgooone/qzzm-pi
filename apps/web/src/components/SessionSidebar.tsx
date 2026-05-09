import { GitBranch, Bot, User } from "lucide-react"
import type { TreeNode } from "../lib/types"

export function SessionSidebar({
  tree, currentNodeId, hasMore, onLoadMore, onNavigate, onFork,
}: {
  tree: TreeNode[]
  currentNodeId?: string
  hasMore: boolean
  onLoadMore: () => void
  onNavigate: (nodeId: string) => void
  onFork: (nodeId: string) => void
}) {
  return (
    <aside className="w-56 border-r border-gray-200 bg-gray-50 flex flex-col">
      <div className="px-3 py-2 text-xs text-gray-500 flex items-center gap-1.5">
        <GitBranch className="w-3.5 h-3.5" /> 会话树 ({tree.length})
      </div>
      {hasMore && (
        <button className="text-xs text-blue-600 hover:underline px-3 py-1" onClick={onLoadMore}>
          加载更早历史
        </button>
      )}
      <div className="flex-1 overflow-y-auto">
        {tree.map((n) => (
          <div
            key={n.id}
            className={`group relative px-3 py-2 cursor-pointer hover:bg-white border-l-2 ${n.id === currentNodeId ? "border-blue-500 bg-white" : "border-transparent"}`}
            onClick={() => onNavigate(n.id)}
          >
            <div className="flex items-start gap-2">
              {n.role === "user"
                ? <User className="w-3.5 h-3.5 mt-0.5 text-gray-400 shrink-0" />
                : <Bot className="w-3.5 h-3.5 mt-0.5 text-purple-500 shrink-0" />}
              <div className="text-xs text-gray-700 line-clamp-2 flex-1 min-w-0">{n.preview}</div>
            </div>
            <button
              className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 text-xs text-gray-400 hover:text-blue-600"
              onClick={(e) => { e.stopPropagation(); onFork(n.id) }}
              title="从这里 fork"
            >
              ⦂
            </button>
          </div>
        ))}
        {tree.length === 0 && (
          <div className="px-3 py-6 text-center text-xs text-gray-400">还没有对话</div>
        )}
      </div>
    </aside>
  )
}
