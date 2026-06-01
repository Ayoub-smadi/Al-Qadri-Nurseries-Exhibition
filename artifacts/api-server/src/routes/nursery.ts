import { Router, type IRouter, type Request, type Response } from "express";
import pg from "pg";
import crypto from "crypto";
import { logger } from "../lib/logger";

const { Pool } = pg;

const DB_URL = process.env.DATABASE_URL;

if (!DB_URL) {
  throw new Error("DATABASE_URL must be set. Did you forget to provision a database?");
}

const pool = new Pool({
  connectionString: DB_URL,
});

const dbReady: Promise<void> = (async () => {
  try {
    const client = await pool.connect();
    try {
      await client.query(`CREATE TABLE IF NOT EXISTS site_config (id TEXT PRIMARY KEY DEFAULT 'main', data JSONB NOT NULL, updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL)`);
      await client.query(`CREATE TABLE IF NOT EXISTS admins (username TEXT PRIMARY KEY, password_hash TEXT NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL)`);
      await client.query(`CREATE TABLE IF NOT EXISTS quote_requests (id TEXT PRIMARY KEY, customer_name TEXT NOT NULL, phone TEXT NOT NULL DEFAULT '', items JSONB NOT NULL DEFAULT '[]', notes TEXT NOT NULL DEFAULT '', discount NUMERIC NOT NULL DEFAULT 0, tax NUMERIC NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'pending', created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL)`);
      await client.query(`CREATE TABLE IF NOT EXISTS images (id TEXT PRIMARY KEY, data TEXT NOT NULL, mime_type TEXT NOT NULL DEFAULT 'image/jpeg', created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL)`);
      await client.query(`CREATE TABLE IF NOT EXISTS invoices (id TEXT PRIMARY KEY, number TEXT NOT NULL, customer_name TEXT NOT NULL DEFAULT '', date TEXT NOT NULL DEFAULT '', items JSONB NOT NULL DEFAULT '[]', notes TEXT NOT NULL DEFAULT '', created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL)`);
      await client.query(`ALTER TABLE quote_requests ADD COLUMN IF NOT EXISTS shipping_destination TEXT NOT NULL DEFAULT ''`);
      await client.query(`ALTER TABLE quote_requests ADD COLUMN IF NOT EXISTS shipping_fee NUMERIC NOT NULL DEFAULT 0`);
      await client.query(`ALTER TABLE quote_requests ADD COLUMN IF NOT EXISTS shipping_method TEXT NOT NULL DEFAULT ''`);
      await client.query(`ALTER TABLE quote_requests ADD COLUMN IF NOT EXISTS shipping_address TEXT NOT NULL DEFAULT ''`);
      await client.query(`ALTER TABLE quote_requests ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ`);
      await client.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'receivable'`);
    } catch (e) {
      console.error("DB init error:", (e as Error).message);
    } finally {
      client.release();
    }
  } catch (e) {
    console.error("DB connect error:", (e as Error).message);
  }
})();

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
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

router.get("/admin/needs-setup", async (_req, res) => {
  try {
    const rows = await pool.query(`SELECT COUNT(*) AS c FROM admins`);
    res.json({ needsSetup: parseInt(rows.rows[0].c, 10) === 0 });
  } catch {
    res.status(500).json({ error: "Database error" });
  }
});

router.post("/admin/setup", async (req, res) => {
  const { username, password, secret } = req.body as { username?: string; password?: string; secret?: string };
  if (!username || !password) {
    res.status(400).json({ error: "Missing fields" });
    return;
  }
  try {
    const countRows = await pool.query(`SELECT COUNT(*) AS c FROM admins`);
    const isEmpty = parseInt(countRows.rows[0].c, 10) === 0;
    if (!isEmpty) {
      const setupSecret = process.env.ADMIN_SETUP_SECRET;
      if (!setupSecret || !secret || secret !== setupSecret) {
        res.status(403).json({ error: "Forbidden" });
        return;
      }
    }
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
    const rows = await pool.query(`SELECT data, updated_at FROM site_config WHERE id = 'main'`);
    if (rows.rows.length === 0) { res.json({ data: null }); return; }
    const { data, updated_at } = rows.rows[0] as { data: unknown; updated_at: string };
    const etag = `"${Buffer.from(updated_at ?? '').toString('base64').slice(0, 16)}"`;
    res.setHeader('Cache-Control', 'public, max-age=30, stale-while-revalidate=300');
    res.setHeader('ETag', etag);
    if (_req.headers['if-none-match'] === etag) { res.status(304).end(); return; }
    res.json({ data });
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
  const { customerName, phone, items, notes, shippingMethod, shippingAddress, shippingFee } = req.body as {
    customerName?: string; phone?: string; items?: unknown[]; notes?: string; shippingMethod?: string; shippingAddress?: string; shippingFee?: number;
  };
  logger.info({ customerName, shippingMethod, shippingAddress: shippingAddress ?? '' }, '[NEW QUOTE] received');
  if (!customerName || !Array.isArray(items) || items.length === 0) {
    logger.warn({ customerName, itemsType: typeof items }, '[NEW QUOTE] rejected — missing fields');
    res.status(400).json({ error: "Missing required fields" }); return;
  }
  if (shippingMethod !== 'pickup' && shippingMethod !== 'delivery') {
    logger.warn({ shippingMethod }, '[NEW QUOTE] rejected — invalid shipping method');
    res.status(400).json({ error: "يجب اختيار طريقة التوصيل: استلام من المشتل أو توصيل" }); return;
  }
  const id = `q-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  try {
    await pool.query(
      `INSERT INTO quote_requests (id, customer_name, phone, items, notes, shipping_method, shipping_address, shipping_fee)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [id, customerName, phone ?? '', JSON.stringify(items), notes ?? '', shippingMethod, shippingAddress ?? '', shippingFee ?? 0]
    );
    logger.info({ id, shippingMethod }, '[NEW QUOTE] saved successfully');
    res.json({ id });
  } catch (err) {
    logger.error({ err }, '[NEW QUOTE] DB error');
    res.status(500).json({ error: "Failed to save quote" });
  }
});

router.get("/quotes", async (req, res) => {
  if (!requireSession(req, res)) return;
  const trash = req.query.trash === '1';
  try {
    const result = await pool.query(
      trash
        ? `SELECT * FROM quote_requests WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC`
        : `SELECT * FROM quote_requests WHERE deleted_at IS NULL ORDER BY created_at DESC`
    );
    res.json({ quotes: result.rows });
  } catch { res.status(500).json({ error: "Failed to load quotes" }); }
});

router.put("/quotes/:id", async (req, res) => {
  if (!requireSession(req, res)) return;
  const { id } = req.params;
  const { items, discount, tax, status, notes, shippingFee, shippingMethod, shippingAddress } = req.body as {
    items?: unknown; discount?: number; tax?: number; status?: string; notes?: string; shippingFee?: number; shippingMethod?: string; shippingAddress?: string;
  };
  try {
    await pool.query(
      `UPDATE quote_requests SET items = $1, discount = $2, tax = $3, status = $4, notes = COALESCE($5, notes), shipping_fee = $6,
       shipping_method = COALESCE($7, shipping_method), shipping_address = COALESCE($8, shipping_address) WHERE id = $9`,
      [JSON.stringify(items ?? []), discount ?? 0, tax ?? 0, status ?? 'priced', notes ?? null, shippingFee ?? 0,
       shippingMethod ?? null, shippingAddress ?? null, id]
    );
    res.json({ ok: true });
  } catch { res.status(500).json({ error: "Failed to update quote" }); }
});

/* Soft-delete a quote (move to trash) */
router.delete("/quotes/:id", async (req, res) => {
  if (!requireSession(req, res)) return;
  const { id } = req.params;
  try {
    await pool.query(`UPDATE quote_requests SET deleted_at = NOW() WHERE id = $1`, [id]);
    res.json({ ok: true });
  } catch { res.status(500).json({ error: "Failed to delete quote" }); }
});

/* Restore a quote from trash */
router.post("/quotes/:id/restore", async (req, res) => {
  if (!requireSession(req, res)) return;
  const { id } = req.params;
  try {
    await pool.query(`UPDATE quote_requests SET deleted_at = NULL WHERE id = $1`, [id]);
    res.json({ ok: true });
  } catch { res.status(500).json({ error: "Failed to restore quote" }); }
});

/* Permanently delete a quote */
router.delete("/quotes/:id/permanent", async (req, res) => {
  if (!requireSession(req, res)) return;
  const { id } = req.params;
  try {
    await pool.query(`DELETE FROM quote_requests WHERE id = $1`, [id]);
    res.json({ ok: true });
  } catch { res.status(500).json({ error: "Failed to permanently delete quote" }); }
});

/* ── Invoices ──────────────────────────────────────────── */

router.get("/invoices", async (req, res) => {
  if (!requireSession(req, res)) return;
  try {
    await dbReady;
    const result = await pool.query(`SELECT * FROM invoices ORDER BY created_at DESC`);
    res.json({ invoices: result.rows });
  } catch (e) { res.status(500).json({ error: "Failed to load invoices", detail: (e as Error).message }); }
});

router.post("/invoices", async (req, res) => {
  if (!requireSession(req, res)) return;
  const { customerName, date, items, notes, status } = req.body as {
    customerName?: string; date?: string; items?: unknown[]; notes?: string; status?: string;
  };
  if (!customerName || !Array.isArray(items)) {
    res.status(400).json({ error: "Missing required fields" }); return;
  }
  try {
    await dbReady;
    const countRow = await pool.query(`SELECT COALESCE(MAX(CAST(number AS INTEGER)) + 1, 1) AS next FROM invoices`);
    const nextNum = String(countRow.rows[0].next).padStart(6, '0');
    const id = `inv-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const invoiceStatus = status === 'paid' ? 'paid' : 'receivable';
    await pool.query(
      `INSERT INTO invoices (id, number, customer_name, date, items, notes, status) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [id, nextNum, customerName, date ?? new Date().toISOString().slice(0, 10), JSON.stringify(items), notes ?? '', invoiceStatus]
    );
    res.json({ id, number: nextNum });
  } catch (e) { res.status(500).json({ error: "Failed to save invoice", detail: (e as Error).message }); }
});

router.put("/invoices/:id/status", async (req, res) => {
  if (!requireSession(req, res)) return;
  const { id } = req.params;
  const { status } = req.body as { status?: string };
  if (status !== 'paid' && status !== 'receivable') {
    res.status(400).json({ error: "Invalid status" }); return;
  }
  try {
    await dbReady;
    await pool.query(`UPDATE invoices SET status = $1 WHERE id = $2`, [status, id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: "Failed to update status", detail: (e as Error).message }); }
});

router.delete("/invoices/:id", async (req, res) => {
  if (!requireSession(req, res)) return;
  const { id } = req.params;
  try {
    await dbReady;
    await pool.query(`DELETE FROM invoices WHERE id = $1`, [id]);
    res.json({ ok: true });
  } catch { res.status(500).json({ error: "Failed to delete invoice" }); }
});

router.post("/images/from-url", async (req, res) => {
  if (!requireSession(req, res)) return;
  const { url } = req.body as { url?: string };
  if (!url || !url.startsWith("http")) {
    res.status(400).json({ error: "رابط غير صالح — يجب أن يبدأ بـ http" });
    return;
  }
  const knownBadHosts = ["drive.google.com", "docs.google.com", "dropbox.com", "icloud.com", "onedrive.live.com"];
  try {
    const urlHost = new URL(url).hostname;
    if (knownBadHosts.some(h => urlHost.includes(h))) {
      res.status(400).json({
        error: "هذا الرابط لا يخدم الصورة مباشرة. استخدم رابطاً ينتهي بـ .jpg أو .png مثل: https://example.com/photo.jpg",
      });
      return;
    }
  } catch {
    res.status(400).json({ error: "رابط غير صالح" });
    return;
  }
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    let fetchResponse: Awaited<ReturnType<typeof fetch>>;
    try {
      fetchResponse = await fetch(url, {
        signal: controller.signal,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "image/*,*/*;q=0.8",
        },
      });
    } finally {
      clearTimeout(timeout);
    }
    if (!fetchResponse.ok) {
      res.status(400).json({ error: `تعذّر تنزيل الصورة (خطأ ${fetchResponse.status}) — تأكد أن الرابط عام وليس محمياً` });
      return;
    }
    const contentType = fetchResponse.headers.get("content-type") || "";
    if (!contentType.startsWith("image/")) {
      res.status(400).json({
        error: "الرابط لا يشير إلى صورة مباشرة. استخدم رابطاً ينتهي بـ .jpg أو .png",
      });
      return;
    }
    const buffer = await fetchResponse.arrayBuffer();
    if (buffer.byteLength > 20 * 1024 * 1024) {
      res.status(400).json({ error: "الصورة كبيرة جداً (أكثر من 20MB)" });
      return;
    }
    const base64 = Buffer.from(buffer).toString("base64");
    const mime = contentType.split(";")[0].trim();
    const id = `img-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    await pool.query(
      `INSERT INTO images (id, data, mime_type) VALUES ($1, $2, $3)`,
      [id, base64, mime]
    );
    res.json({ id, url: `/api/images/${id}` });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("abort") || msg.includes("timeout")) {
      res.status(400).json({ error: "انتهت مهلة التنزيل — تأكد أن الرابط سريع وعام" });
    } else {
      res.status(500).json({ error: "فشل تنزيل الصورة — تأكد أن الرابط صحيح وعام" });
    }
  }
});

router.post("/images", async (req, res) => {
  if (!requireSession(req, res)) return;
  const { data, mimeType } = req.body as { data?: string; mimeType?: string };
  if (!data) { res.status(400).json({ error: "Missing image data" }); return; }
  const id = `img-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const mime = mimeType ?? "image/jpeg";
  try {
    const raw = data.startsWith("data:") ? data.split(",")[1] : data;
    await pool.query(
      `INSERT INTO images (id, data, mime_type) VALUES ($1, $2, $3)`,
      [id, raw, mime]
    );
    res.json({ id, url: `/api/images/${id}` });
  } catch {
    res.status(500).json({ error: "Failed to save image" });
  }
});

router.get("/images/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      `SELECT data, mime_type FROM images WHERE id = $1`,
      [id]
    );
    if (result.rows.length === 0) { res.status(404).end(); return; }
    const { data, mime_type } = result.rows[0] as { data: string; mime_type: string };
    const buf = Buffer.from(data, "base64");
    res.setHeader("Content-Type", mime_type);
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.end(buf);
  } catch {
    res.status(500).end();
  }
});

router.delete("/images/:id", async (req, res) => {
  if (!requireSession(req, res)) return;
  const { id } = req.params;
  try {
    await pool.query(`DELETE FROM images WHERE id = $1`, [id]);
    res.json({ ok: true });
  } catch { res.status(500).json({ error: "Failed to delete image" }); }
});

export default router;
