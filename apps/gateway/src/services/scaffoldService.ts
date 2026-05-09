import { mkdir, readFile, readdir, rm, writeFile, stat } from "node:fs/promises"
import { join, dirname } from "node:path"
import { spawn } from "node:child_process"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const SCAFFOLD_ROOT = join(__dirname, "..", "..", "scaffolds")

async function walk(dir: string, targetCwd: string, rel: string, projectName: string): Promise<number> {
  let count = 0
  const items = await readdir(dir, { withFileTypes: true })
  for (const i of items) {
    const src = join(dir, i.name)
    const dest = join(targetCwd, rel, i.name)
    if (i.isDirectory()) {
      await mkdir(dest, { recursive: true })
      count += await walk(src, targetCwd, join(rel, i.name), projectName)
    } else {
      let content = await readFile(src, "utf-8")
      content = content.replace(/__PROJECT_NAME__/g, projectName)
      await mkdir(dirname(dest), { recursive: true })
      await writeFile(dest, content)
      count++
    }
  }
  return count
}

export const scaffoldService = {
  async expand(targetCwd: string, template: string, projectName: string) {
    await rm(targetCwd, { recursive: true, force: true })
    await mkdir(targetCwd, { recursive: true })
    const src = join(SCAFFOLD_ROOT, template)
    const fileCount = await walk(src, targetCwd, "", projectName)
    return { template, projectName, fileCount }
  },

  async zip(srcCwd: string, projectId: string, filename: string) {
    const outDir = join(process.env.STATE_DIR ?? "./state", "projects", projectId, "artifacts")
    await mkdir(outDir, { recursive: true })
    const outFile = join(outDir, filename)
    await new Promise<void>((resolve, reject) => {
      const z = spawn("zip", ["-r", outFile, ".", "-x", "node_modules/*", ".git/*", "dist/*"], { cwd: srcCwd })
      let err = ""
      z.stderr.on("data", (d) => err += d.toString())
      z.on("close", (c) => c === 0 ? resolve() : reject(new Error(`zip exit ${c}: ${err}`)))
      z.on("error", reject)
    })
    const s = await stat(outFile)
    return { name: filename, size: s.size }
  },
}
