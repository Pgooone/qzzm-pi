import { defineTool } from "@earendil-works/pi-coding-agent"
import { Type } from "@sinclair/typebox"
import { readdir, readFile } from "node:fs/promises"
import { resolve, join } from "node:path"
import { artifactStore } from "../../store/artifactStore.js"
import { isAllowed } from "../../services/sandbox.js"
import { spawn } from "node:child_process"

const STATE_DIR = process.env.STATE_DIR ?? "./state"

async function listFiles(dir: string, prefix = ""): Promise<string[]> {
  const out: string[] = []
  try {
    const items = await readdir(dir, { withFileTypes: true })
    for (const i of items) {
      if (i.name.startsWith(".") || i.name === "node_modules" || i.name === "dist") continue
      const full = join(prefix, i.name)
      if (i.isDirectory()) {
        out.push(...await listFiles(join(dir, i.name), full + "/"))
      } else {
        out.push(full)
      }
    }
  } catch { /* workspace may be empty */ }
  return out
}

function extOf(name: string): string {
  const m = name.match(/\.([a-z]+)$/i)
  return m ? m[1] : ""
}

export function buildReviewTools(projectId: string) {
  const cwd = resolve(STATE_DIR, "projects", projectId, "workspace")

  const readCode = defineTool({
    name: "read_code",
    label: "读取代码",
    description: "列出 workspace 文件树，或读取指定文件内容。",
    parameters: Type.Object({
      filePath: Type.Optional(Type.String({ description: "相对路径，不填则列出文件树" })),
    }, { additionalProperties: false }),
    execute: async (_id, params) => {
      if (!params.filePath) {
        const files = await listFiles(cwd)
        return { content: [{ type: "text", text: `workspace 文件列表 (${files.length} 个):\n${files.join("\n")}` }], details: { count: files.length } }
      }
      const fp = join(cwd, params.filePath)
      try {
        const content = await readFile(fp, "utf-8")
        return { content: [{ type: "text", text: `=== ${params.filePath} ===\n${content.slice(0, 16000)}` }], details: { size: content.length } }
      } catch (e: any) {
        return { content: [{ type: "text", text: `读取失败: ${e?.message}` }], details: {}, isError: true }
      }
    },
  })

  const runTests = defineTool({
    name: "run_tests",
    label: "运行测试",
    description: "在 workspace 中运行测试命令（仅白名单命令）。",
    parameters: Type.Object({
      cmd: Type.String({ description: "测试命令，例如 pnpm test 或 npm test" }),
    }, { additionalProperties: false }),
    execute: async (_id, params, signal) => {
      const check = isAllowed(params.cmd)
      if (!check.ok) {
        return { content: [{ type: "text", text: `拒绝执行: ${check.reason}` }], details: {}, isError: true }
      }
      return await new Promise((resolve) => {
        const child = spawn("bash", ["-lc", params.cmd], { cwd })
        let out = ""; let err = ""
        const t = setTimeout(() => child.kill("SIGKILL"), 120_000)
        signal?.addEventListener?.("abort", () => child.kill("SIGKILL"))
        child.stdout?.on("data", (d: Buffer) => out += d.toString())
        child.stderr?.on("data", (d: Buffer) => err += d.toString())
        child.on("close", (code) => {
          clearTimeout(t)
          const text = `[exit ${code}]\n${out}${err ? "\n--stderr--\n" + err : ""}`.slice(0, 8000)
          resolve({ content: [{ type: "text", text }], details: { code, out, err }, isError: code !== 0 })
        })
        child.on("error", (e) => {
          clearTimeout(t)
          resolve({ content: [{ type: "text", text: `执行失败: ${e.message}` }], details: {}, isError: true })
        })
      })
    },
  })

  const writeReview = defineTool({
    name: "write_review",
    label: "写入审查产出",
    description: "写入审查报告文件。filename 必须是 review.md / bug-list.md / test-report.md 之一。",
    parameters: Type.Object({
      filename: Type.Union([Type.Literal("review.md"), Type.Literal("bug-list.md"), Type.Literal("test-report.md")]),
      content: Type.String({ description: "完整的 markdown 内容" }),
      version: Type.Optional(Type.String()),
    }, { additionalProperties: false }),
    execute: async (_id, params) => {
      const info = await artifactStore.save(projectId, params.filename, params.version ?? "v1", params.content)
      return {
        content: [{ type: "text", text: `已写入 ${params.filename} 版本 ${info.version}，大小 ${info.size} bytes。` }],
        details: { name: info.name, version: info.version },
      }
    },
  })

  const readDesignForReview = defineTool({
    name: "read_design_for_review",
    label: "读设计文档",
    description: "读取 design.md 获取 API 列表和服务划分，作为审查基准。",
    parameters: Type.Object({}, { additionalProperties: false }),
    execute: async () => {
      try {
        const c = await artifactStore.load(projectId, "design.md", "final").catch(() => artifactStore.load(projectId, "design.md"))
        return { content: [{ type: "text", text: c }], details: {} }
      } catch {
        return { content: [{ type: "text", text: "未找到 design.md，将仅做代码静态审查。" }], details: {}, isError: true }
      }
    },
  })

  return [readCode, runTests, writeReview, readDesignForReview]
}
