import { useState } from "react"

export type ExportFormat = "docx" | "pdf" | "xlsx"
export interface ExportJob {
  id: string
  projectId: string
  artifactName: string
  format: ExportFormat
  status: "pending" | "running" | "done" | "error"
  progress: number
}

export function useExportJob(projectId: string) {
  const [job, setJob] = useState<ExportJob | null>(null)

  const start = async (name: string, format: ExportFormat) => {
    const res = await fetch(`/export/${projectId}/${encodeURIComponent(name)}?format=${format}`, { method: "POST" }).then((r) => r.json())
    if (res.error) return
    setJob(res)
    poll(res.id)
  }

  const poll = async (id: string) => {
    while (true) {
      const j: ExportJob = await fetch(`/export/${id}`).then((r) => r.json())
      setJob(j)
      if (j.status === "done") {
        location.assign(`/export/${id}/file`)
        break
      }
      if (j.status === "error") break
      await new Promise((r) => setTimeout(r, 500))
    }
  }

  return { job, start }
}
