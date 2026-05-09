import { useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { ChevronDown, Plus, Trash2 } from "lucide-react"
import type { ProjectMeta } from "../lib/types"

export function ProjectSwitcher() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [list, setList] = useState<ProjectMeta[]>([])
  const current = list.find((p) => p.id === projectId)

  const load = async () => {
    const r = await fetch("/projects").then((r) => r.json())
    setList(r)
  }

  useEffect(() => { load() }, [])

  const onCreate = async () => {
    const name = window.prompt("项目名称（可留空）") ?? undefined
    const meta = await fetch("/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    }).then((r) => r.json())
    setOpen(false)
    navigate(`/project/${meta.id}`)
    await load()
  }

  const onDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!window.confirm("确认删除该项目？所有会话和产出物会被删除。")) return
    await fetch(`/projects/${id}`, { method: "DELETE" })
    await load()
    if (id === projectId && list.length > 1) {
      const next = list.find((p) => p.id !== id)
      if (next) navigate(`/project/${next.id}`)
    }
  }

  return (
    <div className="relative">
      <button
        className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-gray-200 hover:bg-gray-50 text-sm"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="max-w-[180px] truncate">{current?.name ?? "选择项目"}</span>
        <ChevronDown className="w-4 h-4 text-gray-400" />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 w-72 bg-white border border-gray-200 rounded-md shadow-lg z-50">
          <button
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 border-b border-gray-100"
            onClick={onCreate}
          >
            <Plus className="w-4 h-4" /> 新建项目
          </button>
          <div className="max-h-80 overflow-y-auto">
            {list.map((p) => (
              <button
                key={p.id}
                className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-sm text-left hover:bg-gray-50 ${p.id === projectId ? "bg-blue-50" : ""}`}
                onClick={() => { setOpen(false); navigate(`/project/${p.id}`) }}
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate">{p.name}</div>
                  <div className="text-xs text-gray-400">{new Date(p.updatedAt).toLocaleString("zh-CN")}</div>
                </div>
                <Trash2
                  className="w-4 h-4 text-gray-300 hover:text-red-500"
                  onClick={(e) => onDelete(p.id, e)}
                />
              </button>
            ))}
            {list.length === 0 && (
              <div className="px-3 py-6 text-center text-sm text-gray-400">
                还没有项目，点击上方 "新建" 开始
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
