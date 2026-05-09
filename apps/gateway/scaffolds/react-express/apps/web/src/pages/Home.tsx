import { useEffect, useState } from "react";

export default function Home() {
  const [data, setData] = useState<any>(null);
  useEffect(() => { fetch("/api/health").then(r => r.json()).then(setData); }, []);
  return (
    <div>
      <h1 style={{ fontSize: "2rem", fontWeight: 700 }}>__PROJECT_NAME__</h1>
      <p style={{ marginTop: "1rem", color: "#666" }}>API 状态: {data ? JSON.stringify(data) : "加载中..."}</p>
    </div>
  );
}
