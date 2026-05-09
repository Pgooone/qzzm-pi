import { useEffect, useState } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { Download, FileText, Code, Layout } from "lucide-react"
import type { ArtifactInfo } from "../lib/types"

function kindOf(name: string): "md" | "html" | "yaml" | "sql" | "text" {
  const ext = name.toLowerCase().split(".").pop() ?? ""
  if (ext === "md" || ext === "markdown") return "md"
  if (ext === "html" || ext === "htm") return "html"
  if (ext === "yaml" || ext === "yml") return "yaml"
  if (ext === "sql") return "sql"
  return "text"
}

function iconOf(k: string) {
  if (k === "html") return <Layout className="w-3 h-3" />
  if (k === "sql" || k === "yaml") return <Code className="w-3 h-3" />
  return <FileText className="w-3 h-3" />
}

export function ArtifactPanel({ projectId, artifacts }: { projectId: string; artifacts: ArtifactInfo[] }) {
  const [active, setActive] = useState<string | null>(null)
  const [content, setContent] = useState("")

  useEffect(() => {
    if (!active) return
    fetch(`/artifacts/${projectId}/${encodeURIComponent(active)}`)
      .then((r) => r.text())
      .then(setContent)
  }, [active, projectId, artifacts])

  useEffect(() => {
    if (!active && artifacts.length > 0) setActive(artifacts[0].name)
  }, [artifacts, active])

  const k = active ? kindOf(active) : "text"

  return (
    <aside className="w-[420px] border-l border-gray-200 bg-white flex flex-col">
      <div className="px-4 py-3 text-sm font-medium border-b border-gray-100">产出物</div>
      <div className="flex flex-wrap gap-1 px-3 py-2 border-b border-gray-100">
        {artifacts.length === 0 && <span className="text-xs text-gray-400">还没有产出物，先和需求 Agent 聊聊吧</span>}
        {artifacts.map((a) => (
          <button
            key={a.name}
            onClick={() => setActive(a.name)}
            className={`flex items-center gap-1 px-2 py-1 text-xs rounded border ${active === a.name ? "bg-blue-50 border-blue-300 text-blue-700" : "hover:bg-gray-50"}`}
          >
            {iconOf(kindOf(a.name))}
            {a.name}
            <span className="text-gray-400">{a.version}</span>
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-auto">
        {!active && <div className="p-6 text-xs text-gray-400">选择上方标签预览</div>}
        {active && k === "md" && (
          <div className="prose prose-sm max-w-none p-6">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
          </div>
        )}
        {active && k === "html" && (
          <iframe
            title={active}
            srcDoc={content}
            className="w-full h-full border-0"
            sandbox="allow-scripts allow-same-origin"
          />
        )}
        {active && (k === "yaml" || k === "sql" || k === "text") && (
          <pre className="p-6 text-xs whitespace-pre-wrap font-mono">{content}</pre>
        )}
      </div>
      {active && (
        <div className="flex gap-2 px-3 py-2 border-t border-gray-100">
          <a
            href={`/artifacts/${projectId}/${encodeURIComponent(active)}/download`}
            className="flex items-center gap-1 px-2 py-1 text-xs rounded border hover:bg-gray-50"
          >
            <Download className="w-3 h-3" /> 下载原文
          </a>
          <button className="px-2 py-1 text-xs rounded border text-gray-300 cursor-not-allowed" title="Day 3 接入">导出 .docx</button>
          <button className="px-2 py-1 text-xs rounded border text-gray-300 cursor-not-allowed" title="Day 3 接入">导出 .pdf</button>
        </div>
      )}
    </aside>
  )
}
