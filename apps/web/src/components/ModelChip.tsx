import { ChevronDown } from "lucide-react"
import { useState, useEffect, useRef } from "react"

const MODELS = [
  { provider: "deepseek", id: "deepseek-v4-pro", name: "DeepSeek V4 Pro" },
  { provider: "deepseek", id: "deepseek-v4-flash", name: "DeepSeek V4 Flash" },
  { provider: "dashscope", id: "qwen3-coder-plus", name: "通义 Qwen3 Coder" },
  { provider: "zhipu", id: "glm-4-plus", name: "智谱 GLM-4 Plus" },
]

export function ModelChip({ current, onChange }: { current?: { id: string; name: string }; onChange: (provider: string, id: string) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button className="flex items-center gap-1 px-2 py-0.5 text-xs rounded border hover:bg-gray-50" onClick={() => setOpen((v) => !v)}>
        {current?.name ?? "选模型"} <ChevronDown className="w-3 h-3 text-gray-400" />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 w-44 bg-white border border-gray-200 rounded-md shadow-lg z-50">
          {MODELS.map((m) => (
            <button key={m.id} className={`w-full px-3 py-1.5 text-xs text-left hover:bg-gray-50 first:rounded-t-md last:rounded-b-md ${current?.id === m.id ? "bg-blue-50 text-blue-700" : ""}`}
              onClick={() => { setOpen(false); onChange(m.provider, m.id) }}>
              {m.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
