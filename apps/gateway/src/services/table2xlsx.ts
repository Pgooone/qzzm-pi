import ExcelJS from "exceljs"
import { marked, type Tokens } from "marked"

/** 从 md 中提取所有表格，每个表为一个 sheet。sheet 名从表格前紧邻的 heading 取 */
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
