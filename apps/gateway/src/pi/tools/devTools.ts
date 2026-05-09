import { defineTool } from "@earendil-works/pi-coding-agent"
import { Type } from "@sinclair/typebox"
import { spawn } from "node:child_process"
import { resolve } from "node:path"
import { isAllowed } from "../../services/sandbox.js"
import { scaffoldService } from "../../services/scaffoldService.js"
import { artifactStore } from "../../store/artifactStore.js"

const STATE_DIR = process.env.STATE_DIR ?? "./state"

export function buildDevTools(projectId: string) {
  const cwd = resolve(STATE_DIR, "projects", projectId, "workspace")

  const safeBash = defineTool({
    name: "safe_bash",
    label: "安全 bash",
    description: "在 workspace 里跑命令。仅白名单放行。不要 cd 跳出 workspace。",
    parameters: Type.Object({
      cmd: Type.String({ description: "要执行的命令" }),
      timeoutMs: Type.Optional(Type.Integer({ minimum: 1000, maximum: 600_000 })),
    }, { additionalProperties: false }),
    execute: async (_id, params, signal) => {
      const check = isAllowed(params.cmd)
      if (!check.ok) {
        return { content: [{ type: "text", text: `拒绝执行: ${check.reason}` }], details: {}, isError: true }
      }
      return await new Promise((resolve) => {
        const child = spawn("bash", ["-lc", params.cmd], { cwd })
        let out = ""; let err = ""
        const t = setTimeout(() => child.kill("SIGKILL"), params.timeoutMs ?? 120_000)
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

  const pickScaffold = defineTool({
    name: "pick_scaffold",
    label: "选脚手架",
    description: "选择并展开一套脚手架到 workspace，清空原有文件。三选一：react-express / nextjs / vue-express。",
    parameters: Type.Object({
      template: Type.Union([Type.Literal("react-express"), Type.Literal("nextjs"), Type.Literal("vue-express")]),
      projectName: Type.String({ description: "项目名，用于 package.json name 字段" }),
    }, { additionalProperties: false }),
    execute: async (_id, params) => {
      const result = await scaffoldService.expand(cwd, params.template, params.projectName)
      return {
        content: [{ type: "text", text: `脚手架 ${params.template} 已展开。生成 ${result.fileCount} 个文件。可以跑 safe_bash pnpm install 了。` }],
        details: result,
      }
    },
  })

  const readDesign = defineTool({
    name: "read_design",
    label: "读设计文档",
    description: "读取 design.md 获取服务划分和 API 列表。优先 final 版本。",
    parameters: Type.Object({}, { additionalProperties: false }),
    execute: async () => {
      try {
        const c = await artifactStore.load(projectId, "design.md", "final").catch(() => artifactStore.load(projectId, "design.md"))
        return { content: [{ type: "text", text: c }], details: {} }
      } catch (e: any) {
        return { content: [{ type: "text", text: `读不到 design.md：${e?.message}` }], details: {}, isError: true }
      }
    },
  })

  const packageZip = defineTool({
    name: "package_zip",
    label: "打包 zip",
    description: "将整个 workspace 打包为 zip 并存为 artifact。排除 node_modules 和 .git。",
    parameters: Type.Object({
      filename: Type.String({ description: "zip 文件名，例如 my-project.zip" }),
    }, { additionalProperties: false }),
    execute: async (_id, params) => {
      const info = await scaffoldService.zip(cwd, projectId, params.filename)
      return { content: [{ type: "text", text: `已生成 ${params.filename}，大小 ${info.size} bytes。` }], details: info }
    },
  })

  return [safeBash, pickScaffold, readDesign, packageZip]
}
