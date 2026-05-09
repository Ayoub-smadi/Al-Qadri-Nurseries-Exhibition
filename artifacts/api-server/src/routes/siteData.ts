import { Router, type IRouter, type Request, type Response } from "express";
import { db, siteConfigTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import crypto from "crypto";

const router: IRouter = Router();

const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const sessions = new Map<string, number>();

setInterval(() => {
  const now = Date.now();
  for (const [token, expiry] of sessions) {
    if (expiry < now) sessions.delete(token);
  }
}, 60 * 60 * 1000);

router.post("/admin/login", (req: Request, res: Response) => {
  const adminToken = process.env["ADMIN_TOKEN"];
  if (!adminToken) {
    res.status(500).json({ error: "Server misconfiguration: ADMIN_TOKEN not set" });
    return;
  }

  const { password } = req.body as { password?: string };
  if (!password || password !== adminToken) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const token = crypto.randomBytes(32).toString("hex");
  sessions.set(token, Date.now() + SESSION_TTL_MS);
  res.json({ token });
});

function requireSession(req: Request, res: Response): boolean {
  const auth = req.headers["authorization"] ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const expiry = sessions.get(token);
  if (!expiry || expiry < Date.now()) {
    res.status(403).json({ error: "Forbidden" });
    return false;
  }
  return true;
}

router.get("/site-data", async (_req: Request, res: Response) => {
  try {
    const rows = await db.select().from(siteConfigTable).where(eq(siteConfigTable.id, "main"));
    if (rows.length === 0) {
      res.json({ data: null });
      return;
    }
    res.json({ data: rows[0].data });
  } catch {
    res.status(500).json({ error: "Failed to load site data" });
  }
});

router.put("/site-data", async (req: Request, res: Response) => {
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

export default router;
