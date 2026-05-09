import { Router, type IRouter, type Request, type Response } from "express";
import { db, siteConfigTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

router.get("/site-data", async (_req: Request, res: Response) => {
  try {
    const rows = await db.select().from(siteConfigTable).where(eq(siteConfigTable.id, "main"));
    if (rows.length === 0) {
      res.json({ data: null });
      return;
    }
    res.json({ data: rows[0].data });
  } catch (err) {
    res.status(500).json({ error: "Failed to load site data" });
  }
});

router.put("/site-data", async (req: Request, res: Response) => {
  const { data } = req.body;
  if (!data || typeof data !== "object") {
    res.status(400).json({ error: "Invalid data" });
    return;
  }
  try {
    await db
      .insert(siteConfigTable)
      .values({ id: "main", data })
      .onConflictDoUpdate({ target: siteConfigTable.id, set: { data, updatedAt: new Date() } });
    res.json({ data });
  } catch (err) {
    res.status(500).json({ error: "Failed to save site data" });
  }
});

export default router;
