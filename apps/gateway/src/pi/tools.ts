import { defineTool } from "@earendil-works/pi-coding-agent"
import { Type } from "@sinclair/typebox"
import { artifactStore } from "../store/artifactStore.js"

export function buildPrdTools(projectId: string) {
  const writePrd = defineTool({
    name: "write_prd",
    label: "写入 PRD",
    description: "把最终 PRD 全文写入 artifacts/prd.md。每次修改都应调用此工具产生新版本。",
    parameters: Type.Object({
      content: Type.String({ description: "完整的 PRD markdown 文本" }),
      version: Type.String({ description: "版本号 v1 / v2 / final" }),
    }, { additionalProperties: false }),
    execute: async (_id, { content, version }) => {
      // 规范化版本号: "vv1" / "V1" / "v 1" → "v1"
      let v = version.trim()
      v = v.replace(/^[vV]+/, "")
      v = v ? `v${v}` : "v1"
      const rec = await artifactStore.save(projectId, "prd.md", v, content)
      return {
        content: [
          { type: "text", text: `已写入 prd.md（${v}，${rec.size ?? 0} 字节）。用户可在右侧面板预览或导出。` },
        ],
        details: { version: v, size: rec.size },
      }
    },
  })

  const readPrd = defineTool({
    name: "read_prd",
    label: "读取当前 PRD",
    description: "读取 artifacts/prd.md 的最新版本，便于在用户要求修改时基于现状改写。",
    parameters: Type.Object({}, { additionalProperties: false }),
    execute: async () => {
      try {
        const content = await artifactStore.load(projectId, "prd.md")
        return { content: [{ type: "text", text: content }], details: { size: content.length } }
      } catch {
        return { content: [{ type: "text", text: "prd.md 还不存在，请先写入第一版。" }], details: {} }
      }
    },
  })

  return [writePrd, readPrd]
}
