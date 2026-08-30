import express from "express";
import cors from "cors";
import pg from "pg";
import crypto from "crypto";
import { get, put } from "@vercel/blob";

const { Pool } = pg;

const DB_URL = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL;
if (!DB_URL) throw new Error("NEON_DATABASE_URL or DATABASE_URL must be set");

const pool = new Pool({
  connectionString: DB_URL,
  ssl: { rejectUnauthorized: false },
});

const dbReady = pool.connect().then(async (client) => {
  try {
    await client.query(`
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
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        shipping_destination TEXT NOT NULL DEFAULT '',
        shipping_fee NUMERIC NOT NULL DEFAULT 0,
        shipping_method TEXT NOT NULL DEFAULT '',
        shipping_address TEXT NOT NULL DEFAULT ''
      );
      CREATE TABLE IF NOT EXISTS images (
        id TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        mime_type TEXT NOT NULL DEFAULT 'image/jpeg',
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      );
      CREATE TABLE IF NOT EXISTS invoices (
        id TEXT PRIMARY KEY,
        number TEXT NOT NULL,
        customer_name TEXT NOT NULL DEFAULT '',
        date TEXT NOT NULL DEFAULT '',
        items JSONB NOT NULL DEFAULT '[]',
        notes TEXT NOT NULL DEFAULT '',
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      );
    `);
    await client.query(`ALTER TABLE images ADD COLUMN IF NOT EXISTS blob_url TEXT`);
    await client.query(`ALTER TABLE images ADD COLUMN IF NOT EXISTS blob_pathname TEXT`);
    await client.query(`ALTER TABLE images ADD COLUMN IF NOT EXISTS sha256 TEXT`);
    await client.query(`ALTER TABLE images ADD COLUMN IF NOT EXISTS size_bytes INTEGER`);
    await client.query(`CREATE INDEX IF NOT EXISTS images_sha256_idx ON images (sha256)`);
    await client.query(`ALTER TABLE quote_requests ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ`);
    await client.query(`ALTER TABLE quote_requests ADD COLUMN IF NOT EXISTS planting_fee NUMERIC NOT NULL DEFAULT 0`);
    await client.query(`ALTER TABLE quote_requests ADD COLUMN IF NOT EXISTS order_type TEXT NOT NULL DEFAULT 'plant_quote'`);
    await client.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'receivable'`);
    await client.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS discount NUMERIC NOT NULL DEFAULT 0`);
    await client.query(`CREATE TABLE IF NOT EXISTS receipts (id TEXT PRIMARY KEY, number TEXT NOT NULL, received_from TEXT NOT NULL DEFAULT '', amount NUMERIC NOT NULL DEFAULT 0, amount_text TEXT NOT NULL DEFAULT '', description TEXT NOT NULL DEFAULT '', payment_method TEXT NOT NULL DEFAULT 'cash', date TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL DEFAULT '', created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL)`);
    await client.query(`CREATE TABLE IF NOT EXISTS disbursements (id TEXT PRIMARY KEY, number TEXT NOT NULL, paid_to TEXT NOT NULL DEFAULT '', amount NUMERIC NOT NULL DEFAULT 0, amount_text TEXT NOT NULL DEFAULT '', description TEXT NOT NULL DEFAULT '', payment_method TEXT NOT NULL DEFAULT 'cash', date TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL DEFAULT '', created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL)`);
    await client.query(`CREATE TABLE IF NOT EXISTS qadri_old_quotations (id TEXT PRIMARY KEY, data JSONB NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL, updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL)`);
  } catch (e) {
    console.error("DB init error:", e.message);
  } finally {
    client.release();
  }
}).catch((e) => console.error("DB connect error:", e.message));

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const TOKEN_SECRET = crypto.createHash("sha256").update(DB_URL).digest();

function hashPassword(password) {
  return crypto.createHash("sha256").update(password).digest("hex");
}

