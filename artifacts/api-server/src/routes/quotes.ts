import { Router, type IRouter, type Request, type Response } from "express";
import { pool } from "@workspace/db";

const router: IRouter = Router();

pool.query(`
  CREATE TABLE IF NOT EXISTS quote_requests (
    id TEXT PRIMARY KEY,
    customer_name TEXT NOT NULL,
    phone TEXT NOT NULL DEFAULT '',
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    notes TEXT NOT NULL DEFAULT '',
    discount NUMERIC NOT NULL DEFAULT 0,
    tax NUMERIC NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
  )
`).catch(console.error);

function requireSession(req: Request, res: Response): boolean {
  const auth = req.headers["authorization"] ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) {
    res.status(403).json({ error: "Forbidden" });
    return false;
  }
  return true;
}

router.post("/quotes", async (req: Request, res: Response) => {
  const { customerName, phone, items, notes } = req.body as {
    customerName?: string; phone?: string; items?: unknown[]; notes?: string;
  };
  if (!customerName || !Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }
  const id = `q-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  try {
    await pool.query(
      `INSERT INTO quote_requests (id, customer_name, phone, items, notes) VALUES ($1, $2, $3, $4, $5)`,
      [id, customerName, phone ?? "", JSON.stringify(items), notes ?? ""]
    );
    res.json({ id });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to save quote" });
  }
});

router.get("/quotes", async (req: Request, res: Response) => {
  if (!requireSession(req, res)) return;
  try {
    const result = await pool.query(`SELECT * FROM quote_requests ORDER BY created_at DESC`);
    res.json({ quotes: result.rows });
  } catch {
    res.status(500).json({ error: "Failed to load quotes" });
  }
});

router.put("/quotes/:id", async (req: Request, res: Response) => {
  if (!requireSession(req, res)) return;
  const { id } = req.params;
  const { items, discount, tax, status } = req.body as {
    items?: unknown; discount?: number; tax?: number; status?: string;
  };
  try {
    await pool.query(
      `UPDATE quote_requests SET items = $1, discount = $2, tax = $3, status = $4 WHERE id = $5`,
      [JSON.stringify(items ?? []), discount ?? 0, tax ?? 0, status ?? "priced", id]
    );
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Failed to update quote" });
  }
});

router.delete("/quotes/:id", async (req: Request, res: Response) => {
  if (!requireSession(req, res)) return;
  const { id } = req.params;
  try {
    await pool.query(`DELETE FROM quote_requests WHERE id = $1`, [id]);
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Failed to delete quote" });
  }
});

export default router;
