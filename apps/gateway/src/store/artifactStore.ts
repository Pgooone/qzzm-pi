import { mkdir, readFile, writeFile, readdir, stat, rename } from "node:fs/promises"
import { join, dirname, extname } from "node:path"
import { EventEmitter } from "node:events"

export const artifactBus = new EventEmitter()

const STATE_DIR = process.env.STATE_DIR ?? "./state"

// per-project mutex: 避免 save 并发造成 latest/version 不一致
const locks = new Map<string, Promise<unknown>>()
function withLock<T>(projectId: string, fn: () => Promise<T>): Promise<T> {
  const prev = locks.get(projectId) ?? Promise.resolve()
  const next = prev.then(fn, fn)
  locks.set(projectId, next.catch(() => {}))
  return next as Promise<T>
}

function artDir(projectId: string) {
  return join(STATE_DIR, "projects", projectId, "artifacts")
}
function versionsDir(projectId: string, name: string) {
  return join(artDir(projectId), ".versions", name)
}

export interface ArtifactInfo {
  name: string
  version: string
  size?: number
  updatedAt?: number
}

export const artifactStore = {
  async save(projectId: string, name: string, version: string, content: string) {
    return withLock(projectId, async () => {
      const v = (version || "").replace(/^[vV]+/, "")
      const verLabel = version === "final" ? "final" : v ? `v${v}` : "v1"

      await mkdir(artDir(projectId), { recursive: true })
      await mkdir(versionsDir(projectId, name), { recursive: true })

      const latestPath = join(artDir(projectId), name)
      const ext = extname(name) || ".md"
      const versionPath = join(versionsDir(projectId, name), `${verLabel}${ext}`)
      await writeFile(latestPath, content, "utf-8")
      await writeFile(versionPath, content, "utf-8")

      const info: ArtifactInfo = { name, version: verLabel, size: Buffer.byteLength(content, "utf-8"), updatedAt: Date.now() }
      artifactBus.emit("updated", { projectId, ...info })
      return info
    })
  },

  async list(projectId: string): Promise<ArtifactInfo[]> {
    const dir = artDir(projectId)
    await mkdir(dir, { recursive: true })
    const files = await readdir(dir, { withFileTypes: true })
    const out: ArtifactInfo[] = []
    for (const f of files) {
      if (!f.isFile()) continue
      if (f.name.startsWith(".")) continue
      const s = await stat(join(dir, f.name))
      out.push({ name: f.name, version: "latest", size: s.size, updatedAt: s.mtimeMs })
    }
    return out
  },

  async listVersions(projectId: string, name: string): Promise<string[]> {
    try {
      const files = await readdir(versionsDir(projectId, name))
      return files.map((f) => f.replace(/\.[^.]+$/, "")).sort()
    } catch {
      return []
    }
  },

  async load(projectId: string, name: string, version?: string): Promise<string> {
    if (!version || version === "latest") {
      return await readFile(join(artDir(projectId), name), "utf-8")
    }
    const ext = extname(name) || ".md"
    return await readFile(join(versionsDir(projectId, name), `${version}${ext}`), "utf-8")
  },

  /** 迁移 Day 1 平铺版本 → .versions 嵌套。幂等。 */
  async migrate(projectId: string) {
    const dir = artDir(projectId)
    let entries: string[] = []
    try { entries = await readdir(dir) } catch { return }
    for (const f of entries) {
      const m = f.match(/^(.+?)\.(v\d+|final)$/)
      if (!m) continue
      const [, baseName, label] = m
      const ext = extname(baseName) || ".md"
      const dest = join(versionsDir(projectId, baseName), `${label}${ext}`)
      await mkdir(dirname(dest), { recursive: true })
      await rename(join(dir, f), dest)
    }
  },

  async migrateAll() {
    const root = join(STATE_DIR, "projects")
    let pids: string[] = []
    try { pids = await readdir(root) } catch { return }
    for (const pid of pids) await this.migrate(pid)
  },
}
