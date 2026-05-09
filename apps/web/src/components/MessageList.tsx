import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { FileText, AlertCircle, Bot, User } from "lucide-react"
import type { Message } from "../lib/types"
import { ToolCard } from "./ToolCard"
import { ThinkingCard } from "./ThinkingCard"
import { useEffect, useRef } from "react"

export function MessageList({ messages, onRetry }: { messages: Message[]; onRetry?: (msgId?: string) => void }) {
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
          // 工具调用消息（从 toolCalls 渲染）
          if (m.toolCalls && m.toolCalls.length > 0) {
            return (
              <div key={m.id + "-tools"}>
                {m.toolCalls.map((tc) => (
                  <div key={tc.id} className="flex gap-4 mb-2">
                    <div className="w-8 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <ToolCard name={tc.name} params={tc.params} chunks={[]} result={tc.result} isError={tc.isError} done={!!tc.result || !!tc.isError} />
                    </div>
                  </div>
                ))}
              </div>
            )
          }

          // 用户消息
          if (m.role === "user")
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

          // 错误消息
          if (m.text.startsWith("❌"))
            return (
              <div key={m.id} className="flex gap-4">
                <div className="w-8 flex-shrink-0" />
                <div className="flex-1 bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-sm">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" /> {m.text}
                  </div>
                  <div className="flex gap-2 mt-1">
                    <button onClick={() => onRetry?.(m.id)} className="text-xs text-blue-600 hover:underline">重试</button>
                    <button onClick={() => onRetry?.(m.id)} className="text-xs text-blue-600 hover:underline">换 V4 Flash 重试</button>
                  </div>
                </div>
              </div>
            )

          // AI 助手消息
          return (
            <div key={m.id} className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 text-white flex items-center justify-center flex-shrink-0">
                <Bot className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0 pt-1">
                <div className="text-xs text-gray-500 mb-1">Agent</div>
                <ThinkingCard text={m.thinking ?? ""} />
                <div className="prose prose-sm max-w-none text-gray-900 leading-relaxed">
                  {m.text ? (
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.text}</ReactMarkdown>
                  ) : (
                    <span className="text-gray-400">▍</span>
                  )}
                </div>
              </div>
            </div>
          )
        })}
        <div ref={endRef} />
      </div>
    </div>
  )
}