function createToken() {
  const expiry = Date.now() + SESSION_TTL_MS;
  const payload = Buffer.from(JSON.stringify({ expiry })).toString("base64url");
  const sig = crypto.createHmac("sha256", TOKEN_SECRET).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

function verifyToken(token) {
  const dot = token.indexOf(".");
  if (dot === -1) return false;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = crypto.createHmac("sha256", TOKEN_SECRET).update(payload).digest("base64url");
  if (sig !== expected) return false;
  try {
    const { expiry } = JSON.parse(Buffer.from(payload, "base64url").toString());
    return Date.now() < expiry;
  } catch {
    return false;
  }
}

function requireSession(req, res) {
  const auth = req.headers["authorization"] ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!verifyToken(token)) {
    res.status(403).json({ error: "Forbidden" });
    return false;
  }
  return true;
}

function containsEmbeddedImageData(value) {
  if (typeof value === "string") return /^data:image\//i.test(value);
  if (Array.isArray(value)) return value.some(containsEmbeddedImageData);
  if (value && typeof value === "object") return Object.values(value).some(containsEmbeddedImageData);
  return false;
}

function rejectEmbeddedImageData(res, value) {
  if (!containsEmbeddedImageData(value)) return false;
  res.status(422).json({ error: "Images must be uploaded to Blob storage before saving the record" });
  return true;
}

const app = express();
app.use(cors({
  origin: true,
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE", "OPTIONS"],
  credentials: false,
}));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

/* ── Health ─────────────────────────────────────────────── */

app.get("/api/healthz", (_req, res) => {
  res.json({ status: "ok" });
});

/* ── Admin Auth ─────────────────────────────────────────── */

app.get("/api/admin/verify", (req, res) => {
  if (!requireSession(req, res)) return;
  res.json({ ok: true });
});

app.post("/api/admin/login", async (req, res) => {
  await dbReady;
  const { username, password } = req.body ?? {};
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
    res.json({ token: createToken() });
  } catch {
    res.status(500).json({ error: "Database error" });
  }
});

app.get("/api/admin/needs-setup", async (_req, res) => {
  await dbReady;
  try {
    const rows = await pool.query(`SELECT COUNT(*) AS c FROM admins`);
    res.json({ needsSetup: parseInt(rows.rows[0].c, 10) === 0 });
  } catch {
    res.status(500).json({ error: "Database error" });
  }
});

app.post("/api/admin/setup", async (req, res) => {
  await dbReady;
  const { username, password, secret } = req.body ?? {};
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
      `INSERT INTO admins (username, password_hash) VALUES ($1, $2)
       ON CONFLICT (username) DO UPDATE SET password_hash = $2`,
      [username, hashPassword(password)]
    );
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Database error" });
  }
});

/* ── Site Data ──────────────────────────────────────────── */

app.get("/api/site-data", async (_req, res) => {
  await dbReady;
  try {
    const rows = await pool.query(`SELECT data FROM site_config WHERE id = 'main'`);
    if (rows.rows.length === 0) { res.json({ data: null }); return; }
    res.json({ data: rows.rows[0].data });
  } catch {
    res.status(500).json({ error: "Failed to load site data" });
  }
});

app.put("/api/site-data", async (req, res) => {
  await dbReady;
  if (!requireSession(req, res)) return;
  const { data } = req.body ?? {};
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

/* ── Quote Requests ─────────────────────────────────────── */

app.post("/api/quotes", async (req, res) => {
  await dbReady;
  const { customerName, phone, items, notes, shippingMethod, shippingAddress, shippingFee, orderType } = req.body ?? {};
  if (!customerName || !Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }
  const validMethods = ["pickup", "delivery", "plant_only", "delivery_plant", "delivery_free"];
  if (!shippingMethod || !validMethods.includes(shippingMethod)) {
    res.status(400).json({ error: "يجب اختيار طريقة التوصيل" });
    return;
  }
  const validOrderTypes = ["plant_quote", "agri_store"];
  const normalizedOrderType = validOrderTypes.includes(orderType) ? orderType : "plant_quote";
  const id = `q-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  try {
    await pool.query(
      `INSERT INTO quote_requests (id, customer_name, phone, items, notes, shipping_method, shipping_address, shipping_fee, order_type)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [id, customerName, phone ?? "", JSON.stringify(items), notes ?? "", shippingMethod, shippingAddress ?? "", shippingFee ?? 0, normalizedOrderType]
    );
    res.json({ id });
  } catch (e) {
    console.error("Failed to save quote:", e.message);
    res.status(500).json({ error: "Failed to save quote" });
  }
});

