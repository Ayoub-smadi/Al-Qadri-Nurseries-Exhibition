import type { IncomingMessage, ServerResponse } from "node:http";
import express from "express";
import cors from "cors";
import { Router } from "express";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { pgTable, text, jsonb, timestamp } from "drizzle-orm/pg-core";
import { eq } from "drizzle-orm";
import crypto from "crypto";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set.");
}

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

const siteConfigTable = pgTable("site_config", {
  id: text("id").primaryKey().default("main"),
  data: jsonb("data").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

const adminsTable = pgTable("admins", {
  username: text("username").primaryKey(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const TOKEN_SECRET = crypto.createHash("sha256").update(process.env.DATABASE_URL!).digest();

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

function requireSession(req: express.Request, res: express.Response): boolean {
  const auth = (req.headers["authorization"] ?? "") as string;
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!verifyToken(token)) {
    res.status(403).json({ error: "Forbidden" });
    return false;
  }
  return true;
}

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

const router = Router();

router.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

router.post("/admin/login", async (req, res) => {
  const { username, password } = req.body as { username?: string; password?: string };
  if (!username || !password) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }
  try {
    const rows = await db.select().from(adminsTable).where(eq(adminsTable.username, username));
    if (rows.length === 0 || rows[0].passwordHash !== hashPassword(password)) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }
  } catch {
    res.status(500).json({ error: "Database error" });
    return;
  }
  const token = createToken();
  res.json({ token });
});

router.get("/site-data", async (_req, res) => {
  try {
    const rows = await db.select().from(siteConfigTable).where(eq(siteConfigTable.id, "main"));
    if (rows.length === 0) { res.json({ data: null }); return; }
    res.json({ data: rows[0].data });
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
    await db
      .insert(siteConfigTable)
      .values({ id: "main", data })
      .onConflictDoUpdate({ target: siteConfigTable.id, set: { data, updatedAt: new Date() } });
    res.json({ data });
  } catch {
    res.status(500).json({ error: "Failed to save site data" });
  }
});

app.use("/api", router);

export default function handler(req: IncomingMessage, res: ServerResponse) {
  return app(req as express.Request, res as express.Response);
}
