import { Router, type IRouter, type Request, type Response } from "express";
import pg from "pg";
import crypto from "crypto";
import { get, put } from "@vercel/blob";
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
      await client.query(`ALTER TABLE images ADD COLUMN IF NOT EXISTS blob_url TEXT`);
      await client.query(`ALTER TABLE images ADD COLUMN IF NOT EXISTS blob_pathname TEXT`);
      await client.query(`ALTER TABLE images ADD COLUMN IF NOT EXISTS sha256 TEXT`);
      await client.query(`ALTER TABLE images ADD COLUMN IF NOT EXISTS size_bytes INTEGER`);
      await client.query(`CREATE INDEX IF NOT EXISTS images_sha256_idx ON images (sha256)`);
      await client.query(`CREATE TABLE IF NOT EXISTS invoices (id TEXT PRIMARY KEY, number TEXT NOT NULL, customer_name TEXT NOT NULL DEFAULT '', date TEXT NOT NULL DEFAULT '', items JSONB NOT NULL DEFAULT '[]', notes TEXT NOT NULL DEFAULT '', created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL)`);
      await client.query(`ALTER TABLE quote_requests ADD COLUMN IF NOT EXISTS shipping_destination TEXT NOT NULL DEFAULT ''`);
      await client.query(`ALTER TABLE quote_requests ADD COLUMN IF NOT EXISTS shipping_fee NUMERIC NOT NULL DEFAULT 0`);
      await client.query(`ALTER TABLE quote_requests ADD COLUMN IF NOT EXISTS shipping_method TEXT NOT NULL DEFAULT ''`);
      await client.query(`ALTER TABLE quote_requests ADD COLUMN IF NOT EXISTS shipping_address TEXT NOT NULL DEFAULT ''`);
      await client.query(`ALTER TABLE quote_requests ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ`);
      await client.query(`ALTER TABLE quote_requests ADD COLUMN IF NOT EXISTS planting_fee NUMERIC NOT NULL DEFAULT 0`);
      await client.query(`ALTER TABLE quote_requests ADD COLUMN IF NOT EXISTS order_type TEXT NOT NULL DEFAULT 'plant_quote'`);
      await client.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'receivable'`);
      await client.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS discount NUMERIC NOT NULL DEFAULT 0`);
      await client.query(`CREATE TABLE IF NOT EXISTS receipts (id TEXT PRIMARY KEY, number TEXT NOT NULL, received_from TEXT NOT NULL DEFAULT '', amount NUMERIC NOT NULL DEFAULT 0, amount_text TEXT NOT NULL DEFAULT '', description TEXT NOT NULL DEFAULT '', payment_method TEXT NOT NULL DEFAULT 'cash', date TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL DEFAULT '', created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL)`);
      await client.query(`CREATE TABLE IF NOT EXISTS disbursements (id TEXT PRIMARY KEY, number TEXT NOT NULL, paid_to TEXT NOT NULL DEFAULT '', amount NUMERIC NOT NULL DEFAULT 0, amount_text TEXT NOT NULL DEFAULT '', description TEXT NOT NULL DEFAULT '', payment_method TEXT NOT NULL DEFAULT 'cash', date TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL DEFAULT '', created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL)`);
      await client.query(`ALTER TABLE receipts ADD COLUMN IF NOT EXISTS name_prefix TEXT NOT NULL DEFAULT 'السيد'`);
      await client.query(`ALTER TABLE disbursements ADD COLUMN IF NOT EXISTS name_prefix TEXT NOT NULL DEFAULT 'السيد'`);
      await client.query(`CREATE TABLE IF NOT EXISTS qadri_old_quotations (id TEXT PRIMARY KEY, data JSONB NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL, updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL)`);
      await client.query(`CREATE TABLE IF NOT EXISTS official_documents (id TEXT PRIMARY KEY, data JSONB NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL, updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL)`);
      await client.query(`ALTER TABLE official_documents ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ`);
      await client.query(`CREATE TABLE IF NOT EXISTS no_header_quotations (id TEXT PRIMARY KEY, data JSONB NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL, updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL)`);
      await client.query(`CREATE TABLE IF NOT EXISTS export_invoices (id TEXT PRIMARY KEY, data JSONB NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL, updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL)`);
      await client.query(`CREATE TABLE IF NOT EXISTS admin_quotations (id TEXT PRIMARY KEY, quotation_number TEXT NOT NULL, customer_name TEXT NOT NULL, date TEXT NOT NULL, notes TEXT NOT NULL DEFAULT '', grand_total NUMERIC NOT NULL DEFAULT 0, discount_value NUMERIC NOT NULL DEFAULT 0, tax_rate NUMERIC NOT NULL DEFAULT 0, details JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL, deleted_at TIMESTAMPTZ)`);
      await client.query(`CREATE TABLE IF NOT EXISTS admin_quotation_items (id TEXT PRIMARY KEY, quotation_id TEXT NOT NULL REFERENCES admin_quotations(id) ON DELETE CASCADE, name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', category TEXT NOT NULL DEFAULT '', quantity NUMERIC NOT NULL DEFAULT 1, unit TEXT NOT NULL DEFAULT 'وحدة', price NUMERIC NOT NULL DEFAULT 0, total NUMERIC NOT NULL DEFAULT 0, image_url TEXT, sort_order INTEGER NOT NULL DEFAULT 0)`);
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

function containsEmbeddedImageData(value: unknown): boolean {
  if (typeof value === "string") return /^data:image\//i.test(value);
  if (Array.isArray(value)) return value.some(containsEmbeddedImageData);
  if (value && typeof value === "object") return Object.values(value).some(containsEmbeddedImageData);
  return false;
}

function rejectEmbeddedImageData(res: Response, value: unknown): boolean {
  if (!containsEmbeddedImageData(value)) return false;
  res.status(422).json({ error: "Images must be uploaded to Blob storage before saving the record" });
  return true;
}

