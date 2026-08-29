import { Router } from "express";
import pg from "pg";

const { Pool } = pg;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const dbReady = (async () => {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS aq_quotations (
        id SERIAL PRIMARY KEY,
        quotation_number TEXT NOT NULL,
        customer_name TEXT NOT NULL,
        date TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        notes TEXT,
        grand_total NUMERIC NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        deleted_at TIMESTAMPTZ
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS aq_quotation_items (
        id SERIAL PRIMARY KEY,
        quotation_id INTEGER NOT NULL REFERENCES aq_quotations(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        description TEXT,
        category TEXT,
        quantity INTEGER NOT NULL,
        price NUMERIC NOT NULL,
        total NUMERIC NOT NULL,
        image_url TEXT
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS aq_products (
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
      )
    `);
  } finally {
    client.release();
  }
})().catch(e => console.error("DB init error:", e));

const router = Router();

async function getQuotationWithItems(id: number) {
  const { rows: [q] } = await pool.query(`SELECT * FROM aq_quotations WHERE id = $1`, [id]);
  if (!q) return null;
  const { rows: items } = await pool.query(
    `SELECT * FROM aq_quotation_items WHERE quotation_id = $1 ORDER BY id`, [id]
  );
  return { ...q, items };
}

router.get("/quotations", async (_req, res) => {
  try {
    await dbReady;
    const { rows } = await pool.query(
      `SELECT * FROM aq_quotations WHERE deleted_at IS NULL ORDER BY created_at DESC`
    );
    const result = [];
    for (const q of rows) {
      const { rows: items } = await pool.query(
        `SELECT * FROM aq_quotation_items WHERE quotation_id = $1 ORDER BY id`, [q.id]
      );
      result.push({ ...q, items });
    }
    return res.json(result);
  } catch (e) {
    return res.status(500).json({ message: "Internal Error" });
  }
});

router.get("/quotations/:id", async (req, res) => {
  try {
    await dbReady;
    const q = await getQuotationWithItems(Number(req.params.id));
    if (!q) return res.status(404).json({ message: "Not found" });
    return res.json(q);
  } catch (e) {
    return res.status(500).json({ message: "Internal Error" });
  }
});

router.post("/quotations", async (req, res) => {
  try {
    await dbReady;
    const { quotationNumber, customerName, date, notes, grandTotal, items = [] } = req.body;
    if (!quotationNumber || !customerName || grandTotal === undefined || grandTotal === null || grandTotal === '') {
      return res.status(400).json({ message: "Missing required fields" });
    }
    const { rows: [newQ] } = await pool.query(
      `INSERT INTO aq_quotations (quotation_number, customer_name, date, notes, grand_total)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [quotationNumber, customerName, date ? new Date(date) : new Date(), notes ?? null, grandTotal]
    );
    for (const item of items) {
      await pool.query(
        `INSERT INTO aq_quotation_items (quotation_id, name, description, category, quantity, price, total, image_url)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [newQ.id, item.name, item.description ?? null, item.category ?? null,
         item.quantity, item.price, item.total, item.imageUrl ?? null]
      );
    }
    const result = await getQuotationWithItems(newQ.id);
    return res.status(201).json(result);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Internal Error" });
  }
});

router.put("/quotations/:id", async (req, res) => {
  try {
    await dbReady;
    const id = Number(req.params.id);
    const { quotationNumber, customerName, date, notes, grandTotal, items = [] } = req.body;
    const { rows: [updated] } = await pool.query(
      `UPDATE aq_quotations SET quotation_number=$1, customer_name=$2, date=$3, notes=$4, grand_total=$5
       WHERE id=$6 RETURNING *`,
      [quotationNumber, customerName, date ? new Date(date) : new Date(), notes ?? null, grandTotal, id]
    );
    if (!updated) return res.status(404).json({ message: "Not found" });
    await pool.query(`DELETE FROM aq_quotation_items WHERE quotation_id=$1`, [id]);
    for (const item of items) {
      await pool.query(
        `INSERT INTO aq_quotation_items (quotation_id, name, description, category, quantity, price, total, image_url)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [id, item.name, item.description ?? null, item.category ?? null,
         item.quantity, item.price, item.total, item.imageUrl ?? null]
      );
    }
    const result = await getQuotationWithItems(id);
    return res.json(result);
  } catch (e) {
    return res.status(500).json({ message: "Internal Error" });
  }
});

router.delete("/quotations/:id", async (req, res) => {
  try {
    await dbReady;
    await pool.query(`UPDATE aq_quotations SET deleted_at=NOW() WHERE id=$1`, [Number(req.params.id)]);
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ message: "Internal Error" });
  }
});

router.get("/products", async (_req, res) => {
  try {
    await dbReady;
    const { rows } = await pool.query(`SELECT * FROM aq_products ORDER BY sort_order, created_at`);
    return res.json(rows);
  } catch (e) {
    return res.status(500).json({ message: "Internal Error" });
  }
});

