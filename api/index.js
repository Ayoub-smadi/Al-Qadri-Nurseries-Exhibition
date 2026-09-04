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
        data TEXT NOT NULL DEFAULT '',
        data_bytes BYTEA,
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
    await client.query(`ALTER TABLE images ADD COLUMN IF NOT EXISTS data_bytes BYTEA`);
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
    await client.query(`CREATE TABLE IF NOT EXISTS official_documents (id TEXT PRIMARY KEY, data JSONB NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL, updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL)`);
    await client.query(`ALTER TABLE official_documents ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ`);
      await client.query(`CREATE TABLE IF NOT EXISTS no_header_quotations (id TEXT PRIMARY KEY, data JSONB NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL, updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL)`);
      await client.query(`CREATE TABLE IF NOT EXISTS export_invoices (id TEXT PRIMARY KEY, data JSONB NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL, updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL)`);
      await client.query(`CREATE TABLE IF NOT EXISTS aq_quotations (
        id SERIAL PRIMARY KEY,
        quotation_number TEXT NOT NULL,
        customer_name TEXT NOT NULL,
        date TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        notes TEXT,
        grand_total NUMERIC NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        deleted_at TIMESTAMPTZ
      )`);
      await client.query(`CREATE TABLE IF NOT EXISTS aq_quotation_items (
        id SERIAL PRIMARY KEY,
        quotation_id INTEGER NOT NULL REFERENCES aq_quotations(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        description TEXT,
        category TEXT,
        quantity NUMERIC NOT NULL DEFAULT 1,
        price NUMERIC NOT NULL DEFAULT 0,
        total NUMERIC NOT NULL DEFAULT 0,
        image_url TEXT
      )`);
      await client.query(`CREATE TABLE IF NOT EXISTS aq_products (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        unit TEXT DEFAULT 'وحدة',
        price NUMERIC NOT NULL DEFAULT 0,
        stock INTEGER DEFAULT 0,
        image_url TEXT,
        category TEXT,
        sort_order INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      )`);
      await client.query(`CREATE TABLE IF NOT EXISTS admin_quotations (
        id TEXT PRIMARY KEY,
        quotation_number TEXT NOT NULL,
        customer_name TEXT NOT NULL,
        date TEXT NOT NULL,
        notes TEXT NOT NULL DEFAULT '',
        grand_total NUMERIC NOT NULL DEFAULT 0,
        discount_value NUMERIC NOT NULL DEFAULT 0,
        tax_rate NUMERIC NOT NULL DEFAULT 0,
        details JSONB NOT NULL DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        deleted_at TIMESTAMPTZ
      )`);
      await client.query(`CREATE TABLE IF NOT EXISTS admin_quotation_items (
        id TEXT PRIMARY KEY,
        quotation_id TEXT NOT NULL REFERENCES admin_quotations(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        category TEXT NOT NULL DEFAULT '',
        quantity NUMERIC NOT NULL DEFAULT 1,
        unit TEXT NOT NULL DEFAULT 'وحدة',
        price NUMERIC NOT NULL DEFAULT 0,
        total NUMERIC NOT NULL DEFAULT 0,
        image_url TEXT,
        sort_order INTEGER NOT NULL DEFAULT 0
      )`);
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
  res.status(422).json({ error: "Images must be uploaded to Neon before saving the record" });
  return true;
}