async function normalizeStoredBlobReferences(value: unknown): Promise<unknown> {
  const result = await pool.query(
    `SELECT id, blob_url FROM images WHERE blob_url IS NOT NULL AND blob_url <> ''`,
  );
  const byUrl = new Map<string, string>(
    (result.rows as { id: string; blob_url: string }[]).map(row => [
      row.blob_url,
      `/api/images/${encodeURIComponent(row.id)}`,
    ]),
  );
  const rewrite = (item: unknown): unknown => {
    if (typeof item === "string") {
      const knownReference = byUrl.get(item);
      if (knownReference) return knownReference;
      try {
        const url = new URL(item);
        if (url.hostname.includes(".private.blob.vercel-storage.com")) {
          const match = url.pathname.match(/\/([a-f0-9]{64})\.[a-z0-9]+$/i);
          if (match) return `/api/images/img-${match[1].slice(0, 24)}`;
        }
      } catch {
        // Keep non-URL strings unchanged.
      }
      return item;
    }
    if (Array.isArray(item)) return item.map(rewrite);
    if (item && typeof item === "object") {
      return Object.fromEntries(Object.entries(item).map(([key, child]) => [key, rewrite(child)]));
    }
    return item;
  };
  return rewrite(value);
}

/* ── SSE: broadcast new quotes to connected admin clients ───── */
const sseClients = new Set<Response>();

function broadcastNewQuote(quote: Record<string, unknown>) {
  const data = `data: ${JSON.stringify(quote)}\n\n`;
  for (const client of sseClients) {
    try { client.write(data); } catch { sseClients.delete(client); }
  }
}

const router: IRouter = Router();

router.post("/admin/login", async (req, res) => {
  await dbReady;
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
  await dbReady;
  try {
    const rows = await pool.query(`SELECT COUNT(*) AS c FROM admins`);
    res.json({ needsSetup: parseInt(rows.rows[0].c, 10) === 0 });
  } catch {
    res.status(500).json({ error: "Database error" });
  }
});

router.post("/admin/setup", async (req, res) => {
  await dbReady;
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
  await dbReady;
  try {
    const rows = await pool.query(`SELECT data, updated_at FROM site_config WHERE id = 'main'`);
    res.setHeader("Cache-Control", "no-store");
    if (rows.rows.length === 0) { res.json({ data: null }); return; }
    const { data: rawData, updated_at } = rows.rows[0] as { data: unknown; updated_at: string };
    const data = await normalizeStoredBlobReferences(rawData);
    const etag = `"${Buffer.from(updated_at ?? '').toString('base64').slice(0, 16)}"`;
    res.setHeader('ETag', etag);
    if (_req.headers['if-none-match'] === etag) { res.status(304).end(); return; }
    res.json({ data });
  } catch {
    res.status(500).json({ error: "Failed to load site data" });
  }
});

router.put("/site-data", async (req, res) => {
  await dbReady;
  if (!requireSession(req, res)) return;
  const { data } = req.body as { data?: unknown };
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    res.status(400).json({ error: "Invalid data" });
    return;
  }
  if (rejectEmbeddedImageData(res, data)) return;
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

/* SSE stream endpoint — admin clients connect here for real-time quote events.
   EventSource cannot set headers so we accept the token as a query param too. */
router.get("/quotes/stream", (req, res) => {
  // Accept token from Authorization header OR ?token= query param (EventSource limitation)
  const auth = (req.headers["authorization"] ?? "") as string;
  const headerToken = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const queryToken = typeof req.query.token === "string" ? req.query.token : "";
  const token = headerToken || queryToken;
  if (!verifyToken(token)) { res.status(403).json({ error: "Forbidden" }); return; }
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();
  res.write(": connected\n\n");
  sseClients.add(res);
  const keepAlive = setInterval(() => { try { res.write(": ping\n\n"); } catch { /* ignore */ } }, 20_000);
  req.on("close", () => { clearInterval(keepAlive); sseClients.delete(res); });
});

router.post("/quotes", async (req, res) => {
  await dbReady;
  const { customerName, phone, items, notes, shippingMethod, shippingAddress, shippingFee, orderType } = req.body as {
    customerName?: string; phone?: string; items?: unknown[]; notes?: string; shippingMethod?: string; shippingAddress?: string; shippingFee?: number; orderType?: string;
  };
  logger.info({ customerName, shippingMethod, shippingAddress: shippingAddress ?? '' }, '[NEW QUOTE] received');
  if (!customerName || !Array.isArray(items) || items.length === 0) {
    logger.warn({ customerName, itemsType: typeof items }, '[NEW QUOTE] rejected — missing fields');
    res.status(400).json({ error: "Missing required fields" }); return;
  }
  const validMethods = ['pickup', 'delivery', 'plant_only', 'delivery_plant'];
  if (!shippingMethod || !validMethods.includes(shippingMethod)) {
    logger.warn({ shippingMethod }, '[NEW QUOTE] rejected — invalid shipping method');
    res.status(400).json({ error: "يجب اختيار طريقة التوصيل" }); return;
  }
  const id = `q-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  try {
    await pool.query(
      `INSERT INTO quote_requests (id, customer_name, phone, items, notes, shipping_method, shipping_address, shipping_fee, order_type)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [id, customerName, phone ?? '', JSON.stringify(items), notes ?? '', shippingMethod, shippingAddress ?? '', shippingFee ?? 0, orderType === 'agri_store' ? 'agri_store' : 'plant_quote']
    );
    logger.info({ id, shippingMethod }, '[NEW QUOTE] saved successfully');
    // Broadcast instantly to all connected admin SSE clients
    broadcastNewQuote({ id, customerName, phone: phone ?? '', itemsCount: (items as unknown[]).length, shippingMethod, createdAt: new Date().toISOString() });
    res.json({ id });
  } catch (err) {
    logger.error({ err }, '[NEW QUOTE] DB error');
    res.status(500).json({ error: "Failed to save quote" });
  }
});

router.get("/quotes", async (req, res) => {
  if (!requireSession(req, res)) return;
  const trash = req.query.trash === '1';
  const orderType = req.query.orderType === 'agri_store' ? 'agri_store' : 'plant_quote';
  try {
    const typeClause = orderType ? ` AND order_type = '${orderType}'` : '';
    const result = await pool.query(
      trash
        ? `SELECT * FROM quote_requests WHERE deleted_at IS NOT NULL${typeClause} ORDER BY deleted_at DESC`
        : `SELECT * FROM quote_requests WHERE deleted_at IS NULL${typeClause} ORDER BY created_at DESC`
    );
    res.json({ quotes: result.rows });
  } catch { res.status(500).json({ error: "Failed to load quotes" }); }
});

