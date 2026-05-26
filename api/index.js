import express from "express";
import cors from "cors";
import pg from "pg";
import crypto from "crypto";

const { Pool } = pg;

const DB_URL = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL;
if (!DB_URL) throw new Error("NEON_DATABASE_URL or DATABASE_URL must be set");

const pool = new Pool({
  connectionString: DB_URL,
  ssl: { rejectUnauthorized: false },
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
`).then(() => {
  return pool.query(`
    ALTER TABLE quote_requests ADD COLUMN IF NOT EXISTS shipping_destination TEXT NOT NULL DEFAULT '';
    ALTER TABLE quote_requests ADD COLUMN IF NOT EXISTS shipping_fee NUMERIC NOT NULL DEFAULT 0;
    ALTER TABLE quote_requests ADD COLUMN IF NOT EXISTS shipping_method TEXT NOT NULL DEFAULT '';
    ALTER TABLE quote_requests ADD COLUMN IF NOT EXISTS shipping_address TEXT NOT NULL DEFAULT '';
  `);
}).catch((e) => console.error("DB init error:", e.message));

const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const TOKEN_SECRET = crypto
  .createHash("sha256")
  .update(DB_URL)
  .digest();

function hashPassword(password) {
  return crypto.createHash("sha256").update(password).digest("hex");
}

function createToken() {
  const expiry = Date.now() + SESSION_TTL_MS;
  const payload = Buffer.from(JSON.stringify({ expiry })).toString("base64url");
  const sig = crypto
    .createHmac("sha256", TOKEN_SECRET)
    .update(payload)
    .digest("base64url");
  return `${payload}.${sig}`;
}

function verifyToken(token) {
  const dot = token.indexOf(".");
  if (dot === -1) return false;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = crypto
    .createHmac("sha256", TOKEN_SECRET)
    .update(payload)
    .digest("base64url");
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

const app = express();
app.use(cors({ origin: true }));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

app.get("/api/healthz", (_req, res) => {
  res.json({ status: "ok" });
});

app.get("/api/admin/verify", (req, res) => {
  if (!requireSession(req, res)) return;
  res.json({ ok: true });
});

app.post("/api/admin/login", async (req, res) => {
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
  try {
    const rows = await pool.query(`SELECT COUNT(*) AS c FROM admins`);
    res.json({ needsSetup: parseInt(rows.rows[0].c, 10) === 0 });
  } catch {
    res.status(500).json({ error: "Database error" });
  }
});

app.post("/api/admin/setup", async (req, res) => {
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

app.get("/api/site-data", async (_req, res) => {
  try {
    const rows = await pool.query(`SELECT data FROM site_config WHERE id = 'main'`);
    if (rows.rows.length === 0) { res.json({ data: null }); return; }
    res.json({ data: rows.rows[0].data });
  } catch {
    res.status(500).json({ error: "Failed to load site data" });
  }
});

app.put("/api/site-data", async (req, res) => {
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

app.post("/api/quotes", async (req, res) => {
  const { customerName, phone, items, notes, shippingMethod, shippingAddress, shippingFee } = req.body ?? {};
  if (!customerName || !Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }
  if (shippingMethod !== "pickup" && shippingMethod !== "delivery") {
    res.status(400).json({ error: "يجب اختيار طريقة التوصيل: استلام من المشتل أو توصيل" });
    return;
  }
  const id = `q-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  try {
    await pool.query(
      `INSERT INTO quote_requests (id, customer_name, phone, items, notes, shipping_method, shipping_address, shipping_fee)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [id, customerName, phone ?? "", JSON.stringify(items), notes ?? "", shippingMethod, shippingAddress ?? "", shippingFee ?? 0]
    );
    res.json({ id });
  } catch (e) {
    console.error("Failed to save quote:", e.message);
    res.status(500).json({ error: "Failed to save quote" });
  }
});

app.get("/api/quotes", async (req, res) => {
  if (!requireSession(req, res)) return;
  try {
    const result = await pool.query(`SELECT * FROM quote_requests ORDER BY created_at DESC`);
    res.json({ quotes: result.rows });
  } catch {
    res.status(500).json({ error: "Failed to load quotes" });
  }
});

app.put("/api/quotes/:id", async (req, res) => {
  if (!requireSession(req, res)) return;
  const { id } = req.params;
  const { items, discount, tax, status, notes, shippingFee, shippingMethod, shippingAddress } = req.body ?? {};
  try {
    await pool.query(
      `UPDATE quote_requests SET items = $1, discount = $2, tax = $3, status = $4, notes = COALESCE($5, notes),
       shipping_fee = $6, shipping_method = COALESCE($7, shipping_method), shipping_address = COALESCE($8, shipping_address)
       WHERE id = $9`,
      [JSON.stringify(items ?? []), discount ?? 0, tax ?? 0, status ?? "priced", notes ?? null,
       shippingFee ?? 0, shippingMethod ?? null, shippingAddress ?? null, id]
    );
    res.json({ ok: true });
  } catch (e) {
    console.error("Failed to update quote:", e.message);
    res.status(500).json({ error: "Failed to update quote" });
  }
});

app.delete("/api/quotes/:id", async (req, res) => {
  if (!requireSession(req, res)) return;
  const { id } = req.params;
  try {
    await pool.query(`DELETE FROM quote_requests WHERE id = $1`, [id]);
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Failed to delete quote" });
  }
});

app.post("/api/images", async (req, res) => {
  if (!requireSession(req, res)) return;
  const { data, mimeType } = req.body ?? {};
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
      res.status(400).json({
        error: "هذا الرابط لا يخدم الصورة مباشرة. استخدم رابطاً ينتهي بـ .jpg أو .png",
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
      res.status(400).json({ error: "انتهت مهلة التنزيل" });
    } else {
      res.status(500).json({ error: "فشل تنزيل الصورة" });
    }
  }
});

app.get("/api/images/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      `SELECT data, mime_type FROM images WHERE id = $1`,
      [id]
    );
    if (result.rows.length === 0) { res.status(404).end(); return; }
    const { data, mime_type } = result.rows[0];
    const buf = Buffer.from(data, "base64");
    res.setHeader("Content-Type", mime_type);
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.end(buf);
  } catch {
    res.status(500).end();
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
