import { useState } from "react"
import { ChevronDown, ChevronRight, Brain } from "lucide-react"

export function ThinkingCard({ text }: { text: string }) {
  const [open, setOpen] = useState(false)
  if (!text) return null
  return (
    <div className="my-2 border border-purple-200 bg-purple-50/40 rounded-lg">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-purple-700">
        {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        <Brain className="w-4 h-4" />
        <span>思考过程（{text.length} 字）</span>
      </button>
      {open && <pre className="px-3 pb-2 text-xs whitespace-pre-wrap text-purple-900 font-mono">{text}</pre>}
    </div>
  )
}