router.put("/quotes/:id", async (req, res) => {
  if (!requireSession(req, res)) return;
  const { id } = req.params;
  const { items, discount, tax, status, notes, shippingFee, plantingFee, shippingMethod, shippingAddress } = req.body as {
    items?: unknown; discount?: number; tax?: number; status?: string; notes?: string; shippingFee?: number; plantingFee?: number; shippingMethod?: string; shippingAddress?: string;
  };
  try {
    await pool.query(
      `UPDATE quote_requests SET items = $1, discount = $2, tax = $3, status = $4, notes = COALESCE($5, notes), shipping_fee = $6,
       shipping_method = COALESCE($7, shipping_method), shipping_address = COALESCE($8, shipping_address), planting_fee = $9 WHERE id = $10`,
      [JSON.stringify(items ?? []), discount ?? 0, tax ?? 0, status ?? 'priced', notes ?? null, shippingFee ?? 0,
       shippingMethod ?? null, shippingAddress ?? null, plantingFee ?? 0, id]
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
  const { customerName, date, items, notes, status, discount, invoiceNumber } = req.body as {
    customerName?: string; date?: string; items?: unknown[]; notes?: string; status?: string; discount?: number; invoiceNumber?: string;
  };
  if (!customerName || !Array.isArray(items)) {
    res.status(400).json({ error: "Missing required fields" }); return;
  }
  try {
    await dbReady;
    let finalNum = invoiceNumber?.trim();
    if (!finalNum) {
      const countRow = await pool.query(`SELECT COALESCE(MAX(CAST(number AS INTEGER)) + 1, 1) AS next FROM invoices`);
      finalNum = String(countRow.rows[0].next).padStart(6, '0');
    }
    const id = `inv-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const invoiceStatus = status === 'paid' ? 'paid' : status === 'online' ? 'online' : 'receivable';
    await pool.query(
      `INSERT INTO invoices (id, number, customer_name, date, items, notes, status, discount) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [id, finalNum, customerName, date ?? new Date().toISOString().slice(0, 10), JSON.stringify(items), notes ?? '', invoiceStatus, discount ?? 0]
    );
    res.json({ id, number: finalNum });
  } catch (e) { res.status(500).json({ error: "Failed to save invoice", detail: (e as Error).message }); }
});

router.put("/invoices/:id", async (req, res) => {
  if (!requireSession(req, res)) return;
  const { id } = req.params;
  const { number, discount, customerName, date, items, notes, status } = req.body as {
    number?: string; discount?: number; customerName?: string; date?: string; items?: unknown[]; notes?: string; status?: string;
  };
  try {
    await dbReady;
    if (items !== undefined) {
      const invoiceStatus = status === 'paid' ? 'paid' : status === 'online' ? 'online' : 'receivable';
      await pool.query(
        `UPDATE invoices SET number = COALESCE($1, number), discount = $2, customer_name = $3, date = $4, items = $5, notes = $6, status = $7 WHERE id = $8`,
        [number?.trim() || null, discount ?? 0, customerName, date, JSON.stringify(items), notes ?? '', invoiceStatus, id]
      );
    } else {
      await pool.query(`UPDATE invoices SET number = COALESCE($1, number), discount = $2 WHERE id = $3`, [number?.trim() || null, discount ?? 0, id]);
    }
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: "Failed to update invoice", detail: (e as Error).message }); }
});

