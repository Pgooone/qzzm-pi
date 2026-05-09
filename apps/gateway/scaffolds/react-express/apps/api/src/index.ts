import express from "express";
import cors from "cors";
import { z } from "zod";

const app = express();
app.use(cors());
app.use(express.json());

// 健康检查
app.get("/api/health", (_req, res) => { res.json({ ok: true, uptime: process.uptime() }); });

// 示例 CRUD - 列表
const items: Array<{ id: number; name: string }> = [
  { id: 1, name: "示例项目 1" }, { id: 2, name: "示例项目 2" },
];

app.get("/api/items", (_req, res) => { res.json(items); });

const createSchema = z.object({ name: z.string().min(1, "名称不能为空").max(200) });

app.post("/api/items", (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  const item = { id: Date.now(), name: parsed.data.name };
  items.push(item);
  res.status(201).json(item);
});

// 错误处理
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "服务器内部错误" });
});

const port = process.env.PORT || 3001;
app.listen(port, () => { console.log(`API server running on http://localhost:${port}`); });
