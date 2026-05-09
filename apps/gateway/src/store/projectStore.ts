import { mkdir, readFile, writeFile, readdir, stat, rm } from "node:fs/promises"
import { join } from "node:path"
import { customAlphabet } from "nanoid"

const nano = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 8)

export type ProjectMeta = {
  id: string
  name: string
  createdAt: number
  updatedAt: number
}

export class ProjectStore {
  constructor(private root: string) {}

  private dirOf(id: string) { return join(this.root, id) }
  private metaPath(id: string) { return join(this.dirOf(id), "meta.json") }

  async list(): Promise<ProjectMeta[]> {
    await mkdir(this.root, { recursive: true })
    const entries = await readdir(this.root, { withFileTypes: true })
    const out: ProjectMeta[] = []
    for (const e of entries) {
      if (!e.isDirectory()) continue
      try {
        const raw = await readFile(this.metaPath(e.name), "utf-8")
        out.push(JSON.parse(raw))
      } catch {
        const d = this.dirOf(e.name)
        const s = await stat(d)
        const meta: ProjectMeta = {
          id: e.name,
          name: e.name,
          createdAt: s.birthtimeMs,
          updatedAt: s.mtimeMs,
        }
        await writeFile(this.metaPath(e.name), JSON.stringify(meta, null, 2))
        out.push(meta)
      }
    }
    return out.sort((a, b) => b.updatedAt - a.updatedAt)
  }

  async create(name?: string): Promise<ProjectMeta> {
    const id = `proj-${nano()}`
    const now = Date.now()
    const meta: ProjectMeta = {
      id,
      name: name?.trim() || `项目 ${new Date(now).toLocaleString("zh-CN")}`,
      createdAt: now,
      updatedAt: now,
    }
    await mkdir(this.dirOf(id), { recursive: true })
    await writeFile(this.metaPath(id), JSON.stringify(meta, null, 2))
    return meta
  }

  async touch(id: string) {
    try {
      const raw = await readFile(this.metaPath(id), "utf-8")
      const meta: ProjectMeta = JSON.parse(raw)
      meta.updatedAt = Date.now()
      await writeFile(this.metaPath(id), JSON.stringify(meta, null, 2))
    } catch { /* ignore */ }
  }

  async ensureExists(id: string): Promise<ProjectMeta> {
    try {
      const raw = await readFile(this.metaPath(id), "utf-8")
      return JSON.parse(raw)
    } catch {
      const now = Date.now()
      const meta: ProjectMeta = { id, name: id, createdAt: now, updatedAt: now }
      await mkdir(this.dirOf(id), { recursive: true })
      await writeFile(this.metaPath(id), JSON.stringify(meta, null, 2))
      return meta
    }
  }

  async remove(id: string) {
    await rm(this.dirOf(id), { recursive: true, force: true })
  }
}

const STATE_DIR = process.env.STATE_DIR ?? "./state"
export const projectStore = new ProjectStore(join(STATE_DIR, "projects"))
