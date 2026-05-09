# 全栈智码 · Day 3 工程包：导出三件套（md→docx→pdf→xlsx）

<aside>
🎯

**前置**：Day 2 已合入 main。

**交付物**：接管 ArtifactPanel 中占位的 导出 .docx / 导出 .pdf 按钮 + 新增导出 .xlsx（针对审查报告里的表格）。

**技术选型**：纯 JS路线，不依赖 pandoc/libreoffice 等系统二进制。

**代码量**：后端 ~280 行，前端 ~80 行。估计 4-5 小时。

**分支名**：`feat/day3-export-trio`

</aside>

## 一、技术选型决策

| 转换 | 选用 | 理由 |
| --- | --- | --- |
| md → docx | `docx`  • `marked` | 纯 JS，无需 pandoc。`marked` 解 AST，手写 visitor 转 Open XML |
| md → pdf | `puppeteer`  • `marked`  • tailwindcss CDN | 保留中文字体/表格保真度；Chromium 随包装下（~280MB，dev 容忍，赛事演示场景 OK） |
| 表格 → xlsx | `exceljs` | 业界标准，支持多 sheet/样式/合并单元格 |

## 二、文件矩阵

| 状态 | 路径 | 说明 |
| --- | --- | --- |
| 新增 | `apps/gateway/src/services/exportService.ts` | 3 个转换函数 + jobQueue |
| 新增 | `apps/gateway/src/services/md2docx.ts` | marked AST → docx Document |
| 新增 | `apps/gateway/src/services/md2pdf.ts` | marked → HTML → puppeteer print |
| 新增 | `apps/gateway/src/services/table2xlsx.ts` | md 表格提取 → exceljs |
| 新增 | `apps/gateway/src/routes/export.ts` | POST `/export/:projectId/:name` · GET `/export/:jobId` |
| 修改 | `apps/gateway/src/index.ts` | 挂 export routes |
| 修改 | `apps/gateway/src/ws.ts` |   • `export_progress` OutMsg |
| 新增 | `apps/web/src/hooks/useExportJob.ts` | 推 job + 轮询进度 + 下载 |
| 修改 | `apps/web/src/components/ArtifactPanel.tsx` | 接管 docx/pdf 按钮 + 加 xlsx 按钮 + 进度条 |
| 修改 | `apps/web/src/lib/types.ts` |   • ExportJob/ExportFormat |
| 修改 | `apps/gateway/package.json` |   • marked、docx、puppeteer、exceljs |

## 三、关键代码

### 3.1 `apps/gateway/src/services/exportService.ts`

```tsx
import { promises as fs } from "node:fs"
import path from "node:path"
import { customAlphabet } from "nanoid"
import { mdToDocx } from "./md2docx.js"
import { mdToPdf } from "./md2pdf.js"
import { mdTablesToXlsx } from "./table2xlsx.js"
import { artifactStore } from "../store/artifactStore.js"
import { EventEmitter } from "node:events"

export type ExportFormat = "docx" | "pdf" | "xlsx"
export type ExportJob = {
  id: string
  projectId: string
  artifactName: string
  format: ExportFormat
  status: "pending" | "running" | "done" | "error"
  progress: number   // 0..100
  outputPath?: string
  error?: string
}

const nano = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 10)
const jobs = new Map<string, ExportJob>()
export const exportBus = new EventEmitter()

function outDir(projectId: string) {
  return path.join(process.env.STATE_DIR ?? "./state", "projects", projectId, "exports")
}

export const exportService = {
  jobs,
  async create(projectId: string, name: string, format: ExportFormat): Promise<ExportJob> {
    const id = `job-${nano()}`
    const job: ExportJob = { id, projectId, artifactName: name, format, status: "pending", progress: 0 }
    jobs.set(id, job)
    // 异步跑
    this.run(job).catch((e) => {
      job.status = "error"; job.error = String(e?.message ?? e)
      exportBus.emit("progress", job)
    })
    return job
  },
  async run(job: ExportJob) {
    job.status = "running"; job.progress = 10
    exportBus.emit("progress", job)

    const md = await artifactStore.load(job.projectId, job.artifactName)
    job.progress = 30; exportBus.emit("progress", job)

    await fs.mkdir(outDir(job.projectId), { recursive: true })
    const baseName = job.artifactName.replace(/\.[^.]+$/, "")
    const outFile = path.join(outDir(job.projectId), `${baseName}.${job.format}`)

    if (job.format === "docx") await mdToDocx(md, outFile)
    else if (job.format === "pdf") await mdToPdf(md, outFile)
    else await mdTablesToXlsx(md, outFile)

    job.outputPath = outFile
    job.progress = 100
    job.status = "done"
    exportBus.emit("progress", job)
  },
  get(id: string) { return jobs.get(id) },
}
```

