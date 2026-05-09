import { defineTool } from "@earendil-works/pi-coding-agent"
import { Type } from "@sinclair/typebox"
import { artifactStore } from "../../store/artifactStore.js"

export function buildDesignTools(projectId: string) {
  const writeDesign = defineTool({
    name: "write_design",
    label: "写入设计产出",
    description: "写入 design.md 或 ui-prototype.html。每次修改都应调用此工具产生新版本。",
    parameters: Type.Object({
      filename: Type.Union([Type.Literal("design.md"), Type.Literal("ui-prototype.html")]),
      content: Type.String({ description: "完整文件内容，不是 patch" }),
      version: Type.Optional(Type.String({ description: "版本号 v1 / v2 / final，不填自动 v1" })),
    }, { additionalProperties: false }),
    execute: async (_id, params) => {
      let v = (params.version || "v1").trim()
      v = v.replace(/^[vV]+/, "")
      v = v ? `v${v}` : "v1"
      const info = await artifactStore.save(projectId, params.filename, v, params.content)
      return {
        content: [{ type: "text", text: `已写入 ${params.filename} 版本 ${info.version}，大小 ${info.size} bytes。` }],
        details: { name: info.name, version: info.version },
      }
    },
  })

  const readPrdForDesign = defineTool({
    name: "read_prd_for_design",
    label: "读 PRD",
    description: "读取 PRD 产出供设计参考。优先 final 版本，取不到则读 latest。",
    parameters: Type.Object({
      version: Type.Optional(Type.String({ description: "final | v1 | v2 | latest，不填自动优先 final" })),
    }, { additionalProperties: false }),
    execute: async (_id, params) => {
      const tryOrder = params.version ? [params.version] : ["final", "latest"]
      for (const v of tryOrder) {
        try {
          const c = await artifactStore.load(projectId, "prd.md", v === "latest" ? undefined : v)
          return { content: [{ type: "text", text: c }], details: { version: v } }
        } catch { /* try next */ }
      }
      return { content: [{ type: "text", text: "未找到 PRD。建议先回需求 Agent 定稿一份 PRD。" }], details: {}, isError: true }
    },
  })

  return [writeDesign, readPrdForDesign]
}