router.put("/invoices/:id/status", async (req, res) => {
  if (!requireSession(req, res)) return;
  const { id } = req.params;
  const { status } = req.body as { status?: string };
  if (status !== 'paid' && status !== 'receivable' && status !== 'online') {
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

/* ── Receipts (سندات القبض) ─────────────────────────────── */

router.get("/receipts", async (req, res) => {
  if (!requireSession(req, res)) return;
  try {
    await dbReady;
    const result = await pool.query(`SELECT * FROM receipts ORDER BY created_at DESC`);
    res.json({ receipts: result.rows });
  } catch (e) { res.status(500).json({ error: "Failed to load receipts", detail: (e as Error).message }); }
});

router.post("/receipts", async (req, res) => {
  if (!requireSession(req, res)) return;
  const { receivedFrom, namePrefix, amount, amountText, description, paymentMethod, date, notes, receiptNumber } = req.body as {
    receivedFrom?: string; namePrefix?: string; amount?: number; amountText?: string; description?: string; paymentMethod?: string; date?: string; notes?: string; receiptNumber?: string;
  };
  if (!receivedFrom) { res.status(400).json({ error: "Missing receivedFrom" }); return; }
  try {
    await dbReady;
    let finalNum = receiptNumber?.trim();
    if (!finalNum) {
      const countRow = await pool.query(`SELECT COALESCE(MAX(CAST(number AS INTEGER)) + 1, 1) AS next FROM receipts`);
      finalNum = String(countRow.rows[0].next).padStart(6, '0');
    }
    const id = `rec-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    await pool.query(
      `INSERT INTO receipts (id, number, received_from, name_prefix, amount, amount_text, description, payment_method, date, notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [id, finalNum, receivedFrom, namePrefix ?? 'السيد', amount ?? 0, amountText ?? '', description ?? '', paymentMethod ?? 'cash', date ?? new Date().toISOString().slice(0, 10), notes ?? '']
    );
    res.json({ id, number: finalNum });
  } catch (e) { res.status(500).json({ error: "Failed to save receipt", detail: (e as Error).message }); }
});

router.put("/receipts/:id", async (req, res) => {
  if (!requireSession(req, res)) return;
  const { id } = req.params;
  const { receivedFrom, namePrefix, amount, amountText, description, paymentMethod, date, notes, number } = req.body as {
    receivedFrom?: string; namePrefix?: string; amount?: number; amountText?: string; description?: string; paymentMethod?: string; date?: string; notes?: string; number?: string;
  };
  try {
    await dbReady;
    await pool.query(
      `UPDATE receipts SET number=COALESCE($1,number), received_from=$2, name_prefix=COALESCE($3,name_prefix), amount=$4, amount_text=$5, description=$6, payment_method=$7, date=$8, notes=$9 WHERE id=$10`,
      [number?.trim() || null, receivedFrom, namePrefix ?? null, amount ?? 0, amountText ?? '', description ?? '', paymentMethod ?? 'cash', date, notes ?? '', id]
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: "Failed to update receipt", detail: (e as Error).message }); }
});

router.delete("/receipts/:id", async (req, res) => {
  if (!requireSession(req, res)) return;
  const { id } = req.params;
  try {
    await dbReady;
    await pool.query(`DELETE FROM receipts WHERE id = $1`, [id]);
    res.json({ ok: true });
  } catch { res.status(500).json({ error: "Failed to delete receipt" }); }
});

/* ── Disbursements (سندات الصرف) ────────────────────────── */

router.get("/disbursements", async (req, res) => {
  if (!requireSession(req, res)) return;
  try {
    await dbReady;
    const result = await pool.query(`SELECT * FROM disbursements ORDER BY created_at DESC`);
    res.json({ disbursements: result.rows });
  } catch (e) { res.status(500).json({ error: "Failed to load disbursements", detail: (e as Error).message }); }
});

router.post("/disbursements", async (req, res) => {
  if (!requireSession(req, res)) return;
  const { paidTo, namePrefix, amount, amountText, description, paymentMethod, date, notes, disbursementNumber } = req.body as {
    paidTo?: string; namePrefix?: string; amount?: number; amountText?: string; description?: string; paymentMethod?: string; date?: string; notes?: string; disbursementNumber?: string;
  };
  if (!paidTo) { res.status(400).json({ error: "Missing paidTo" }); return; }
  try {
    await dbReady;
    let finalNum = disbursementNumber?.trim();
    if (!finalNum) {
      const countRow = await pool.query(`SELECT COALESCE(MAX(CAST(number AS INTEGER)) + 1, 1) AS next FROM disbursements`);
      finalNum = String(countRow.rows[0].next).padStart(6, '0');
    }
    const id = `dis-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    await pool.query(
      `INSERT INTO disbursements (id, number, paid_to, name_prefix, amount, amount_text, description, payment_method, date, notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [id, finalNum, paidTo, namePrefix ?? 'السيد', amount ?? 0, amountText ?? '', description ?? '', paymentMethod ?? 'cash', date ?? new Date().toISOString().slice(0, 10), notes ?? '']
    );
    res.json({ id, number: finalNum });
  } catch (e) { res.status(500).json({ error: "Failed to save disbursement", detail: (e as Error).message }); }
});

router.put("/disbursements/:id", async (req, res) => {
  if (!requireSession(req, res)) return;
  const { id } = req.params;
  const { paidTo, namePrefix, amount, amountText, description, paymentMethod, date, notes, number } = req.body as {
    paidTo?: string; namePrefix?: string; amount?: number; amountText?: string; description?: string; paymentMethod?: string; date?: string; notes?: string; number?: string;
  };
  try {
    await dbReady;
    await pool.query(
      `UPDATE disbursements SET number=COALESCE($1,number), paid_to=$2, name_prefix=COALESCE($3,name_prefix), amount=$4, amount_text=$5, description=$6, payment_method=$7, date=$8, notes=$9 WHERE id=$10`,
      [number?.trim() || null, paidTo, namePrefix ?? null, amount ?? 0, amountText ?? '', description ?? '', paymentMethod ?? 'cash', date, notes ?? '', id]
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: "Failed to update disbursement", detail: (e as Error).message }); }
});

router.delete("/disbursements/:id", async (req, res) => {
  if (!requireSession(req, res)) return;
  const { id } = req.params;
  try {
    await dbReady;
    await pool.query(`DELETE FROM disbursements WHERE id = $1`, [id]);
    res.json({ ok: true });
  } catch { res.status(500).json({ error: "Failed to delete disbursement" }); }
});

/* ── Qadri Old Quotations — per-admin synced records ──── */

router.get("/qadri-old-quotations", async (req, res) => {
  if (!requireSession(req, res)) return;
  await dbReady;
  try {
    const result = await pool.query(
      `SELECT id, data, created_at, updated_at FROM qadri_old_quotations ORDER BY updated_at DESC`
    );
    const records = result.rows.map((row: { id: string; data: Record<string, unknown>; created_at: string; updated_at: string }) => ({
      id: row.id,
      ...row.data,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
    res.json({ records });
  } catch (e) { res.status(500).json({ error: "Failed to load records", detail: (e as Error).message }); }
});

router.post("/qadri-old-quotations", async (req, res) => {
  if (!requireSession(req, res)) return;
  await dbReady;
  const { id: incomingId, ...data } = req.body as { id?: string; [k: string]: unknown };
  if (rejectEmbeddedImageData(res, data)) return;
  const recordId = incomingId || `qoq-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  try {
    await pool.query(
      `INSERT INTO qadri_old_quotations (id, data) VALUES ($1, $2)
       ON CONFLICT (id) DO UPDATE SET data = $2, updated_at = NOW()`,
      [recordId, JSON.stringify(data)]
    );
    res.json({ id: recordId, ok: true });
  } catch (e) { res.status(500).json({ error: "Failed to save record", detail: (e as Error).message }); }
});

router.delete("/qadri-old-quotations/:id", async (req, res) => {
  if (!requireSession(req, res)) return;
  await dbReady;
  try {
    await pool.query(`DELETE FROM qadri_old_quotations WHERE id = $1`, [req.params.id]);
    res.json({ ok: true });
  } catch { res.status(500).json({ error: "Failed to delete record" }); }
});

/* ── Official documents and no-header quotations ───────── */

type JsonRecordRow = {
  id: string;
  data: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
};

function serializeJsonRecord(row: JsonRecordRow): Record<string, unknown> {
  const record: Record<string, unknown> = {
    id: row.id,
    ...row.data,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
  if (row.deleted_at !== undefined) record.deletedAt = row.deleted_at;
  return record;
}

async function listJsonRecords(table: "official_documents" | "no_header_quotations" | "export_invoices", trash = false) {
  const officialDocument = table === "official_documents";
  const deletedColumn = officialDocument ? ", deleted_at" : "";
  const deletedFilter = officialDocument
    ? trash ? " WHERE deleted_at IS NOT NULL" : " WHERE deleted_at IS NULL"
    : "";
  const result = await pool.query(
    `SELECT id, data, created_at, updated_at${deletedColumn} FROM ${table}${deletedFilter} ORDER BY updated_at DESC`,
  );
  return result.rows.map((row: JsonRecordRow) => serializeJsonRecord(row));
}

async function upsertJsonRecord(
  table: "official_documents" | "no_header_quotations" | "export_invoices",
  id: string,
  data: Record<string, unknown>,
) {
  const result = await pool.query(
    `INSERT INTO ${table} (id, data) VALUES ($1, $2)
     ON CONFLICT (id) DO UPDATE SET data = $2, updated_at = NOW()
     RETURNING id, data, created_at, updated_at`,
    [id, JSON.stringify(data)],
  );
  return serializeJsonRecord(result.rows[0] as JsonRecordRow);
}

async function deleteJsonRecord(table: "official_documents" | "no_header_quotations" | "export_invoices", id: string) {
  await pool.query(`DELETE FROM ${table} WHERE id = $1`, [id]);
}

async function restoreOfficialDocument(id: string) {
  await pool.query(`UPDATE official_documents SET deleted_at = NULL WHERE id = $1`, [id]);
}

async function permanentlyDeleteOfficialDocument(id: string) {
  await pool.query(`DELETE FROM official_documents WHERE id = $1 AND deleted_at IS NOT NULL`, [id]);
}

router.get("/official-documents", async (req, res) => {
  if (!requireSession(req, res)) return;
  await dbReady;
  try {
    res.json({ records: await listJsonRecords("official_documents", req.query.trash === "1") });
  } catch (e) {
    res.status(500).json({ error: "Failed to load official documents", detail: (e as Error).message });
  }
});

router.post("/official-documents", async (req, res) => {
  if (!requireSession(req, res)) return;
  await dbReady;
  const { id: incomingId, ...data } = req.body as { id?: string; [key: string]: unknown };
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    res.status(400).json({ error: "Invalid document" });
    return;
  }
  if (rejectEmbeddedImageData(res, data)) return;
  const id = incomingId || `official-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  try {
    res.json({ record: await upsertJsonRecord("official_documents", id, data) });
  } catch (e) {
    res.status(500).json({ error: "Failed to save official document", detail: (e as Error).message });
  }
});

router.delete("/official-documents/:id", async (req, res) => {
  if (!requireSession(req, res)) return;
  await dbReady;
  try {
    await pool.query(`UPDATE official_documents SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL`, [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: "Failed to move official document to trash", detail: (e as Error).message });
  }
});

router.post("/official-documents/:id/restore", async (req, res) => {
  if (!requireSession(req, res)) return;
  await dbReady;
  try {
    await restoreOfficialDocument(req.params.id);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: "Failed to restore official document", detail: (e as Error).message });
  }
});

router.delete("/official-documents/:id/permanent", async (req, res) => {
  if (!requireSession(req, res)) return;
  await dbReady;
  try {
    await permanentlyDeleteOfficialDocument(req.params.id);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: "Failed to permanently delete official document", detail: (e as Error).message });
  }
});