### 3.2 `apps/gateway/src/services/md2docx.ts`（简化版 visitor）

```tsx
import { promises as fs } from "node:fs"
import { marked, type Tokens } from "marked"
import { Document, Packer, Paragraph, HeadingLevel, TextRun, Table, TableRow, TableCell, WidthType } from "docx"

function tokensToParagraphs(tokens: Tokens.Token[]): (Paragraph | Table)[] {
  const out: (Paragraph | Table)[] = []
  for (const t of tokens) {
    if (t.type === "heading") {
      const level = (t.depth as number) || 1
      const heading = ([HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3, HeadingLevel.HEADING_4, HeadingLevel.HEADING_5, HeadingLevel.HEADING_6] as any)[level - 1]
      out.push(new Paragraph({ heading, children: [new TextRun(t.text)] }))
    } else if (t.type === "paragraph") {
      out.push(new Paragraph({ children: [new TextRun(t.text)] }))
    } else if (t.type === "list") {
      for (const item of (t as Tokens.List).items) {
        out.push(new Paragraph({ bullet: { level: 0 }, children: [new TextRun(item.text)] }))
      }
    } else if (t.type === "code") {
      out.push(new Paragraph({ children: [new TextRun({ text: t.text, font: "Courier New", size: 20 })] }))
    } else if (t.type === "table") {
      const tbl = t as Tokens.Table
      out.push(new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({ children: tbl.header.map((h) => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: h.text, bold: true })] })] })) }),
          ...tbl.rows.map((r) => new TableRow({ children: r.map((c) => new TableCell({ children: [new Paragraph(c.text)] })) })),
        ],
      }))
    } else if (t.type === "hr") {
      out.push(new Paragraph({ children: [new TextRun("─".repeat(40))] }))
    } else if (t.type === "blockquote") {
      out.push(new Paragraph({ indent: { left: 720 }, children: [new TextRun(t.text || "")] }))
    }
  }
  return out
}

export async function mdToDocx(md: string, outFile: string) {
  const tokens = marked.lexer(md)
  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: "Microsoft YaHei", size: 22 },
        },
      },
    },
    sections: [{ children: tokensToParagraphs(tokens) }],
  })
  const buf = await Packer.toBuffer(doc)
  await fs.writeFile(outFile, buf)
}
```

### 3.3 `apps/gateway/src/services/md2pdf.ts`

