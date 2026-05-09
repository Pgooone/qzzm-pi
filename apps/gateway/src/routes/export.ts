import type { FastifyInstance } from "fastify"
import { readFile } from "node:fs/promises"
import { exportService, type ExportFormat } from "../services/exportService.js"

export default async function exportRoutes(app: FastifyInstance) {
  app.post<{ Params: { projectId: string; name: string }; Querystring: { format: ExportFormat } }>(
    "/export/:projectId/:name",
    async (req) => {
      const { projectId, name } = req.params
      const { format } = req.query
      if (!["docx", "pdf", "xlsx"].includes(format)) {
        return { error: "format must be docx | pdf | xlsx" }
      }
      return await exportService.create(projectId, decodeURIComponent(name), format)
    },
  )

  app.get<{ Params: { jobId: string } }>("/export/:jobId", async (req) => {
    const job = exportService.get(req.params.jobId)
    if (!job) return { error: "not found" }
    return job
  })

  app.get<{ Params: { jobId: string } }>("/export/:jobId/file", async (req, reply) => {
    const job = exportService.get(req.params.jobId)
    if (!job || job.status !== "done" || !job.outputPath) {
      return reply.code(404).send({ error: "not ready" })
    }
    const buf = await readFile(job.outputPath)
    const mime = job.format === "pdf" ? "application/pdf"
      : job.format === "docx" ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    reply.header("Content-Type", mime)
    reply.header("Content-Disposition", `attachment; filename="${encodeURIComponent(job.outputPath.split("/").pop()!)}"`)
    return reply.send(buf)
  })
}
