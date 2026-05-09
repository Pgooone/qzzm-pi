import { ChevronDown } from "lucide-react"
import { useState } from "react"

const MODELS = [
  { provider: "deepseek", id: "deepseek-v4-pro", name: "DeepSeek V4 Pro" },
  { provider: "deepseek", id: "deepseek-v4-flash", name: "DeepSeek V4 Flash" },
  { provider: "dashscope", id: "qwen3-coder-plus", name: "通义 Qwen3 Coder" },
  { provider: "zhipu", id: "glm-4-plus", name: "智谱 GLM-4 Plus" },
]

export function ModelChip({ current, onChange }: { current?: { id: string; name: string }; onChange: (provider: string, id: string) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <button className="flex items-center gap-1 px-2 py-1 text-xs rounded border hover:bg-gray-50" onClick={() => setOpen((v) => !v)}>
        {current?.name ?? "选模型"} <ChevronDown className="w-3 h-3" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-56 bg-white border border-gray-200 rounded-md shadow-lg z-50">
          {MODELS.map((m) => (
            <button key={m.id} className={`w-full px-3 py-2 text-xs text-left hover:bg-gray-50 ${current?.id === m.id ? "bg-blue-50" : ""}`}
              onClick={() => { setOpen(false); onChange(m.provider, m.id) }}>
              {m.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
