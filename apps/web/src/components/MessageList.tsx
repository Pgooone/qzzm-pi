import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { FileText, AlertCircle, Bot, User } from "lucide-react"
import type { Msg } from "../lib/types"
import { ToolCard } from "./ToolCard"
import { ThinkingCard } from "./ThinkingCard"
import { useEffect, useRef } from "react"

export function MessageList({ messages }: { messages: Msg[] }) {
  const endRef = useRef<HTMLDivElement>(null)
  useEffect(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), [messages])

  return (
    <div className="flex-1 overflow-auto bg-white">
      <div className="max-w-3xl mx-auto px-8 py-8 space-y-7">
        {messages.length === 0 && (
          <div className="text-center text-gray-400 text-sm mt-24">
            <div className="text-2xl mb-2">📝</div>
            <div>需求 Agent 已就绪。用一句话或一段描述讲清楚你的产品想法。</div>
          </div>
        )}
        {messages.map((m) => {
          if (m.kind === "user")
            return (
              <div key={m.id} className="flex gap-4">
                <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center flex-shrink-0">
                  <User className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0 pt-1">
                  <div className="text-xs text-gray-500 mb-1">你</div>
                  <div className="whitespace-pre-wrap text-gray-900 leading-relaxed">{m.text}</div>
                </div>
              </div>
            )
          if (m.kind === "assistant")
            return (
              <div key={m.id} className="flex gap-4">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 text-white flex items-center justify-center flex-shrink-0">
                  <Bot className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0 pt-1">
                  <div className="text-xs text-gray-500 mb-1">需求 Agent</div>
                  <ThinkingCard text={m.thinking ?? ""} />
                  <div className="prose prose-sm max-w-none text-gray-900 leading-relaxed">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.text || (m.done ? "" : "▍")}</ReactMarkdown>
                  </div>
                </div>
              </div>
            )
          if (m.kind === "tool")
            return (
              <div key={m.id} className="flex gap-4">
                <div className="w-8 flex-shrink-0" />
                <div className="flex-1 min-w-0"><ToolCard {...m} /></div>
              </div>
            )
          if (m.kind === "artifact")
            return (
              <div key={m.id} className="flex gap-4">
                <div className="w-8 flex-shrink-0" />
                <div className="flex-1 flex items-center gap-2 bg-green-50 border border-green-200 text-green-800 rounded-lg px-3 py-2 text-sm">
                  <FileText className="w-4 h-4" />
                  <span>已生成 <b>{m.name}</b>（{m.version}，{(m.size / 1024).toFixed(1)} KB）</span>
                  <span className="ml-auto text-xs text-green-600">→ 右侧产出物面板查看 / 导出</span>
                </div>
              </div>
            )
          if (m.kind === "error")
            return (
              <div key={m.id} className="flex gap-4">
                <div className="w-8 flex-shrink-0" />
                <div className="flex-1 flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-sm">
                  <AlertCircle className="w-4 h-4" /> {m.text}
                </div>
              </div>
            )
          return null
        })}
        <div ref={endRef} />
      </div>
    </div>
  )
}
