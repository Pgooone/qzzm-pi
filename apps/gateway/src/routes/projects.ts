import type { FastifyInstance } from "fastify"
import { ProjectStore } from "../store/projectStore.js"
import { sessionService } from "../services/sessionService.js"

export default async function projectsRoutes(app: FastifyInstance, opts: { store: ProjectStore }) {
  const { store } = opts

  app.get("/projects", async () => {
    return await store.list()
  })

  app.post<{ Body: { name?: string } }>("/projects", async (req) => {
    return await store.create(req.body?.name)
  })

  app.delete<{ Params: { id: string } }>("/projects/:id", async (req) => {
    await store.remove(req.params.id)
    return { ok: true }
  })

  app.get<{ Params: { id: string }; Querystring: { role?: string } }>(
    "/projects/:id/tree",
    async (req) => {
      const role = (req.query.role || "prd") as any
      return await sessionService.getTree(req.params.id, role)
    }
  )
}
