import { writeFile } from "node:fs/promises"
import { marked, type Tokens } from "marked"
import { Document, Packer, Paragraph, HeadingLevel, TextRun, Table, TableRow, TableCell, WidthType } from "docx"

function tokensToParagraphs(tokens: Tokens.Token[]): (Paragraph | Table)[] {
  const out: (Paragraph | Table)[] = []
  for (const t of tokens) {
    if (t.type === "heading") {
      const level = Math.min((t as Tokens.Heading).depth, 6)
      const headingLevel = [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3, HeadingLevel.HEADING_4, HeadingLevel.HEADING_5, HeadingLevel.HEADING_6][level - 1]
      out.push(new Paragraph({ heading: headingLevel, children: [new TextRun((t as Tokens.Heading).text)] }))
    } else if (t.type === "paragraph") {
      out.push(new Paragraph({ children: [new TextRun((t as Tokens.Paragraph).text)] }))
    } else if (t.type === "list") {
      for (const item of (t as Tokens.List).items) {
        out.push(new Paragraph({ bullet: { level: 0 }, children: [new TextRun(item.text)] }))
      }
    } else if (t.type === "code") {
      out.push(new Paragraph({ children: [new TextRun({ text: (t as Tokens.Code).text, font: "Courier New", size: 20 })] }))
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
      out.push(new Paragraph({ indent: { left: 720 }, children: [new TextRun((t as Tokens.Blockquote).text || "")] }))
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
    sections: [{ children: tokensToParagraphs(tokens as Tokens.Token[]) }],
  })
  const buf = await Packer.toBuffer(doc)
  await writeFile(outFile, buf)
}
