import type { FastifyInstance } from "fastify"
import { artifactStore } from "./store/artifactStore.js"

export async function registerArtifactRoutes(app: FastifyInstance) {
  app.get("/artifacts/:projectId", async (req) => {
    const { projectId } = req.params as { projectId: string }
    return { files: await artifactStore.list(projectId) }
  })

  app.get<{ Params: { projectId: string; name: string }; Querystring: { version?: string } }>(
    "/artifacts/:projectId/:name",
    async (req, reply) => {
      const { projectId, name } = req.params
      const version = req.query.version
      try {
        const content = await artifactStore.load(projectId, name, version)
        if (name.endsWith(".html") || name.endsWith(".htm")) {
          reply.header("content-type", "text/html; charset=utf-8")
        } else {
          reply.header("content-type", "text/plain; charset=utf-8")
        }
        return content
      } catch {
        reply.status(404)
        return "not found"
      }
    }
  )

  app.get("/artifacts/:projectId/:name/versions", async (req) => {
    const { projectId, name } = req.params as { projectId: string; name: string }
    return { versions: await artifactStore.listVersions(projectId, name) }
  })

  app.get("/artifacts/:projectId/:name/download", async (req, reply) => {
    const { projectId, name } = req.params as { projectId: string; name: string }
    try {
      const content = await artifactStore.load(projectId, name)
      reply
        .header("content-type", "text/markdown; charset=utf-8")
        .header("content-disposition", `attachment; filename="${name}"`)
        .send(content)
    } catch {
      reply.status(404)
      return "not found"
    }
  })
}
