import type { AgentRole } from "../lib/types"
import { cn } from "../lib/utils"

const tabs: Array<{ key: AgentRole; label: string; emoji: string; enabled: boolean }> = [
  { key: "prd", label: "需求", emoji: "📝", enabled: true },
  { key: "design", label: "设计", emoji: "📐", enabled: true },
  { key: "dev", label: "开发", emoji: "💻", enabled: true },
  { key: "review", label: "审查", emoji: "🔍", enabled: true },
]

export function AgentTabs({ role, onChange }: { role: AgentRole; onChange: (r: AgentRole) => void }) {
  return (
    <div className="flex items-center gap-1 px-3 h-10 border-b bg-white">
      {tabs.map((t) => (
        <button
          key={t.key}
          disabled={!t.enabled}
          onClick={() => t.enabled && onChange(t.key)}
          className={cn(
            "px-3 py-1 rounded-md text-sm transition",
            role === t.key ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-100",
            !t.enabled && "opacity-40 cursor-not-allowed",
          )}
        >
          {t.emoji} {t.label} Agent
          {!t.enabled && <span className="ml-1 text-[10px] opacity-70">即将上线</span>}
        </button>
      ))}
    </div>
  )
}
