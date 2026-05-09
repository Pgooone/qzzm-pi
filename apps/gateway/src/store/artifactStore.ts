import { mkdir, readFile, writeFile, readdir, stat } from "node:fs/promises"
import { join } from "node:path"
import { EventEmitter } from "node:events"

const STATE_DIR = process.env.STATE_DIR ?? "./state"

export const artifactBus = new EventEmitter()

export interface ArtifactRecord {
  projectId: string
  name: string
  version: string
  path: string
  size: number
  updatedAt: number
  kind: "prd" | "design" | "code" | "review"
}

function projectDir(projectId: string) {
  return join(STATE_DIR, "projects", projectId, "artifacts")
}

export const artifactStore = {
  async save(projectId: string, name: string, content: string, version: string, kind: ArtifactRecord["kind"]) {
    const dir = projectDir(projectId)
    await mkdir(dir, { recursive: true })
    const latest = join(dir, name)
    const versioned = join(dir, `${name}.${version}`)
    await writeFile(latest, content, "utf8")
    await writeFile(versioned, content, "utf8")
    const rec: ArtifactRecord = {
      projectId,
      name,
      version,
      path: latest,
      size: Buffer.byteLength(content, "utf8"),
      updatedAt: Date.now(),
      kind,
    }
    artifactBus.emit("updated", rec)
    return rec
  },

  async load(projectId: string, name: string) {
    const path = join(projectDir(projectId), name)
    const content = await readFile(path, "utf8")
    const s = await stat(path)
    return { content, size: s.size, updatedAt: s.mtimeMs, path }
  },

  async list(projectId: string) {
    const dir = projectDir(projectId)
    try {
      const files = await readdir(dir)
      return files.filter((f) => !f.includes(".v") && !/\.final$/.test(f))
    } catch {
      return []
    }
  },
}