app.get("/api/quotes", async (req, res) => {
  if (!requireSession(req, res)) return;
  const trash = req.query.trash === "1";
  const orderType = req.query.orderType === "agri_store" ? "agri_store" : "plant_quote";
  try {
    const result = await pool.query(
      trash
        ? `SELECT * FROM quote_requests WHERE deleted_at IS NOT NULL AND order_type = $1 ORDER BY deleted_at DESC`
        : `SELECT * FROM quote_requests WHERE deleted_at IS NULL AND order_type = $1 ORDER BY created_at DESC`,
      [orderType]
    );
    res.json({ quotes: result.rows });
  } catch {
    res.status(500).json({ error: "Failed to load quotes" });
  }
});

app.put("/api/quotes/:id", async (req, res) => {
  if (!requireSession(req, res)) return;
  const { id } = req.params;
  const { items, discount, tax, status, notes, shippingFee, plantingFee, shippingMethod, shippingAddress } = req.body ?? {};
  try {
    await pool.query(
      `UPDATE quote_requests SET items = $1, discount = $2, tax = $3, status = $4, notes = COALESCE($5, notes),
       shipping_fee = $6, shipping_method = COALESCE($7, shipping_method), shipping_address = COALESCE($8, shipping_address),
       planting_fee = $9 WHERE id = $10`,
      [JSON.stringify(items ?? []), discount ?? 0, tax ?? 0, status ?? "priced", notes ?? null,
       shippingFee ?? 0, shippingMethod ?? null, shippingAddress ?? null, plantingFee ?? 0, id]
    );
    res.json({ ok: true });
  } catch (e) {
    console.error("Failed to update quote:", e.message);
    res.status(500).json({ error: "Failed to update quote" });
  }
});

/* Soft-delete a quote (move to trash) */
app.delete("/api/quotes/:id", async (req, res) => {
  if (!requireSession(req, res)) return;
  const { id } = req.params;
  try {
    await pool.query(`UPDATE quote_requests SET deleted_at = NOW() WHERE id = $1`, [id]);
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Failed to delete quote" });
  }
});

/* Restore a quote from trash */
app.post("/api/quotes/:id/restore", async (req, res) => {
  if (!requireSession(req, res)) return;
  const { id } = req.params;
  try {
    await pool.query(`UPDATE quote_requests SET deleted_at = NULL WHERE id = $1`, [id]);
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Failed to restore quote" });
  }
});

/* Permanently delete a quote */
app.delete("/api/quotes/:id/permanent", async (req, res) => {
  if (!requireSession(req, res)) return;
  const { id } = req.params;
  try {
    await pool.query(`DELETE FROM quote_requests WHERE id = $1`, [id]);
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Failed to permanently delete quote" });
  }
});

/* ── Invoices ───────────────────────────────────────────── */

app.get("/api/invoices", async (req, res) => {
  if (!requireSession(req, res)) return;
  try {
    await dbReady;
    const result = await pool.query(`SELECT * FROM invoices ORDER BY created_at DESC`);
    res.json({ invoices: result.rows });
  } catch (e) {
    res.status(500).json({ error: "Failed to load invoices", detail: e.message });
  }
});

app.post("/api/invoices", async (req, res) => {
  if (!requireSession(req, res)) return;
  const { customerName, date, items, notes, status, discount, invoiceNumber } = req.body ?? {};
  if (!customerName || !Array.isArray(items)) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }
  try {
    await dbReady;
    let finalNum = invoiceNumber?.trim();
    if (!finalNum) {
      const countRow = await pool.query(`SELECT COALESCE(MAX(CAST(number AS INTEGER)) + 1, 1) AS next FROM invoices`);
      finalNum = String(countRow.rows[0].next).padStart(6, "0");
    }
    const id = `inv-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const invoiceStatus = status === "paid" ? "paid" : status === "online" ? "online" : "receivable";
    await pool.query(
      `INSERT INTO invoices (id, number, customer_name, date, items, notes, status, discount) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [id, finalNum, customerName, date ?? new Date().toISOString().slice(0, 10), JSON.stringify(items), notes ?? "", invoiceStatus, discount ?? 0]
    );
    res.json({ id, number: finalNum });
  } catch (e) {
    res.status(500).json({ error: "Failed to save invoice", detail: e.message });
  }
});