router.get("/no-header-quotations", async (req, res) => {
  if (!requireSession(req, res)) return;
  await dbReady;
  try {
    res.json({ records: await listJsonRecords("no_header_quotations") });
  } catch (e) {
    res.status(500).json({ error: "Failed to load no-header quotations", detail: (e as Error).message });
  }
});

router.post("/no-header-quotations", async (req, res) => {
  if (!requireSession(req, res)) return;
  await dbReady;
  const { id: incomingId, ...data } = req.body as { id?: string; [key: string]: unknown };
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    res.status(400).json({ error: "Invalid quotation" });
    return;
  }
  if (rejectEmbeddedImageData(res, data)) return;
  const id = incomingId || `no-header-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  try {
    res.json({ record: await upsertJsonRecord("no_header_quotations", id, data) });
  } catch (e) {
    res.status(500).json({ error: "Failed to save no-header quotation", detail: (e as Error).message });
  }
});

router.delete("/no-header-quotations/:id", async (req, res) => {
  if (!requireSession(req, res)) return;
  await dbReady;
  try {
    await deleteJsonRecord("no_header_quotations", req.params.id);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: "Failed to delete no-header quotation", detail: (e as Error).message });
  }
});

router.get("/export-invoices", async (req, res) => {
  if (!requireSession(req, res)) return;
  await dbReady;
  try {
    res.json({ records: await listJsonRecords("export_invoices") });
  } catch (e) {
    res.status(500).json({ error: "Failed to load export invoices", detail: (e as Error).message });
  }
});

router.post("/export-invoices", async (req, res) => {
  if (!requireSession(req, res)) return;
  await dbReady;
  const { id: incomingId, ...data } = req.body as { id?: string; [key: string]: unknown };
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    res.status(400).json({ error: "Invalid export invoice" });
    return;
  }
  if (rejectEmbeddedImageData(res, data)) return;
  const id = incomingId || `export-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  try {
    res.json({ record: await upsertJsonRecord("export_invoices", id, data) });
  } catch (e) {
    res.status(500).json({ error: "Failed to save export invoice", detail: (e as Error).message });
  }
});

router.delete("/export-invoices/:id", async (req, res) => {
  if (!requireSession(req, res)) return;
  await dbReady;
  try {
    await deleteJsonRecord("export_invoices", req.params.id);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: "Failed to delete export invoice", detail: (e as Error).message });
  }
});

type StoredImage = {
  id: string;
  url: string;
  pathname: string;
  sha256: string;
  sizeBytes: number;
  mimeType: string;
};

function imageExtension(mimeType: string): string {
  const subtype = mimeType.split("/")[1]?.split(";")[0]?.toLowerCase();
  return subtype === "jpeg" ? "jpg" : (subtype && /^[a-z0-9]+$/.test(subtype) ? subtype : "bin");
}

