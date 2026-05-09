import { useMemo } from "react"
import { ChatWindow } from "./components/ChatWindow"

export default function App() {
  const projectId = useMemo(() => {
    const k = "qzzm:projectId"
    let v = localStorage.getItem(k)
    if (!v) {
      v = `proj-${Math.random().toString(36).slice(2, 10)}`
      localStorage.setItem(k, v)
    }
    return v
  }, [])
  return <ChatWindow projectId={projectId} />
}