router.post("/products", async (req, res) => {
  try {
    await dbReady;
    const { name, description, unit, price, stock, imageUrl, category, sortOrder } = req.body;
    if (!name) return res.status(400).json({ message: "name is required" });
    const { rows: [p] } = await pool.query(
      `INSERT INTO aq_products (name, description, unit, price, stock, image_url, category, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [name, description ?? null, unit ?? 'وحدة', price ?? '0',
       stock ?? 0, imageUrl ?? null, category ?? null, sortOrder ?? 0]
    );
    return res.status(201).json(p);
  } catch (e) {
    return res.status(500).json({ message: "Internal Error" });
  }
});

router.put("/products/:id", async (req, res) => {
  try {
    await dbReady;
    const { name, description, unit, price, imageUrl, category } = req.body;
    const { rows: [p] } = await pool.query(
      `UPDATE aq_products SET
        name = COALESCE($1, name),
        description = COALESCE($2, description),
        unit = COALESCE($3, unit),
        price = COALESCE($4, price),
        image_url = COALESCE($5, image_url),
        category = COALESCE($6, category)
       WHERE id=$7 RETURNING *`,
      [name ?? null, description ?? null, unit ?? null,
       price ?? null, imageUrl ?? null, category ?? null, Number(req.params.id)]
    );
    if (!p) return res.status(404).json({ message: "Not found" });
    return res.json(p);
  } catch (e) {
    return res.status(500).json({ message: "Internal Error" });
  }
});

router.delete("/products/:id", async (req, res) => {
  try {
    await dbReady;
    await pool.query(`DELETE FROM aq_products WHERE id=$1`, [Number(req.params.id)]);
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ message: "Internal Error" });
  }
});

router.post("/parse-text", async (req, res) => {
  try {
    await dbReady;
    const text: string = req.body?.text || '';
    if (!text) return res.status(400).json({ message: "text is required" });

    const numberPattern = /\d+(?:[.,]\d+)*/g;

    const items = text
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .map(trimmedLine => {
        let name = '', description = '', category = '', qty = 1, price = 0;

        const tabCols = trimmedLine.split('\t').map(c => c.trim()).filter(c => c);
        if (tabCols.length >= 3) {
          if (tabCols.length >= 5) {
            name = tabCols[0] || '';
            description = tabCols[1] || '';
            category = tabCols[2] || '';
            const qm = tabCols[3].match(numberPattern);
            if (qm) qty = parseFloat(qm[0].replace(',', '.'));
            const pm = tabCols[4].match(numberPattern);
            if (pm) price = parseFloat(pm[0].replace(',', '.'));
          } else if (tabCols.length === 4) {
            name = tabCols[0] || '';
            description = tabCols[1] || '';
            const qm = tabCols[2].match(numberPattern);
            if (qm) qty = parseFloat(qm[0].replace(',', '.'));
            const pm = tabCols[3].match(numberPattern);
            if (pm) price = parseFloat(pm[0].replace(',', '.'));
          } else {
            name = tabCols[0] || '';
            const qm = tabCols[1].match(numberPattern);
            if (qm) qty = parseFloat(qm[0].replace(',', '.'));
            const pm = tabCols[2].match(numberPattern);
            if (pm) price = parseFloat(pm[0].replace(',', '.'));
          }
          if (!name) return null;
          return { name: name.trim(), description: description.trim(), category: category.trim(), quantity: Math.max(qty, 1), price: Math.max(price, 0), total: Math.max(qty, 1) * Math.max(price, 0) };
        }

        const slashParts = trimmedLine.split('/').map(p => p.trim()).filter(p => p);
        if (slashParts.length >= 3) {
          let q2 = 1;
          const qm = slashParts[0].match(numberPattern);
          if (qm) q2 = parseFloat(qm[0].replace(',', '.'));
          const n = slashParts[1] || 'عنصر غير معروف';
          let desc = '', cat = '', pr = 0;
          if (slashParts.length >= 5) {
            desc = slashParts[2] || '';
            cat = slashParts[3] || '';
            const pm = slashParts[4].match(numberPattern);
            if (pm) pr = parseFloat(pm[0].replace(',', '.'));
          } else if (slashParts.length === 4) {
            desc = slashParts[2] || '';
            const pm = slashParts[3].match(numberPattern);
            if (pm) pr = parseFloat(pm[0].replace(',', '.'));
          } else {
            const pm = slashParts[2].match(numberPattern);
            if (pm) pr = parseFloat(pm[0].replace(',', '.'));
          }
          return { name: n.trim() || 'عنصر غير معروف', description: desc.trim(), category: cat.trim(), quantity: Math.max(q2, 1), price: Math.max(pr, 0), total: Math.max(q2, 1) * Math.max(pr, 0) };
        }

        const numbers = trimmedLine.match(numberPattern) || [];
        const normalizedNumbers = numbers.map(n => parseFloat(n.replace(',', '.')));
        const nameText = trimmedLine.replace(numberPattern, '').trim();
        let q3 = 1, p3 = 0;
        if (normalizedNumbers.length >= 2) {
          p3 = normalizedNumbers[normalizedNumbers.length - 1];
          q3 = normalizedNumbers[normalizedNumbers.length - 2];
        } else if (normalizedNumbers.length === 1) {
          p3 = normalizedNumbers[0];
          q3 = 1;
        }
        const finalName = nameText || `منتج #${normalizedNumbers.join('-') || 'unknown'}`;
        return { name: finalName.trim() || 'عنصر غير معروف', description: '', category: '', quantity: Math.max(q3, 1), price: Math.max(p3, 0), total: Math.max(q3, 1) * Math.max(p3, 0) };
      })
      .filter(item => item !== null);

    return res.json({ items });
  } catch (e) {
    return res.status(500).json({ message: "Internal Error" });
  }
});

export default router;
