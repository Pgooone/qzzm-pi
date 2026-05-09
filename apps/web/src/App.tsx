import { Routes, Route, Navigate, useParams } from "react-router-dom"
import { useEffect, useState } from "react"
import { ChatWindow } from "./components/ChatWindow"
import { ProjectSwitcher } from "./components/ProjectSwitcher"
import type { ProjectMeta } from "./lib/types"

function ProjectPage() {
  const { projectId } = useParams<{ projectId: string }>()
  if (!projectId) return null
  return (
    <div className="h-screen flex flex-col">
      <header className="h-12 px-4 flex items-center gap-3 border-b border-gray-200 bg-white">
        <span className="font-semibold text-base">🛠️ 全栈智码</span>
        <ProjectSwitcher />
      </header>
      <ChatWindow projectId={projectId} />
    </div>
  )
}

function Bootstrap() {
  const [list, setList] = useState<ProjectMeta[]>([])
  useEffect(() => {
    fetch("/projects").then((r) => r.json()).then(setList)
  }, [])
  if (list.length > 0) return <Navigate to={`/project/${list[0].id}`} replace />
  return (
    <div className="h-screen flex items-center justify-center">
      <button
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        onClick={async () => {
          const r = await fetch("/projects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) }).then((r) => r.json())
          location.replace(`/project/${r.id}`)
        }}
      >创建你的第一个项目</button>
    </div>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/project/:projectId" element={<ProjectPage />} />
      <Route path="*" element={<Bootstrap />} />
    </Routes>
  )
}