app.put("/api/invoices/:id", async (req, res) => {
  if (!requireSession(req, res)) return;
  const { id } = req.params;
  const { number, discount, customerName, date, items, notes, status } = req.body ?? {};
  try {
    await dbReady;
    if (items !== undefined) {
      const invoiceStatus = status === "paid" ? "paid" : status === "online" ? "online" : "receivable";
      await pool.query(
        `UPDATE invoices SET number = COALESCE($1, number), discount = $2, customer_name = $3, date = $4, items = $5, notes = $6, status = $7 WHERE id = $8`,
        [number?.trim() || null, discount ?? 0, customerName, date, JSON.stringify(items), notes ?? "", invoiceStatus, id]
      );
    } else {
      await pool.query(`UPDATE invoices SET number = COALESCE($1, number), discount = $2 WHERE id = $3`, [number?.trim() || null, discount ?? 0, id]);
    }
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: "Failed to update invoice", detail: e.message });
  }
});

app.put("/api/invoices/:id/status", async (req, res) => {
  if (!requireSession(req, res)) return;
  const { id } = req.params;
  const { status } = req.body ?? {};
  if (status !== "paid" && status !== "receivable" && status !== "online") {
    res.status(400).json({ error: "Invalid status" });
    return;
  }
  try {
    await dbReady;
    await pool.query(`UPDATE invoices SET status = $1 WHERE id = $2`, [status, id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: "Failed to update status", detail: e.message });
  }
});

app.delete("/api/invoices/:id", async (req, res) => {
  if (!requireSession(req, res)) return;
  const { id } = req.params;
  try {
    await dbReady;
    await pool.query(`DELETE FROM invoices WHERE id = $1`, [id]);
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Failed to delete invoice" });
  }
});

/* ── Receipts (سندات القبض) ─────────────────────────────── */

app.get("/api/receipts", async (req, res) => {
  if (!requireSession(req, res)) return;
  try {
    await dbReady;
    const result = await pool.query(`SELECT * FROM receipts ORDER BY created_at DESC`);
    res.json({ receipts: result.rows });
  } catch (e) {
    res.status(500).json({ error: "Failed to load receipts", detail: e.message });
  }
});

app.post("/api/receipts", async (req, res) => {
  if (!requireSession(req, res)) return;
  const { receivedFrom, amount, amountText, description, paymentMethod, date, notes, receiptNumber } = req.body ?? {};
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
      `INSERT INTO receipts (id, number, received_from, amount, amount_text, description, payment_method, date, notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [id, finalNum, receivedFrom, amount ?? 0, amountText ?? '', description ?? '', paymentMethod ?? 'cash', date ?? new Date().toISOString().slice(0, 10), notes ?? '']
    );
    res.json({ id, number: finalNum });
  } catch (e) {
    res.status(500).json({ error: "Failed to save receipt", detail: e.message });
  }
});

app.put("/api/receipts/:id", async (req, res) => {
  if (!requireSession(req, res)) return;
  const { id } = req.params;
  const { receivedFrom, amount, amountText, description, paymentMethod, date, notes, number } = req.body ?? {};
  try {
    await dbReady;
    await pool.query(
      `UPDATE receipts SET number=COALESCE($1,number), received_from=$2, amount=$3, amount_text=$4, description=$5, payment_method=$6, date=$7, notes=$8 WHERE id=$9`,
      [number?.trim() || null, receivedFrom, amount ?? 0, amountText ?? '', description ?? '', paymentMethod ?? 'cash', date, notes ?? '', id]
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: "Failed to update receipt", detail: e.message });
  }
});

app.delete("/api/receipts/:id", async (req, res) => {
  if (!requireSession(req, res)) return;
  const { id } = req.params;
  try {
    await dbReady;
    await pool.query(`DELETE FROM receipts WHERE id = $1`, [id]);
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Failed to delete receipt" });
  }
});

/* ── Disbursements (سندات الصرف) ────────────────────────── */

app.get("/api/disbursements", async (req, res) => {
  if (!requireSession(req, res)) return;
  try {
    await dbReady;
    const result = await pool.query(`SELECT * FROM disbursements ORDER BY created_at DESC`);
    res.json({ disbursements: result.rows });
  } catch (e) {
    res.status(500).json({ error: "Failed to load disbursements", detail: e.message });
  }
});

app.post("/api/disbursements", async (req, res) => {
  if (!requireSession(req, res)) return;
  const { paidTo, amount, amountText, description, paymentMethod, date, notes, disbursementNumber } = req.body ?? {};
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
      `INSERT INTO disbursements (id, number, paid_to, amount, amount_text, description, payment_method, date, notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [id, finalNum, paidTo, amount ?? 0, amountText ?? '', description ?? '', paymentMethod ?? 'cash', date ?? new Date().toISOString().slice(0, 10), notes ?? '']
    );
    res.json({ id, number: finalNum });
  } catch (e) {
    res.status(500).json({ error: "Failed to save disbursement", detail: e.message });
  }
});

