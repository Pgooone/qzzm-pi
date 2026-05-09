import { useEffect, useState } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { Download, FileText } from "lucide-react"
import type { ArtifactInfo } from "../lib/types"

export function ArtifactPanel({ projectId, artifacts }: { projectId: string; artifacts: ArtifactInfo[] }) {
  const [active, setActive] = useState<string | null>(null)
  const [content, setContent] = useState<string>("")

  useEffect(() => {
    if (!active) return
    fetch(`/artifacts/${projectId}/${active}`).then((r) => r.text()).then(setContent)
  }, [active, projectId, artifacts])

  useEffect(() => {
    if (!active && artifacts.length > 0) setActive(artifacts[0].name)
  }, [artifacts, active])

  return (
    <aside className="w-[420px] border-l bg-white flex flex-col">
      <div className="p-3 border-b text-sm font-semibold flex items-center gap-2"><FileText className="w-4 h-4" /> 产出物</div>
      <div className="flex gap-1 px-3 py-2 border-b overflow-x-auto">
        {artifacts.length === 0 && <div className="text-xs text-gray-400">还没有产出物，先和需求 Agent 聊聊吧</div>}
        {artifacts.map((a) => (
          <button key={a.name} onClick={() => setActive(a.name)} className={`px-2 py-1 text-xs rounded border ${active === a.name ? "bg-blue-50 border-blue-300 text-blue-700" : "hover:bg-gray-50"}`}>
            {a.name} <span className="text-gray-400">{a.version}</span>
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-auto px-4 py-3">
        {active ? (
          <div className="prose prose-sm max-w-none"><ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown></div>
        ) : (
          <div className="text-xs text-gray-400 mt-10 text-center">选择左侧标签预览</div>
        )}
      </div>
      {active && (
        <div className="border-t p-3 flex gap-2">
          <a href={`/artifacts/${projectId}/${active}/download`} className="flex-1 text-center text-sm px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700 flex items-center justify-center gap-1">
            <Download className="w-4 h-4" /> 下载 .md
          </a>
          <button disabled className="flex-1 text-sm px-3 py-1.5 rounded border opacity-50" title="Day 3 接入">导出 .docx</button>
          <button disabled className="flex-1 text-sm px-3 py-1.5 rounded border opacity-50" title="Day 3 接入">导出 .pdf</button>
        </div>
      )}
    </aside>
  )
}
