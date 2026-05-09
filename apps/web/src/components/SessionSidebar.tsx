export function SessionSidebar({ projectId }: { projectId: string }) {
  return (
    <aside className="w-56 border-r bg-gray-50 flex flex-col">
      <div className="p-3 text-xs uppercase text-gray-500">会话历史</div>
      <div className="flex-1 overflow-auto px-2 space-y-1 text-sm">
        <div className="px-2 py-1.5 rounded bg-white border text-gray-800">📌 当前会话<div className="text-[11px] text-gray-500 mt-0.5">{projectId}</div></div>
        <div className="px-2 py-1 text-gray-400 text-xs">— 分支树将在 Day 2 接入 —</div>
      </div>
      <button className="m-2 px-3 py-1.5 text-sm rounded bg-blue-600 text-white hover:bg-blue-700">+ 新会话</button>
    </aside>
  )
}