app.put("/api/disbursements/:id", async (req, res) => {
  if (!requireSession(req, res)) return;
  const { id } = req.params;
  const { paidTo, amount, amountText, description, paymentMethod, date, notes, number } = req.body ?? {};
  try {
    await dbReady;
    await pool.query(
      `UPDATE disbursements SET number=COALESCE($1,number), paid_to=$2, amount=$3, amount_text=$4, description=$5, payment_method=$6, date=$7, notes=$8 WHERE id=$9`,
      [number?.trim() || null, paidTo, amount ?? 0, amountText ?? '', description ?? '', paymentMethod ?? 'cash', date, notes ?? '', id]
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: "Failed to update disbursement", detail: e.message });
  }
});

app.delete("/api/disbursements/:id", async (req, res) => {
  if (!requireSession(req, res)) return;
  const { id } = req.params;
  try {
    await dbReady;
    await pool.query(`DELETE FROM disbursements WHERE id = $1`, [id]);
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Failed to delete disbursement" });
  }
});

/* ── Qadri Old Quotations (عروض سعر قادري القديمة) ─────── */

app.get("/api/qadri-old-quotations", async (req, res) => {
  if (!requireSession(req, res)) return;
  await dbReady;
  try {
    const result = await pool.query(
      `SELECT id, data, created_at, updated_at FROM qadri_old_quotations ORDER BY updated_at DESC`
    );
    res.json({ records: result.rows.map(r => ({ id: r.id, ...r.data, createdAt: r.created_at, updatedAt: r.updated_at })) });
  } catch (e) {
    res.status(500).json({ error: "Failed to load records", detail: e.message });
  }
});