async function uploadImageBytes(buffer: Buffer, mimeType: string): Promise<Omit<StoredImage, "id">> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) throw new Error("BLOB_READ_WRITE_TOKEN is not configured");
  if (!mimeType.startsWith("image/")) throw new Error("Only image files are allowed");
  if (buffer.length === 0 || buffer.length > 3 * 1024 * 1024) {
    throw new Error("Image must be between 1 byte and 3MB");
  }

  const sha256 = crypto.createHash("sha256").update(buffer).digest("hex");
  const existing = await pool.query(
    `SELECT blob_url, blob_pathname, mime_type, size_bytes FROM images
     WHERE sha256 = $1 AND blob_url IS NOT NULL AND blob_url <> ''
     ORDER BY created_at ASC LIMIT 1`,
    [sha256],
  );
  if (existing.rows.length > 0) {
    const row = existing.rows[0] as { blob_url: string; blob_pathname: string; mime_type: string; size_bytes: number | null };
    return {
      url: row.blob_url,
      pathname: row.blob_pathname,
      sha256,
      sizeBytes: row.size_bytes ?? buffer.length,
      mimeType: row.mime_type || mimeType,
    };
  }

  const pathname = `qadri/images/${sha256}.${imageExtension(mimeType)}`;
  const blob = await put(pathname, buffer, {
    access: "private",
    addRandomSuffix: false,
    contentType: mimeType,
    token,
  });
  return { url: blob.url, pathname, sha256, sizeBytes: buffer.length, mimeType };
}

async function saveImageRecord(image: Omit<StoredImage, "id">): Promise<StoredImage> {
  const id = `img-${image.sha256.slice(0, 24)}`;
  await pool.query(
    `INSERT INTO images (id, data, mime_type, blob_url, blob_pathname, sha256, size_bytes)
     VALUES ($1, '', $2, $3, $4, $5, $6)
     ON CONFLICT (id) DO UPDATE SET
       mime_type = EXCLUDED.mime_type,
       blob_url = EXCLUDED.blob_url,
       blob_pathname = EXCLUDED.blob_pathname,
       sha256 = EXCLUDED.sha256,
       size_bytes = EXCLUDED.size_bytes`,
    [id, image.mimeType, image.url, image.pathname, image.sha256, image.sizeBytes],
  );
  return { id, ...image };
}

async function migrateLegacyImages(limit = 50): Promise<{ migrated: number; remaining: number }> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) throw new Error("BLOB_READ_WRITE_TOKEN is not configured");
  const legacy = await pool.query(
    `SELECT id, data, mime_type FROM images
     WHERE (blob_url IS NULL OR blob_url = '') AND data <> ''
     ORDER BY created_at ASC LIMIT $1`,
    [limit],
  );
  const migratedRows = await Promise.all((legacy.rows as { id: string; data: string; mime_type: string }[]).map(async (row) => {
    try {
      const image = await uploadImageBytes(Buffer.from(row.data, "base64"), row.mime_type || "image/jpeg");
      await pool.query(
        `UPDATE images SET data = '', mime_type = $2, blob_url = $3, blob_pathname = $4, sha256 = $5, size_bytes = $6 WHERE id = $1`,
        [row.id, image.mimeType, image.url, image.pathname, image.sha256, image.sizeBytes],
      );
      return 1;
    } catch (error) {
      logger.warn({ err: error, imageId: row.id }, "Legacy image migration skipped");
      return 0;
    }
  }));
  const migrated = migratedRows.reduce((total, value) => total + value, 0);
  const remainingResult = await pool.query(
    `SELECT COUNT(*)::int AS count FROM images WHERE (blob_url IS NULL OR blob_url = '') AND data <> ''`,
  );
  return { migrated, remaining: Number(remainingResult.rows[0]?.count ?? 0) };
}

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
    if (buffer.byteLength > 3 * 1024 * 1024) {
      res.status(400).json({ error: "الصورة كبيرة جداً (أكثر من 3MB) — يُرجى استخدام صورة أصغر" });
      return;
    }
    const mime = contentType.split(";")[0].trim();
    const stored = await saveImageRecord(await uploadImageBytes(Buffer.from(buffer), mime));
    res.json({ id: stored.id, url: `/api/images/${encodeURIComponent(stored.id)}` });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("BLOB_READ_WRITE_TOKEN")) {
      res.status(503).json({ error: "تخزين الصور غير مهيأ على الخادم. أضف BLOB_READ_WRITE_TOKEN في Vercel." });
      return;
    }
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
  const mime = mimeType ?? "image/jpeg";
  try {
    const raw = data.startsWith("data:") ? data.split(",")[1] : data;
    const stored = await saveImageRecord(await uploadImageBytes(Buffer.from(raw, "base64"), mime));
    res.json({ id: stored.id, url: `/api/images/${encodeURIComponent(stored.id)}` });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes("BLOB_READ_WRITE_TOKEN")) {
      res.status(503).json({ error: "تخزين الصور غير مهيأ على الخادم. أضف BLOB_READ_WRITE_TOKEN في Vercel." });
      return;
    }
    res.status(500).json({ error: "Failed to save image" });
  }
});

