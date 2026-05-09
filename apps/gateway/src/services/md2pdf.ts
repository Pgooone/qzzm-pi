import { writeFile } from "node:fs/promises"
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
