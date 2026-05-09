import { useState } from "react"
import { Send, Square } from "lucide-react"

export function InputBox({ streaming, onSend, onAbort }: { streaming: boolean; onSend: (t: string) => void; onAbort: () => void }) {
  const [text, setText] = useState("")
  const submit = () => {
    const v = text.trim()
    if (!v) return
    onSend(v)
    setText("")
  }
  return (
    <div className="border-t bg-white p-3">
      <div className="flex items-end gap-2 bg-gray-50 border rounded-xl p-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault()
              submit()
            }
          }}
          placeholder="用一句话或一段描述讲清楚你的产品想法，或粘贴已有资料… (Enter 发送，Shift+Enter 换行)"
          rows={3}
          className="flex-1 bg-transparent resize-none outline-none text-sm"
        />
        {streaming ? (
          <button onClick={onAbort} className="p-2 rounded-lg bg-red-500 text-white hover:bg-red-600"><Square className="w-4 h-4" /></button>
        ) : (
          <button onClick={submit} className="p-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"><Send className="w-4 h-4" /></button>
        )}
      </div>
    </div>
  )
}
