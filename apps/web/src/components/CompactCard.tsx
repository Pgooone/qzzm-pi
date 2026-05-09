export function CompactCard({ status, summary }: { status: "running" | "done"; summary?: string }) {
  if (status === "running") {
    return (
      <div className="my-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded text-xs flex items-center gap-2">
        <span className="inline-block w-3 h-3 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
        压缩上下文中…
      </div>
    )
  }
  return (
    <div className="my-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded text-xs flex items-center gap-2">
      压缩完成。{summary && <span className="text-gray-500">{summary.slice(0, 80)}</span>}
    </div>
  )
}

export function AutoRetryCard({ reason, success }: { reason: string; success: boolean }) {
  return (
    <div className={`my-2 px-3 py-2 rounded text-xs flex items-center gap-2 ${success ? "bg-green-50 border border-green-200" : "bg-orange-50 border border-orange-200"}`}>
      {success ? "自动重试成功" : `自动重试中: ${reason}`}
    </div>
  )
}