async function normalizeStoredImageReferences(value) {
  const result = await pool.query(
    `SELECT id, sha256 FROM images WHERE data_bytes IS NOT NULL`,
  );
  const byHash = new Map(
    result.rows
      .filter((row) => row.sha256)
      .map((row) => [row.sha256.toLowerCase(), `/api/images/${encodeURIComponent(row.id)}`]),
  );
  const rewrite = (item) => {
    if (typeof item === "string") {
      try {
        const url = new URL(item);
        if (url.hostname.includes(".private.blob.vercel-storage.com")) {
          const match = url.pathname.match(/\/([a-f0-9]{64})\.[a-z0-9]+$/i);
          const knownReference = match && byHash.get(match[1].toLowerCase());
          if (knownReference) return knownReference;
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
    res.setHeader("Cache-Control", "no-store");
    if (rows.rows.length === 0) { res.json({ data: null }); return; }
     res.json({ data: await normalizeStoredImageReferences(rows.rows[0].data) });
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

/* ── Saved Quotations (عروض الأسعار المحفوظة) ───────────── */

const quotationDetailSql = `
  SELECT q.*,
    COALESCE(
      json_agg(
        json_build_object(
          'id', i.id,
          'quotation_id', i.quotation_id,
          'name', i.name,
          'description', i.description,
          'category', i.category,
          'quantity', i.quantity,
          'price', i.price,
          'total', i.total,
          'image_url', i.image_url
        ) ORDER BY i.id
      ) FILTER (WHERE i.id IS NOT NULL),
      '[]'::json
    ) AS items
  FROM aq_quotations q
  LEFT JOIN aq_quotation_items i ON i.quotation_id = q.id
  WHERE q.id = $1
  GROUP BY q.id
`;

async function getQuotationWithItems(db, id) {
  const { rows } = await db.query(quotationDetailSql, [id]);
  return rows[0] ?? null;
}

async function insertQuotationItems(client, quotationId, items) {
  if (!Array.isArray(items) || items.length === 0) return;
  const values = [];
  const placeholders = items.map((item, index) => {
    const offset = index * 8;
    values.push(
      quotationId,
      item?.name ?? "",
      item?.description ?? null,
      item?.category ?? null,
      item?.quantity ?? 1,
      item?.price ?? 0,
      item?.total ?? 0,
      item?.imageUrl ?? item?.image_url ?? null,
    );
    return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8})`;
  });
  await client.query(
    `INSERT INTO aq_quotation_items (quotation_id, name, description, category, quantity, price, total, image_url)
     VALUES ${placeholders.join(", ")}`,
    values,
  );
}

app.get("/api/quotations", async (_req, res) => {
  try {
    await dbReady;
    const { rows } = await pool.query(
      `SELECT q.*, COUNT(i.id)::int AS item_count
       FROM aq_quotations q
       LEFT JOIN aq_quotation_items i ON i.quotation_id = q.id
       WHERE q.deleted_at IS NULL
       GROUP BY q.id
       ORDER BY q.created_at DESC`,
    );
    res.setHeader("Cache-Control", "private, max-age=5, stale-while-revalidate=30");
    return res.json(rows);
  } catch (e) {
    console.error("Failed to load quotations:", e.message);
    return res.status(500).json({ message: "Internal Error" });
  }
});

app.get("/api/quotations/:id", async (req, res) => {
  try {
    await dbReady;
    const quotation = await getQuotationWithItems(pool, Number(req.params.id));
    if (!quotation) return res.status(404).json({ message: "Not found" });
    return res.json(quotation);
  } catch (e) {
    console.error("Failed to load quotation:", e.message);
    return res.status(500).json({ message: "Internal Error" });
  }
});

app.post("/api/quotations", async (req, res) => {
  let client;
  try {
    await dbReady;
    const { quotationNumber, customerName, date, notes, grandTotal, items = [] } = req.body ?? {};
    if (!quotationNumber || !customerName || grandTotal === undefined || grandTotal === null || grandTotal === "") {
      return res.status(400).json({ message: "Missing required fields" });
    }
    client = await pool.connect();
    await client.query("BEGIN");
    const { rows: [newQuotation] } = await client.query(
      `INSERT INTO aq_quotations (quotation_number, customer_name, date, notes, grand_total)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [quotationNumber, customerName, date ? new Date(date) : new Date(), notes ?? null, grandTotal],
    );
    await insertQuotationItems(client, newQuotation.id, items);
    const result = await getQuotationWithItems(client, newQuotation.id);
    await client.query("COMMIT");
    return res.status(201).json(result);
  } catch (e) {
    if (client) await client.query("ROLLBACK").catch(() => {});
    console.error("Failed to save quotation:", e.message);
    return res.status(500).json({ message: "Internal Error" });
  } finally {
    client?.release();
  }
});

app.put("/api/quotations/:id", async (req, res) => {
  let client;
  try {
    await dbReady;
    const id = Number(req.params.id);
    const { quotationNumber, customerName, date, notes, grandTotal, items = [] } = req.body ?? {};
    client = await pool.connect();
    await client.query("BEGIN");
    const { rows: [updated] } = await client.query(
      `UPDATE aq_quotations SET quotation_number=$1, customer_name=$2, date=$3, notes=$4, grand_total=$5
       WHERE id=$6 RETURNING *`,
      [quotationNumber, customerName, date ? new Date(date) : new Date(), notes ?? null, grandTotal, id],
    );
    if (!updated) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Not found" });
    }
    await client.query(`DELETE FROM aq_quotation_items WHERE quotation_id=$1`, [id]);
    await insertQuotationItems(client, id, items);
    const result = await getQuotationWithItems(client, id);
    await client.query("COMMIT");
    return res.json(result);
  } catch (e) {
    if (client) await client.query("ROLLBACK").catch(() => {});
    console.error("Failed to update quotation:", e.message);
    return res.status(500).json({ message: "Internal Error" });
  } finally {
    client?.release();
  }
});

app.delete("/api/quotations/:id", async (req, res) => {
  try {
    await dbReady;
    await pool.query(`UPDATE aq_quotations SET deleted_at=NOW() WHERE id=$1`, [Number(req.params.id)]);
    return res.json({ ok: true });
  } catch (e) {
    console.error("Failed to delete quotation:", e.message);
    return res.status(500).json({ message: "Internal Error" });
  }
});

/* ── Products API (kept for the generated React query hooks) ── */

app.get("/api/products", async (_req, res) => {
  try {
    await dbReady;
    const { rows } = await pool.query(`SELECT * FROM aq_products ORDER BY sort_order, created_at`);
    return res.json(rows);
  } catch (e) {
    console.error("Failed to load products:", e.message);
    return res.status(500).json({ message: "Internal Error" });
  }
});

app.post("/api/products", async (req, res) => {
  try {
    await dbReady;
    const { name, description, unit, price, stock, imageUrl, category, sortOrder } = req.body ?? {};
    if (!name) return res.status(400).json({ message: "name is required" });
    const { rows: [product] } = await pool.query(
      `INSERT INTO aq_products (name, description, unit, price, stock, image_url, category, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [name, description ?? null, unit ?? "وحدة", price ?? 0, stock ?? 0, imageUrl ?? null, category ?? null, sortOrder ?? 0],
    );
    return res.status(201).json(product);
  } catch (e) {
    console.error("Failed to save product:", e.message);
    return res.status(500).json({ message: "Internal Error" });
  }
});

app.put("/api/products/:id", async (req, res) => {
  try {
    await dbReady;
    const { name, description, unit, price, imageUrl, category } = req.body ?? {};
    const { rows: [product] } = await pool.query(
      `UPDATE aq_products SET
        name = COALESCE($1, name), description = COALESCE($2, description), unit = COALESCE($3, unit),
        price = COALESCE($4, price), image_url = COALESCE($5, image_url), category = COALESCE($6, category)
       WHERE id=$7 RETURNING *`,
      [name ?? null, description ?? null, unit ?? null, price ?? null, imageUrl ?? null, category ?? null, Number(req.params.id)],
    );
    if (!product) return res.status(404).json({ message: "Not found" });
    return res.json(product);
  } catch (e) {
    console.error("Failed to update product:", e.message);
    return res.status(500).json({ message: "Internal Error" });
  }
});

app.delete("/api/products/:id", async (req, res) => {
  try {
    await dbReady;
    await pool.query(`DELETE FROM aq_products WHERE id=$1`, [Number(req.params.id)]);
    return res.json({ ok: true });
  } catch (e) {
    console.error("Failed to delete product:", e.message);
    return res.status(500).json({ message: "Internal Error" });
  }
});

/* ── Admin-created Quotations ─────────────────────────────── */

async function insertAdminQuotationItems(client, quotationId, items) {
  if (!Array.isArray(items) || items.length === 0) return;
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index] ?? {};
    const itemId = `aqi-${Date.now()}-${Math.random().toString(36).slice(2, 9)}-${index}`;
    await client.query(
      `INSERT INTO admin_quotation_items (id, quotation_id, name, description, category, quantity, unit, price, total, image_url, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [itemId, quotationId, item.name ?? "", item.description ?? "", item.category ?? "", item.quantity ?? 1,
       item.unit ?? "وحدة", item.price ?? 0, item.total ?? 0, item.imageUrl ?? item.image_url ?? null, index],
    );
  }
}

app.get("/api/admin-quotations", async (req, res) => {
  if (!requireSession(req, res)) return;
  try {
    await dbReady;
    const trash = req.query.trash === "true";
    const { rows } = await pool.query(
      `SELECT aq.*, json_agg(aqi.* ORDER BY aqi.sort_order) FILTER (WHERE aqi.id IS NOT NULL) AS items
       FROM admin_quotations aq
       LEFT JOIN admin_quotation_items aqi ON aqi.quotation_id = aq.id
       WHERE ${trash ? "aq.deleted_at IS NOT NULL" : "aq.deleted_at IS NULL"}
       GROUP BY aq.id
       ORDER BY aq.created_at DESC`,
    );
    return res.json({ quotations: rows });
  } catch (e) {
    console.error("Failed to load admin quotations:", e.message);
    return res.status(500).json({ error: "Failed to load quotations" });
  }
});

app.post("/api/admin-quotations", async (req, res) => {
  if (!requireSession(req, res)) return;
  let client;
  try {
    await dbReady;
    const { quotationNumber, customerName, date, notes, grandTotal, discountValue, taxRate, details, items } = req.body ?? {};
    if (!customerName || !quotationNumber) return res.status(400).json({ error: "اسم العميل ورقم العرض مطلوبان" });
    if (rejectEmbeddedImageData(res, items)) return;
    const id = `aq-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    client = await pool.connect();
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO admin_quotations (id, quotation_number, customer_name, date, notes, grand_total, discount_value, tax_rate, details)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [id, quotationNumber, customerName, date ?? new Date().toISOString().slice(0, 10), notes ?? "", grandTotal ?? 0,
       discountValue ?? 0, taxRate ?? 0, JSON.stringify(details ?? {})],
    );
    await insertAdminQuotationItems(client, id, items);
    await client.query("COMMIT");
    return res.status(201).json({ id, ok: true });
  } catch (e) {
    if (client) await client.query("ROLLBACK").catch(() => {});
    console.error("Failed to create admin quotation:", e.message);
    return res.status(500).json({ error: "Failed to save quotation" });
  } finally {
    client?.release();
  }
});

app.put("/api/admin-quotations/:id", async (req, res) => {
  if (!requireSession(req, res)) return;
  let client;
  try {
    await dbReady;
    const { quotationNumber, customerName, date, notes, grandTotal, discountValue, taxRate, details, items } = req.body ?? {};
    if (!customerName || !quotationNumber) return res.status(400).json({ error: "اسم العميل ورقم العرض مطلوبان" });
    if (rejectEmbeddedImageData(res, items)) return;
    client = await pool.connect();
    await client.query("BEGIN");
    const result = await client.query(
      `UPDATE admin_quotations SET quotation_number=$1, customer_name=$2, date=$3, notes=$4, grand_total=$5,
       discount_value=$6, tax_rate=$7, details=$8 WHERE id=$9`,
      [quotationNumber, customerName, date ?? new Date().toISOString().slice(0, 10), notes ?? "", grandTotal ?? 0,
       discountValue ?? 0, taxRate ?? 0, JSON.stringify(details ?? {}), req.params.id],
    );
    if (result.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Not found" });
    }
    await client.query(`DELETE FROM admin_quotation_items WHERE quotation_id=$1`, [req.params.id]);
    await insertAdminQuotationItems(client, req.params.id, items);
    await client.query("COMMIT");
    return res.json({ ok: true });
  } catch (e) {
    if (client) await client.query("ROLLBACK").catch(() => {});
    console.error("Failed to update admin quotation:", e.message);
    return res.status(500).json({ error: "Failed to update quotation" });
  } finally {
    client?.release();
  }
});

app.post("/api/admin-quotations/:id/restore", async (req, res) => {
  if (!requireSession(req, res)) return;
  try {
    await dbReady;
    await pool.query(`UPDATE admin_quotations SET deleted_at = NULL WHERE id = $1`, [req.params.id]);
    return res.json({ ok: true });
  } catch (e) {
    console.error("Failed to restore admin quotation:", e.message);
    return res.status(500).json({ error: "Failed to restore quotation" });
  }
});

app.delete("/api/admin-quotations/:id", async (req, res) => {
  if (!requireSession(req, res)) return;
  try {
    await dbReady;
    if (req.query.permanent === "true") {
      await pool.query(`DELETE FROM admin_quotations WHERE id = $1`, [req.params.id]);
    } else {
      await pool.query(`UPDATE admin_quotations SET deleted_at = NOW() WHERE id = $1`, [req.params.id]);
    }
    return res.json({ ok: true });
  } catch (e) {
    console.error("Failed to delete admin quotation:", e.message);
    return res.status(500).json({ error: "Failed to delete quotation" });
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

/* ── Official documents and no-header quotations ───────── */

function serializeJsonRecord(row) {
  return {
    id: row.id,
    ...row.data,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function listJsonRecords(table, trash = false) {
  const officialDocument = table === "official_documents";
  const deletedColumn = officialDocument ? ", deleted_at" : "";
  const deletedFilter = officialDocument
    ? (trash ? " WHERE deleted_at IS NOT NULL" : " WHERE deleted_at IS NULL")
    : "";
  const result = await pool.query(
    `SELECT id, data, created_at, updated_at${deletedColumn} FROM ${table}${deletedFilter} ORDER BY updated_at DESC`,
  );
  return result.rows.map((row) => {
    const record = serializeJsonRecord(row);
    if (row.deleted_at !== undefined) record.deletedAt = row.deleted_at;
    return record;
  });
}

async function upsertJsonRecord(table, id, data) {
  const result = await pool.query(
    `INSERT INTO ${table} (id, data) VALUES ($1, $2)
     ON CONFLICT (id) DO UPDATE SET data = $2, updated_at = NOW()
     RETURNING id, data, created_at, updated_at`,
    [id, JSON.stringify(data)],
  );
  return serializeJsonRecord(result.rows[0]);
}

async function deleteJsonRecord(table, id) {
  await pool.query(`DELETE FROM ${table} WHERE id = $1`, [id]);
}

app.get("/api/official-documents", async (req, res) => {
  if (!requireSession(req, res)) return;
  await dbReady;
  try {
    res.json({ records: await listJsonRecords("official_documents", req.query.trash === "1") });
  } catch (e) {
    res.status(500).json({ error: "Failed to load official documents", detail: e.message });
  }
});

app.post("/api/official-documents", async (req, res) => {
  if (!requireSession(req, res)) return;
  await dbReady;
  const { id: incomingId, ...data } = req.body ?? {};
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    res.status(400).json({ error: "Invalid document" });
    return;
  }
  if (rejectEmbeddedImageData(res, data)) return;
  const id = incomingId || `official-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  try {
    res.json({ record: await upsertJsonRecord("official_documents", id, data) });
  } catch (e) {
    res.status(500).json({ error: "Failed to save official document", detail: e.message });
  }
});

app.delete("/api/official-documents/:id", async (req, res) => {
  if (!requireSession(req, res)) return;
  await dbReady;
  try {
    await pool.query(`UPDATE official_documents SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL`, [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: "Failed to move official document to trash", detail: e.message });
  }
});

app.post("/api/official-documents/:id/restore", async (req, res) => {
  if (!requireSession(req, res)) return;
  await dbReady;
  try {
    await pool.query(`UPDATE official_documents SET deleted_at = NULL WHERE id = $1`, [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: "Failed to restore official document", detail: e.message });
  }
});

app.delete("/api/official-documents/:id/permanent", async (req, res) => {
  if (!requireSession(req, res)) return;
  await dbReady;
  try {
    await pool.query(`DELETE FROM official_documents WHERE id = $1 AND deleted_at IS NOT NULL`, [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: "Failed to permanently delete official document", detail: e.message });
  }
});

app.get("/api/no-header-quotations", async (req, res) => {
  if (!requireSession(req, res)) return;
  await dbReady;
  try {
    res.json({ records: await listJsonRecords("no_header_quotations") });
  } catch (e) {
    res.status(500).json({ error: "Failed to load no-header quotations", detail: e.message });
  }
});

app.post("/api/no-header-quotations", async (req, res) => {
  if (!requireSession(req, res)) return;
  await dbReady;
  const { id: incomingId, ...data } = req.body ?? {};
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    res.status(400).json({ error: "Invalid quotation" });
    return;
  }
  if (rejectEmbeddedImageData(res, data)) return;
  const id = incomingId || `no-header-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  try {
    res.json({ record: await upsertJsonRecord("no_header_quotations", id, data) });
  } catch (e) {
    res.status(500).json({ error: "Failed to save no-header quotation", detail: e.message });
  }
});

app.delete("/api/no-header-quotations/:id", async (req, res) => {
  if (!requireSession(req, res)) return;
  await dbReady;
  try {
    await deleteJsonRecord("no_header_quotations", req.params.id);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: "Failed to delete no-header quotation", detail: e.message });
  }
});

app.get("/api/export-invoices", async (req, res) => {
  if (!requireSession(req, res)) return;
  await dbReady;
  try {
    res.json({ records: await listJsonRecords("export_invoices") });
  } catch (e) {
    res.status(500).json({ error: "Failed to load export invoices", detail: e.message });
  }
});

app.post("/api/export-invoices", async (req, res) => {
  if (!requireSession(req, res)) return;
  await dbReady;
  const { id: incomingId, ...data } = req.body ?? {};
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    res.status(400).json({ error: "Invalid export invoice" });
    return;
  }
  if (rejectEmbeddedImageData(res, data)) return;
  const id = incomingId || `export-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  try {
    res.json({ record: await upsertJsonRecord("export_invoices", id, data) });
  } catch (e) {
    res.status(500).json({ error: "Failed to save export invoice", detail: e.message });
  }
});

app.delete("/api/export-invoices/:id", async (req, res) => {
  if (!requireSession(req, res)) return;
  await dbReady;
  try {
    await deleteJsonRecord("export_invoices", req.params.id);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: "Failed to delete export invoice", detail: e.message });
  }
});

/* ── Images ─────────────────────────────────────────────── */

async function saveImageRecord(buffer, mimeType) {
  if (!mimeType.startsWith("image/")) throw new Error("Only image files are allowed");
  if (buffer.length === 0 || buffer.length > 3 * 1024 * 1024) {
    throw new Error("Image must be between 1 byte and 3MB");
  }

  const sha256 = crypto.createHash("sha256").update(buffer).digest("hex");
  const existing = await pool.query(
    `SELECT id, mime_type, size_bytes FROM images
     WHERE sha256 = $1 AND data_bytes IS NOT NULL
     ORDER BY created_at ASC LIMIT 1`,
    [sha256],
  );
  if (existing.rows.length > 0) {
    const row = existing.rows[0];
    return {
      id: row.id,
      url: `/api/images/${encodeURIComponent(row.id)}`,
      sha256,
      sizeBytes: row.size_bytes ?? buffer.length,
      mimeType: row.mime_type || mimeType,
    };
  }

  const id = `img-${sha256.slice(0, 24)}`;
  await pool.query(
    `INSERT INTO images (id, data, data_bytes, mime_type, sha256, size_bytes)
     VALUES ($1, '', $2, $3, $4, $5)
     ON CONFLICT (id) DO UPDATE SET
       data_bytes = EXCLUDED.data_bytes,
       mime_type = EXCLUDED.mime_type,
       sha256 = EXCLUDED.sha256,
       size_bytes = EXCLUDED.size_bytes`,
    [id, buffer, mimeType, sha256, buffer.length],
  );
  return { id, url: `/api/images/${encodeURIComponent(id)}`, sha256, sizeBytes: buffer.length, mimeType };
}

async function migrateLegacyImages(limit = 50) {
  const legacy = await pool.query(
    `SELECT id, data, mime_type FROM images
     WHERE data_bytes IS NULL AND data <> ''
     ORDER BY created_at ASC LIMIT $1`,
    [limit],
  );
  const migratedRows = await Promise.all(legacy.rows.map(async (row) => {
    try {
      const buffer = Buffer.from(row.data, "base64");
      if (buffer.length === 0) throw new Error("Empty legacy image");
      const sha256 = crypto.createHash("sha256").update(buffer).digest("hex");
      await pool.query(
        `UPDATE images SET data = '', data_bytes = $2, mime_type = $3, sha256 = $4, size_bytes = $5 WHERE id = $1`,
        [row.id, buffer, row.mime_type || "image/jpeg", sha256, buffer.length],
      );
      return 1;
    } catch (error) {
      console.warn("[images] legacy migration skipped", row.id, error);
      return 0;
    }
  }));
  const migrated = migratedRows.reduce((total, value) => total + value, 0);
  const remainingResult = await pool.query(
    `SELECT COUNT(*)::int AS count FROM images WHERE data_bytes IS NULL AND data <> ''`,
  );
  return { migrated, remaining: Number(remainingResult.rows[0]?.count ?? 0) };
}

async function migrateEmbeddedQuotationImages(limit = 100) {
  const result = await pool.query(
    `SELECT id, image_url FROM admin_quotation_items
     WHERE image_url LIKE 'data:image/%' ORDER BY id LIMIT $1`,
    [limit],
  );
  let migrated = 0;
  for (const row of result.rows) {
    try {
      const match = String(row.image_url).match(/^data:([^;]+);base64,(.+)$/s);
      if (!match) continue;
      const stored = await saveImageRecord(Buffer.from(match[2], "base64"), match[1]);
      await pool.query(`UPDATE admin_quotation_items SET image_url = $2 WHERE id = $1`, [row.id, stored.url]);
      migrated += 1;
    } catch (error) {
      console.warn("[images] quotation migration skipped", row.id, error);
    }
  }
  const remaining = await pool.query(
    `SELECT COUNT(*)::int AS count FROM admin_quotation_items WHERE image_url LIKE 'data:image/%'`,
  );
  return { migrated, remaining: Number(remaining.rows[0]?.count ?? 0) };
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
    const stored = await saveImageRecord(Buffer.from(buffer), mime);
    res.json({ id: stored.id, url: `/api/images/${encodeURIComponent(stored.id)}` });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
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
    const stored = await saveImageRecord(Buffer.from(raw, "base64"), mime);
    res.json({ id: stored.id, url: `/api/images/${encodeURIComponent(stored.id)}` });
  } catch (error) {
    res.status(500).json({ error: "Failed to save image" });
  }
});

app.get("/api/images/:id", async (req, res) => {
  const { id } = req.params;
  try {
    await dbReady;
    const result = await pool.query(
      `SELECT data, data_bytes, mime_type FROM images WHERE id = $1`,
      [id]
    );
    if (result.rows.length === 0) { res.status(404).end(); return; }
    const { data, data_bytes, mime_type } = result.rows[0];
    const buf = data_bytes?.length ? data_bytes : (data ? Buffer.from(data, "base64") : null);
    if (!buf?.length) { res.status(404).end(); return; }
    res.setHeader("Content-Type", mime_type);
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.end(buf);
  } catch {
    res.status(500).end();
  }
});

app.post("/api/images/migrate-legacy", async (req, res) => {
  if (!requireSession(req, res)) return;
  try {
    await dbReady;
    const legacy = await migrateLegacyImages();
    const quotations = await migrateEmbeddedQuotationImages();
    res.json({
      migrated: legacy.migrated + quotations.migrated,
      remaining: legacy.remaining + quotations.remaining,
      quotationImagesMigrated: quotations.migrated,
    });
  } catch (error) {
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