```tsx
import { promises as fs } from "node:fs"
import { marked } from "marked"
import puppeteer from "puppeteer"

const PDF_TEMPLATE = (htmlBody: string) => `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"/>
<script src="https://cdn.tailwindcss.com"></script>
<style>
  body{font-family:"Microsoft YaHei",-apple-system,sans-serif;padding:40px 60px;color:#111;}
  h1{font-size:28px;margin:24px 0 12px;border-bottom:2px solid #ddd;padding-bottom:8px;}
  h2{font-size:22px;margin:20px 0 10px;}
  h3{font-size:18px;margin:16px 0 8px;}
  p{line-height:1.7;margin:8px 0;}
  table{border-collapse:collapse;width:100%;margin:12px 0;}
  th,td{border:1px solid #ddd;padding:6px 10px;text-align:left;}
  th{background:#f5f5f5;}
  code{background:#f5f5f5;padding:2px 6px;border-radius:3px;font-family:"SF Mono",monospace;font-size:13px;}
  pre{background:#1e1e1e;color:#dcdcdc;padding:12px;border-radius:6px;overflow-x:auto;}
  pre code{background:transparent;color:inherit;padding:0;}
  blockquote{border-left:4px solid #3b82f6;background:#eff6ff;padding:10px 14px;margin:12px 0;}
</style>
</head><body>${htmlBody}</body></html>`

export async function mdToPdf(md: string, outFile: string) {
  const html = await marked.parse(md, { gfm: true })
  const fullHtml = PDF_TEMPLATE(html)

  const browser = await puppeteer.launch({
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
    headless: true,
  })
  try {
    const page = await browser.newPage()
    await page.setContent(fullHtml, { waitUntil: "networkidle0" })
    await page.pdf({
      path: outFile,
      format: "A4",
      printBackground: true,
      margin: { top: "20mm", right: "15mm", bottom: "20mm", left: "15mm" },
    })
  } finally {
    await browser.close()
  }
}
```

### 3.4 `apps/gateway/src/services/table2xlsx.ts`

```tsx
import ExcelJS from "exceljs"
import { marked, type Tokens } from "marked"

/**
 * 从 md 中提取所有表格，每个表为一个 sheet。
 * sheet 名从表格前紧邻的 heading 取，取不到用 Sheet1/Sheet2。
 */
export async function mdTablesToXlsx(md: string, outFile: string) {
  const tokens = marked.lexer(md)
  const wb = new ExcelJS.Workbook()
  let lastHeading = ""
  let idx = 0

  for (const t of tokens) {
    if (t.type === "heading") lastHeading = (t as Tokens.Heading).text
    if (t.type !== "table") continue
    const tbl = t as Tokens.Table
    const sheetName = (lastHeading || `Sheet${++idx}`).slice(0, 31).replace(/[\\/?*[\]:]/g, "_")
    const sheet = wb.addWorksheet(sheetName)

    sheet.addRow(tbl.header.map((h) => h.text))
    sheet.getRow(1).font = { bold: true }
    sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEEEEEE" } }
    for (const row of tbl.rows) sheet.addRow(row.map((c) => c.text))

    sheet.columns.forEach((col) => {
      let max = 10
      col.eachCell?.((cell) => { max = Math.max(max, String(cell.value ?? "").length + 2) })
      col.width = Math.min(60, max)
    })
  }

  if (wb.worksheets.length === 0) {
    const empty = wb.addWorksheet("空")
    empty.addRow(["该 markdown 未检测到表格"])
  }
  await wb.xlsx.writeFile(outFile)
}
```

### 3.5 `apps/gateway/src/routes/export.ts`

```tsx
import type { FastifyInstance } from "fastify"
import { promises as fs } from "node:fs"
import { exportService, type ExportFormat } from "../services/exportService.js"

export default async function exportRoutes(app: FastifyInstance) {
  app.post<{ Params: { projectId: string; name: string }; Querystring: { format: ExportFormat } }>(
    "/export/:projectId/:name",
    async (req) => {
      const { projectId, name } = req.params
      const { format } = req.query
      if (!["docx", "pdf", "xlsx"].includes(format)) {
        return { error: "format must be docx | pdf | xlsx" }
      }
      return await exportService.create(projectId, decodeURIComponent(name), format)
    },
  )

  app.get<{ Params: { jobId: string } }>("/export/:jobId", async (req) => {
    const job = exportService.get(req.params.jobId)
    if (!job) return { error: "not found" }
    return job
  })

  app.get<{ Params: { jobId: string } }>("/export/:jobId/file", async (req, reply) => {
    const job = exportService.get(req.params.jobId)
    if (!job || job.status !== "done" || !job.outputPath) {
      return reply.code(404).send({ error: "not ready" })
    }
    const buf = await fs.readFile(job.outputPath)
    const mime = job.format === "pdf" ? "application/pdf"
      : job.format === "docx" ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    reply.header("Content-Type", mime)
    reply.header("Content-Disposition", `attachment; filename="${encodeURIComponent(job.outputPath.split("/").pop()!)}"`)
    return reply.send(buf)
  })
}
```

### 3.6 `apps/web/src/hooks/useExportJob.ts`

```tsx
import { useState } from "react"
import type { ExportFormat, ExportJob } from "../lib/types"

export function useExportJob(projectId: string) {
  const [job, setJob] = useState<ExportJob | null>(null)

  const start = async (name: string, format: ExportFormat) => {
    const res = await fetch(`/export/${projectId}/${encodeURIComponent(name)}?format=${format}`, { method: "POST" }).then((r) => r.json())
    setJob(res)
    poll(res.id)
  }

  const poll = async (id: string) => {
    while (true) {
      const j: ExportJob = await fetch(`/export/${id}`).then((r) => r.json())
      setJob(j)
      if (j.status === "done") {
        // 下发下载
        location.assign(`/export/${id}/file`)
        break
      }
      if (j.status === "error") break
      await new Promise((r) => setTimeout(r, 500))
    }
  }

  return { job, start }
}
```

### 3.7 `ArtifactPanel.tsx` 接管按钮

把原本的占位按钮改为：

```tsx
const { job, start } = useExportJob(projectId)
const busy = job && job.status === "running" && job.artifactName === active

// ... 在底部按钮区：
<button disabled={!!busy} onClick={() => start(active, "docx")}
  className="px-2 py-1 text-xs rounded border hover:bg-gray-50 disabled:text-gray-300">
  {busy && job!.format === "docx" ? `导出中 ${job!.progress}%` : "导出 .docx"}
</button>
<button disabled={!!busy} onClick={() => start(active, "pdf")}
  className="px-2 py-1 text-xs rounded border hover:bg-gray-50 disabled:text-gray-300">
  {busy && job!.format === "pdf" ? `导出中 ${job!.progress}%` : "导出 .pdf"}
</button>
<button disabled={!!busy} onClick={() => start(active, "xlsx")}
  className="px-2 py-1 text-xs rounded border hover:bg-gray-50 disabled:text-gray-300">
  {busy && job!.format === "xlsx" ? `导出中 ${job!.progress}%` : "导出 .xlsx"}
</button>
```

## 四、依赖安装

```bash
cd apps/gateway
pnpm add marked docx puppeteer exceljs
pnpm add -D @types/marked
```

⚠️ puppeteer 首次安装会下载 Chromium ~280MB。如果安装超时，设 `PUPPETEER_DOWNLOAD_HOST=https://npmmirror.com/mirrors` 走镜像。

## 五、提交顺序

```bash
git checkout -b feat/day3-export-trio

# 1. 依赖
git add apps/gateway/package.json apps/gateway/pnpm-lock.yaml
git commit -m "chore: add marked/docx/puppeteer/exceljs"

# 2. 后端 转换实现
git add apps/gateway/src/services/{md2docx,md2pdf,table2xlsx,exportService}.ts
git commit -m "feat(export): add md→docx, md→pdf, table→xlsx services"

# 3. REST routes
git add apps/gateway/src/routes/export.ts apps/gateway/src/index.ts
git commit -m "feat(export): add /export REST routes"

# 4. 前端 hook + ArtifactPanel
git add apps/web/src/hooks/useExportJob.ts apps/web/src/components/ArtifactPanel.tsx apps/web/src/lib/types.ts
git commit -m "feat(web): wire export buttons in ArtifactPanel"

git push -u origin feat/day3-export-trio
```

## 六、验收清单

- [ ]  进一个有 PRD 的 project，点 “导出 .docx” → 进度从 10% 走到 100% → 浏览器下载 `prd.docx`，Word 能打开，标题/列表/表格都在
- [ ]  点 “导出 .pdf” → 下载 `prd.pdf`，中文不乱码，表格边框正常
- [ ]  点 “导出 .xlsx” → 下载 `prd.xlsx`，每个 md 表为一个 sheet，sheet 名 = 上一个标题
- [ ]  连点两次导出，不会互相覆盖（jobId 不同）
- [ ]  state/projects/<id>/exports/ 里文件正常生成
- [ ]  人意造一个不存在的 artifact 调用 → job 的 status 变 “error”，前端不崩

## 七、跨天依赖

Day 4-6 的 review/dev artifact 也会重复用这套导出：

- Day 4 设计文档：docx + pdf
- Day 5 代码 README：pdf
- Day 6 审查报告：docx + pdf + xlsx（bug 表）

本包不限制 artifact 名，任何 .md 都可导出。