router.get("/images/:id", async (req, res) => {
  const { id } = req.params;
  try {
    await dbReady;
    const result = await pool.query(
      `SELECT data, mime_type, blob_url FROM images WHERE id = $1`,
      [id]
    );
    if (result.rows.length === 0) { res.status(404).end(); return; }
    const { data, mime_type, blob_url } = result.rows[0] as { data: string; mime_type: string; blob_url?: string | null };
    if (blob_url) {
      let isPrivateBlob = false;
      try {
        isPrivateBlob = new URL(blob_url).hostname.includes(".private.blob.vercel-storage.com");
      } catch {
        // Keep the legacy redirect behavior for non-URL values.
      }

      if (!isPrivateBlob) {
        res.redirect(302, blob_url);
        return;
      }

      const token = process.env.BLOB_READ_WRITE_TOKEN;
      if (!token) {
        res.status(503).json({ error: "تخزين الصور غير مهيأ على الخادم" });
        return;
      }

      const blob = await get(blob_url, {
        access: "private",
        token,
        ifNoneMatch: typeof req.headers["if-none-match"] === "string"
          ? req.headers["if-none-match"]
          : undefined,
      });
      if (!blob) { res.status(404).end(); return; }
      if (blob.statusCode === 304) {
        res.status(304);
        res.setHeader("ETag", blob.blob.etag);
        res.setHeader("Cache-Control", "private, no-cache");
        res.end();
        return;
      }

      res.status(200);
      res.setHeader("Content-Type", blob.blob.contentType || mime_type);
      res.setHeader("Content-Length", String(blob.blob.size));
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("ETag", blob.blob.etag);
      res.setHeader("Cache-Control", "private, no-cache");

      const reader = blob.stream.getReader();
      try {
        while (true) {
          const chunk = await reader.read();
          if (chunk.done) break;
          res.write(Buffer.from(chunk.value));
        }
        res.end();
      } finally {
        reader.releaseLock();
      }
      return;
    }
    if (!data) { res.status(404).end(); return; }
    const buf = Buffer.from(data, "base64");
    res.setHeader("Content-Type", mime_type);
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.end(buf);
  } catch {
    res.status(500).end();
  }
});

router.post("/images/migrate-legacy", async (req, res) => {
  if (!requireSession(req, res)) return;
  await dbReady;
  try {
    res.json(await migrateLegacyImages());
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes("BLOB_READ_WRITE_TOKEN")) {
      res.status(503).json({ error: "تخزين الصور غير مهيأ على الخادم. أضف BLOB_READ_WRITE_TOKEN في Vercel." });
      return;
    }
    res.status(500).json({ error: "Failed to migrate legacy images" });
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

/* ── Admin Quotations (عروض الأسعار المنشأة من الأدمن) ─────────────── */

router.get("/admin-quotations", async (req, res) => {
  if (!requireSession(req, res)) return;
  await dbReady;
  const trash = req.query.trash === 'true';
  try {
    const rows = await pool.query(
      `SELECT aq.*, json_agg(aqi.* ORDER BY aqi.sort_order) FILTER (WHERE aqi.id IS NOT NULL) AS items
       FROM admin_quotations aq
       LEFT JOIN admin_quotation_items aqi ON aqi.quotation_id = aq.id
       WHERE ${trash ? 'aq.deleted_at IS NOT NULL' : 'aq.deleted_at IS NULL'}
       GROUP BY aq.id
       ORDER BY aq.created_at DESC`
    );
    res.json({ quotations: rows.rows });
  } catch { res.status(500).json({ error: "Failed to load quotations" }); }
});

router.post("/admin-quotations", async (req, res) => {
  if (!requireSession(req, res)) return;
  await dbReady;
  const { quotationNumber, customerName, date, notes, grandTotal, discountValue, taxRate, details, items } = req.body as {
    quotationNumber?: string; customerName?: string; date?: string; notes?: string;
    grandTotal?: number; discountValue?: number; taxRate?: number; details?: unknown; items?: unknown[];
  };
  if (!customerName || !quotationNumber) {
    res.status(400).json({ error: "اسم العميل ورقم العرض مطلوبان" }); return;
  }
  const id = `aq-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO admin_quotations (id, quotation_number, customer_name, date, notes, grand_total, discount_value, tax_rate, details)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [id, quotationNumber, customerName, date ?? new Date().toISOString().slice(0, 10),
       notes ?? '', grandTotal ?? 0, discountValue ?? 0, taxRate ?? 0, JSON.stringify(details ?? {})]
    );
    const itemsArr = Array.isArray(items) ? items : [];
    for (let i = 0; i < itemsArr.length; i++) {
      const item = itemsArr[i] as Record<string, unknown>;
      const itemId = `aqi-${Date.now()}-${Math.random().toString(36).slice(2, 9)}-${i}`;
      await client.query(
        `INSERT INTO admin_quotation_items (id, quotation_id, name, description, category, quantity, unit, price, total, image_url, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [itemId, id, item.name ?? '', item.description ?? '', item.category ?? '',
         item.quantity ?? 1, item.unit ?? 'وحدة', item.price ?? 0, item.total ?? 0,
         item.imageUrl ?? null, i]
      );
    }
    await client.query('COMMIT');
    res.status(201).json({ id, ok: true });
  } catch (e) {
    await client.query('ROLLBACK');
    logger.error({ e }, 'Failed to create admin quotation');
    res.status(500).json({ error: "Failed to save quotation" });
  } finally { client.release(); }
});

