import { Router, type IRouter } from "express";
import pg from "pg";
import crypto from "crypto";

const { Pool } = pg;

const DB_URL = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL;

if (!DB_URL) {
  throw new Error("NEON_DATABASE_URL or DATABASE_URL must be set.");
}

const pool = new Pool({
  connectionString: DB_URL,
  ssl: DB_URL.includes('neon.tech') ? { rejectUnauthorized: false } : undefined,
});

pool.query(`
  CREATE TABLE IF NOT EXISTS site_config (
    id TEXT PRIMARY KEY DEFAULT 'main',
    data JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
  );
  CREATE TABLE IF NOT EXISTS admins (
    username TEXT PRIMARY KEY,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
  );
  CREATE TABLE IF NOT EXISTS quote_requests (
    id TEXT PRIMARY KEY,
    customer_name TEXT NOT NULL,
    phone TEXT NOT NULL DEFAULT '',
    items JSONB NOT NULL DEFAULT '[]',
    notes TEXT NOT NULL DEFAULT '',
    discount NUMERIC NOT NULL DEFAULT 0,
    tax NUMERIC NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
  );
`).catch((e: Error) => console.error("DB init error:", e.message));

const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const TOKEN_SECRET = crypto.createHash("sha256").update(DB_URL).digest();

function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password).digest("hex");
}

function createToken(): string {
  const expiry = Date.now() + SESSION_TTL_MS;
  const payload = Buffer.from(JSON.stringify({ expiry })).toString("base64url");
  const sig = crypto.createHmac("sha256", TOKEN_SECRET).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

function verifyToken(token: string): boolean {
  const dot = token.indexOf(".");
  if (dot === -1) return false;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = crypto.createHmac("sha256", TOKEN_SECRET).update(payload).digest("base64url");
  if (sig !== expected) return false;
  try {
    const { expiry } = JSON.parse(Buffer.from(payload, "base64url").toString());
    return Date.now() < expiry;
  } catch { return false; }
}

import type { Request, Response } from "express";

function requireSession(req: Request, res: Response): boolean {
  const auth = (req.headers["authorization"] ?? "") as string;
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!verifyToken(token)) {
    res.status(403).json({ error: "Forbidden" });
    return false;
  }
  return true;
}

const router: IRouter = Router();

router.post("/admin/login", async (req, res) => {
  const { username, password } = req.body as { username?: string; password?: string };
  if (!username || !password) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }
  try {
    const rows = await pool.query(
      `SELECT password_hash FROM admins WHERE username = $1`,
      [username]
    );
    if (rows.rows.length === 0 || rows.rows[0].password_hash !== hashPassword(password)) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }
    const token = createToken();
    res.json({ token });
  } catch {
    res.status(500).json({ error: "Database error" });
  }
});

router.post("/admin/setup", async (req, res) => {
  const { username, password, secret } = req.body as { username?: string; password?: string; secret?: string };
  const setupSecret = process.env.ADMIN_SETUP_SECRET;
  if (!setupSecret || !secret || secret !== setupSecret) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  if (!username || !password) {
    res.status(400).json({ error: "Missing fields" });
    return;
  }
  try {
    await pool.query(
      `INSERT INTO admins (username, password_hash) VALUES ($1, $2) ON CONFLICT (username) DO UPDATE SET password_hash = $2`,
      [username, hashPassword(password)]
    );
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Database error" });
  }
});

router.get("/admin/verify", (req, res) => {
  if (!requireSession(req, res)) return;
  res.json({ ok: true });
});

router.get("/site-data", async (_req, res) => {
  try {
    const rows = await pool.query(`SELECT data FROM site_config WHERE id = 'main'`);
    if (rows.rows.length === 0) { res.json({ data: null }); return; }
    res.json({ data: rows.rows[0].data });
  } catch {
    res.status(500).json({ error: "Failed to load site data" });
  }
});

router.put("/site-data", async (req, res) => {
  if (!requireSession(req, res)) return;
  const { data } = req.body as { data?: unknown };
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    res.status(400).json({ error: "Invalid data" });
    return;
  }
  try {
    await pool.query(
      `INSERT INTO site_config (id, data) VALUES ('main', $1)
       ON CONFLICT (id) DO UPDATE SET data = $1, updated_at = NOW()`,
      [JSON.stringify(data)]
    );
    res.json({ data });
  } catch {
    res.status(500).json({ error: "Failed to save site data" });
  }
});

router.post("/quotes", async (req, res) => {
  const { customerName, phone, items, notes } = req.body as {
    customerName?: string; phone?: string; items?: unknown[]; notes?: string;
  };
  if (!customerName || !Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: "Missing required fields" }); return;
  }
  const id = `q-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  try {
    await pool.query(
      `INSERT INTO quote_requests (id, customer_name, phone, items, notes)
       VALUES ($1, $2, $3, $4, $5)`,
      [id, customerName, phone ?? '', JSON.stringify(items), notes ?? '']
    );
    res.json({ id });
  } catch { res.status(500).json({ error: "Failed to save quote" }); }
});

router.get("/quotes", async (req, res) => {
  if (!requireSession(req, res)) return;
  try {
    const result = await pool.query(`SELECT * FROM quote_requests ORDER BY created_at DESC`);
    res.json({ quotes: result.rows });
  } catch { res.status(500).json({ error: "Failed to load quotes" }); }
});

router.put("/quotes/:id", async (req, res) => {
  if (!requireSession(req, res)) return;
  const { id } = req.params;
  const { items, discount, tax, status } = req.body as {
    items?: unknown; discount?: number; tax?: number; status?: string;
  };
  try {
    await pool.query(
      `UPDATE quote_requests SET items = $1, discount = $2, tax = $3, status = $4 WHERE id = $5`,
      [JSON.stringify(items ?? []), discount ?? 0, tax ?? 0, status ?? 'priced', id]
    );
    res.json({ ok: true });
  } catch { res.status(500).json({ error: "Failed to update quote" }); }
});

router.delete("/quotes/:id", async (req, res) => {
  if (!requireSession(req, res)) return;
  const { id } = req.params;
  try {
    await pool.query(`DELETE FROM quote_requests WHERE id = $1`, [id]);
    res.json({ ok: true });
  } catch { res.status(500).json({ error: "Failed to delete quote" }); }
});

export default router;
