import { Brain } from "lucide-react"

const LEVELS = ["off", "low", "medium", "high", "xhigh"] as const

export function ThinkingSlider({ value, onChange, disabled }: { value: string; onChange: (v: typeof LEVELS[number]) => void; disabled?: boolean }) {
  return (
    <div className="flex items-center gap-1 text-xs" title={disabled ? "当前模型不支持 thinking" : "调节思考强度"}>
      <Brain className="w-3 h-3 text-gray-400" />
      {LEVELS.map((l) => (
        <button key={l} disabled={disabled}
          className={`px-1.5 py-0.5 rounded ${value === l ? "bg-purple-100 text-purple-700" : "text-gray-400 hover:text-gray-700"} disabled:opacity-30`}
          onClick={() => onChange(l)}>
          {l}
        </button>
      ))}
    </div>
  )
}
