import { Router, type IRouter, type Request, type Response } from "express";
import { db, siteConfigTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

function requireAdminToken(req: Request, res: Response): boolean {
  const token = process.env["ADMIN_TOKEN"];
  if (!token) {
    res.status(500).json({ error: "Server misconfiguration: ADMIN_TOKEN not set" });
    return false;
  }
  const provided = req.headers["x-admin-token"];
  if (!provided || provided !== token) {
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
  } catch (_err) {
    res.status(500).json({ error: "Failed to load site data" });
  }
});

router.put("/site-data", async (req: Request, res: Response) => {
  if (!requireAdminToken(req, res)) return;

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
  } catch (_err) {
    res.status(500).json({ error: "Failed to save site data" });
  }
});

export default router;
