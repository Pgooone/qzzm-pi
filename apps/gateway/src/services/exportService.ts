import { mkdir } from "node:fs/promises"
import { join } from "node:path"
import { EventEmitter } from "node:events"
import { customAlphabet } from "nanoid"
import { mdToDocx } from "./md2docx.js"
import { mdToPdf } from "./md2pdf.js"
import { mdTablesToXlsx } from "./table2xlsx.js"
import { artifactStore } from "../store/artifactStore.js"

export type ExportFormat = "docx" | "pdf" | "xlsx"
export type ExportJob = {
  id: string
  projectId: string
  artifactName: string
  format: ExportFormat
  status: "pending" | "running" | "done" | "error"
  progress: number
  outputPath?: string
  error?: string
}

const nano = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 10)
const jobs = new Map<string, ExportJob>()
export const exportBus = new EventEmitter()

function outDir(projectId: string) {
  return join(process.env.STATE_DIR ?? "./state", "projects", projectId, "exports")
}

export const exportService = {
  jobs,
  async create(projectId: string, name: string, format: ExportFormat): Promise<ExportJob> {
    const id = `job-${nano()}`
    const job: ExportJob = { id, projectId, artifactName: name, format, status: "pending", progress: 0 }
    jobs.set(id, job)
    this.run(job).catch((e) => {
      job.status = "error"; job.error = String(e?.message ?? e)
      exportBus.emit("progress", job)
    })
    return job
  },
  async run(job: ExportJob) {
    job.status = "running"; job.progress = 10
    exportBus.emit("progress", job)

    const md = await artifactStore.load(job.projectId, job.artifactName)
    job.progress = 30; exportBus.emit("progress", job)

    await mkdir(outDir(job.projectId), { recursive: true })
    const baseName = job.artifactName.replace(/\.[^.]+$/, "")
    const outFile = join(outDir(job.projectId), `${baseName}.${job.format}`)

    if (job.format === "docx") await mdToDocx(md, outFile)
    else if (job.format === "pdf") await mdToPdf(md, outFile)
    else await mdTablesToXlsx(md, outFile)

    job.outputPath = outFile
    job.progress = 100
    job.status = "done"
    exportBus.emit("progress", job)
  },
  get(id: string) { return jobs.get(id) },
}
