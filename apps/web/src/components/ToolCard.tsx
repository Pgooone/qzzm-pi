import { useState } from "react"
import { ChevronDown, ChevronRight, Loader2, CheckCircle2, XCircle, Wrench } from "lucide-react"

export function ToolCard({ name, params, chunks, result, isError, done }: { name: string; params: unknown; chunks: string[]; result?: unknown; isError?: boolean; done: boolean }) {
  const [open, setOpen] = useState(false)
  const Icon = !done ? Loader2 : isError ? XCircle : CheckCircle2
  const color = !done ? "text-orange-500" : isError ? "text-red-500" : "text-green-600"
  return (
    <div className="my-2 border border-orange-200 bg-orange-50/40 rounded-lg overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-orange-50">
        {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        <Wrench className="w-4 h-4 text-orange-500" />
        <span className="font-mono">{name}</span>
        <Icon className={`w-4 h-4 ml-auto ${color} ${!done ? "animate-spin" : ""}`} />
      </button>
      {open && (
        <div className="px-3 py-2 border-t border-orange-200 text-xs space-y-2 bg-white">
          <div><div className="text-gray-500 mb-1">参数</div><pre className="bg-gray-50 p-2 rounded overflow-auto max-h-40">{JSON.stringify(params, null, 2)}</pre></div>
          {chunks.length > 0 && <div><div className="text-gray-500 mb-1">流式输出</div><pre className="bg-gray-50 p-2 rounded overflow-auto max-h-40">{chunks.join("")}</pre></div>}
          {done && <div><div className="text-gray-500 mb-1">结果</div><pre className="bg-gray-50 p-2 rounded overflow-auto max-h-40">{JSON.stringify(result, null, 2)}</pre></div>}
        </div>
      )}
    </div>
  )
}