router.put("/admin-quotations/:id", async (req, res) => {
  if (!requireSession(req, res)) return;
  await dbReady;
  const { quotationNumber, customerName, date, notes, grandTotal, discountValue, taxRate, details, items } = req.body as {
    quotationNumber?: string; customerName?: string; date?: string; notes?: string;
    grandTotal?: number; discountValue?: number; taxRate?: number; details?: unknown; items?: unknown[];
  };
  if (!customerName || !quotationNumber) {
    res.status(400).json({ error: "اسم العميل ورقم العرض مطلوبان" }); return;
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `UPDATE admin_quotations SET quotation_number=$1, customer_name=$2, date=$3, notes=$4, grand_total=$5, discount_value=$6, tax_rate=$7, details=$8 WHERE id=$9`,
      [quotationNumber, customerName, date ?? new Date().toISOString().slice(0, 10),
       notes ?? '', grandTotal ?? 0, discountValue ?? 0, taxRate ?? 0, JSON.stringify(details ?? {}), req.params.id]
    );
    await client.query(`DELETE FROM admin_quotation_items WHERE quotation_id=$1`, [req.params.id]);
    const itemsArr = Array.isArray(items) ? items : [];
    for (let i = 0; i < itemsArr.length; i++) {
      const item = itemsArr[i] as Record<string, unknown>;
      const itemId = `aqi-${Date.now()}-${Math.random().toString(36).slice(2, 9)}-${i}`;
      await client.query(
        `INSERT INTO admin_quotation_items (id, quotation_id, name, description, category, quantity, unit, price, total, image_url, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [itemId, req.params.id, item.name ?? '', item.description ?? '', item.category ?? '',
         item.quantity ?? 1, item.unit ?? 'وحدة', item.price ?? 0, item.total ?? 0, item.imageUrl ?? null, i]
      );
    }
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (e) {
    await client.query('ROLLBACK');
    logger.error({ e }, 'Failed to update admin quotation');
    res.status(500).json({ error: "Failed to update quotation" });
  } finally { client.release(); }
});

router.post("/admin-quotations/:id/restore", async (req, res) => {
  if (!requireSession(req, res)) return;
  await dbReady;
  try {
    await pool.query(`UPDATE admin_quotations SET deleted_at = NULL WHERE id = $1`, [req.params.id]);
    res.json({ ok: true });
  } catch { res.status(500).json({ error: "Failed to restore quotation" }); }
});

router.delete("/admin-quotations/:id", async (req, res) => {
  if (!requireSession(req, res)) return;
  await dbReady;
  const permanent = req.query.permanent === 'true';
  try {
    if (permanent) {
      await pool.query(`DELETE FROM admin_quotations WHERE id = $1`, [req.params.id]);
    } else {
      await pool.query(`UPDATE admin_quotations SET deleted_at = NOW() WHERE id = $1`, [req.params.id]);
    }
    res.json({ ok: true });
  } catch { res.status(500).json({ error: "Failed to delete quotation" }); }
});

/* ── Smart text parser ───────────────────────────────────────────────── */

router.post("/parse-text", async (req, res) => {
  const { text } = req.body as { text?: string };
  if (!text) { res.status(400).json({ error: "text required" }); return; }
  const numberPattern = /(\d+(?:[.,]\d+)?)/g;
  const lines = text.split('\n').filter(l => l.trim() !== '');
  const items = lines.map(line => {
    const trimmedLine = line.trim();
    if (!trimmedLine) return null;
    if (trimmedLine.includes('\t')) {
      const cols = trimmedLine.split('\t').map(c => c.trim());
      if (cols[0] === '#' || cols[0] === 'م' || cols[0] === 'الرقم') return null;
      let name = '', description = '', category = '', qty = 1, price = 0;
      if (cols.length >= 6) {
        name = cols[1] || ''; description = cols[2] || ''; category = cols[3] || '';
        const qm = cols[4].match(numberPattern); if (qm) qty = parseFloat(qm[0].replace(',', '.'));
        const pm = cols[5].match(numberPattern); if (pm) price = parseFloat(pm[0].replace(',', '.'));
      } else if (cols.length === 5) {
        const firstIsNum = /^\d+$/.test(cols[0]);
        if (firstIsNum) {
          name = cols[1] || ''; description = cols[2] || '';
          const qm = cols[3].match(numberPattern); if (qm) qty = parseFloat(qm[0].replace(',', '.'));
          const pm = cols[4].match(numberPattern); if (pm) price = parseFloat(pm[0].replace(',', '.'));
        } else {
          name = cols[0] || ''; description = cols[1] || ''; category = cols[2] || '';
          const qm = cols[3].match(numberPattern); if (qm) qty = parseFloat(qm[0].replace(',', '.'));
          const pm = cols[4].match(numberPattern); if (pm) price = parseFloat(pm[0].replace(',', '.'));
        }
      } else if (cols.length === 4) {
        name = cols[0] || ''; description = cols[1] || '';
        const qm = cols[2].match(numberPattern); if (qm) qty = parseFloat(qm[0].replace(',', '.'));
        const pm = cols[3].match(numberPattern); if (pm) price = parseFloat(pm[0].replace(',', '.'));
      } else if (cols.length >= 2) {
        name = cols[0] || '';
        const pm = cols[cols.length - 1].match(numberPattern); if (pm) price = parseFloat(pm[0].replace(',', '.'));
      }
      if (!name) return null;
      return { name: name.trim(), description: description.trim(), category: category.trim(), quantity: Math.max(qty, 1), price: Math.max(price, 0), total: Math.max(qty, 1) * Math.max(price, 0) };
    }
    const slashParts = trimmedLine.split('/').map(p => p.trim()).filter(p => p);
    if (slashParts.length >= 3) {
      let qty = 1; const qtyMatch = slashParts[0].match(numberPattern); if (qtyMatch) qty = parseFloat(qtyMatch[0].replace(',', '.'));
      const name = slashParts[1] || 'عنصر غير معروف';
      let description = '', category = '', price = 0;
      if (slashParts.length >= 5) {
        description = slashParts[2] || ''; category = slashParts[3] || '';
        const pm = slashParts[4].match(numberPattern); if (pm) price = parseFloat(pm[0].replace(',', '.'));
      } else if (slashParts.length === 4) {
        description = slashParts[2] || '';
        const pm = slashParts[3].match(numberPattern); if (pm) price = parseFloat(pm[0].replace(',', '.'));
      } else {
        const pm = slashParts[2].match(numberPattern); if (pm) price = parseFloat(pm[0].replace(',', '.'));
      }
      return { name: name.trim() || 'عنصر غير معروف', description: description.trim(), category: category.trim(), quantity: Math.max(qty, 1), price: Math.max(price, 0), total: Math.max(qty, 1) * Math.max(price, 0) };
    }
    const numbers = trimmedLine.match(numberPattern) || [];
    const normalizedNumbers = numbers.map(n => parseFloat(n.replace(',', '.')));
    const nameText = trimmedLine.replace(numberPattern, '').trim();
    let qty = 1, price = 0;
    if (normalizedNumbers.length >= 2) { price = normalizedNumbers[normalizedNumbers.length - 1]; qty = normalizedNumbers[normalizedNumbers.length - 2]; }
    else if (normalizedNumbers.length === 1) { price = normalizedNumbers[0]; qty = 1; }
    const name = nameText || `منتج #${normalizedNumbers.join('-') || 'unknown'}`;
    return { name: name.trim() || 'عنصر غير معروف', description: '', category: '', quantity: Math.max(qty, 1), price: Math.max(price, 0), total: Math.max(qty, 1) * Math.max(price, 0) };
  }).filter(item => item !== null);
  res.json({ items });
});

export default router;