app.post("/api/qadri-old-quotations", async (req, res) => {
  if (!requireSession(req, res)) return;
  await dbReady;
  const { id: bodyId, ...rest } = req.body ?? {};
  if (rejectEmbeddedImageData(res, rest)) return;
  const id = bodyId || `qoq-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  try {
    await pool.query(
      `INSERT INTO qadri_old_quotations (id, data) VALUES ($1, $2)
       ON CONFLICT (id) DO UPDATE SET data = $2, updated_at = NOW()`,
      [id, JSON.stringify(rest)]
    );
    res.json({ id });
  } catch (e) {
    res.status(500).json({ error: "Failed to save record", detail: e.message });
  }
});

app.delete("/api/qadri-old-quotations/:id", async (req, res) => {
  if (!requireSession(req, res)) return;
  await dbReady;
  try {
    await pool.query(`DELETE FROM qadri_old_quotations WHERE id = $1`, [req.params.id]);
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Failed to delete record" });
  }
});

/* ── Images ─────────────────────────────────────────────── */

function imageExtension(mimeType) {
  const subtype = mimeType.split("/")[1]?.split(";")[0]?.toLowerCase();
  return subtype === "jpeg" ? "jpg" : (subtype && /^[a-z0-9]+$/.test(subtype) ? subtype : "bin");
}

async function uploadImageBytes(buffer, mimeType) {
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
    const row = existing.rows[0];
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

async function saveImageRecord(image) {
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

async function migrateLegacyImages(limit = 50) {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) throw new Error("BLOB_READ_WRITE_TOKEN is not configured");
  const legacy = await pool.query(
    `SELECT id, data, mime_type FROM images
     WHERE (blob_url IS NULL OR blob_url = '') AND data <> ''
     ORDER BY created_at ASC LIMIT $1`,
    [limit],
  );
  const migratedRows = await Promise.all(legacy.rows.map(async (row) => {
    try {
      const image = await uploadImageBytes(Buffer.from(row.data, "base64"), row.mime_type || "image/jpeg");
      await pool.query(
        `UPDATE images SET data = '', mime_type = $2, blob_url = $3, blob_pathname = $4, sha256 = $5, size_bytes = $6 WHERE id = $1`,
        [row.id, image.mimeType, image.url, image.pathname, image.sha256, image.sizeBytes],
      );
      return 1;
    } catch (error) {
      console.warn("[images] legacy migration skipped", row.id, error);
      return 0;
    }
  }));
  const migrated = migratedRows.reduce((total, value) => total + value, 0);
  const remainingResult = await pool.query(
    `SELECT COUNT(*)::int AS count FROM images WHERE (blob_url IS NULL OR blob_url = '') AND data <> ''`,
  );
  return { migrated, remaining: Number(remainingResult.rows[0]?.count ?? 0) };
}

app.post("/api/images/from-url", async (req, res) => {
  if (!requireSession(req, res)) return;
  const { url } = req.body ?? {};
  if (!url || !url.startsWith("http")) {
    res.status(400).json({ error: "رابط غير صالح — يجب أن يبدأ بـ http" });
    return;
  }
  const knownBadHosts = ["drive.google.com", "docs.google.com", "dropbox.com", "icloud.com", "onedrive.live.com"];
  try {
    const urlHost = new URL(url).hostname;
    if (knownBadHosts.some(h => urlHost.includes(h))) {
      res.status(400).json({ error: "هذا الرابط لا يخدم الصورة مباشرة. استخدم رابطاً ينتهي بـ .jpg أو .png" });
      return;
    }
  } catch {
    res.status(400).json({ error: "رابط غير صالح" });
    return;
  }
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    let response;
    try {
      response = await fetch(url, {
        signal: controller.signal,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "Accept": "image/*,*/*;q=0.8",
        },
      });
    } finally {
      clearTimeout(timeout);
    }
    if (!response.ok) {
      res.status(400).json({ error: `تعذّر تنزيل الصورة (خطأ ${response.status})` });
      return;
    }
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.startsWith("image/")) {
      res.status(400).json({ error: "الرابط لا يشير إلى صورة مباشرة" });
      return;
    }
    const buffer = await response.arrayBuffer();
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
      res.status(400).json({ error: "انتهت مهلة التنزيل" });
    } else {
      res.status(500).json({ error: "فشل تنزيل الصورة" });
    }
  }
});

app.post("/api/images", async (req, res) => {
  if (!requireSession(req, res)) return;
  const { data, mimeType } = req.body ?? {};
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

app.get("/api/images/:id", async (req, res) => {
  const { id } = req.params;
  try {
    await dbReady;
    const result = await pool.query(
      `SELECT data, mime_type, blob_url FROM images WHERE id = $1`,
      [id]
    );
    if (result.rows.length === 0) { res.status(404).end(); return; }
    const { data, mime_type, blob_url } = result.rows[0];
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

app.post("/api/images/migrate-legacy", async (req, res) => {
  if (!requireSession(req, res)) return;
  try {
    await dbReady;
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

app.delete("/api/images/:id", async (req, res) => {
  if (!requireSession(req, res)) return;
  const { id } = req.params;
  try {
    await pool.query(`DELETE FROM images WHERE id = $1`, [id]);
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Failed to delete image" });
  }
});

export default app;
