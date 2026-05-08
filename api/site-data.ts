import { db, siteConfigTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export default async function handler(req: any, res: any) {
  if (req.method === "GET") {
    try {
      const rows = await db.select().from(siteConfigTable).where(eq(siteConfigTable.id, "main"));
      if (rows.length === 0) {
        return res.json({ data: null });
      }
      return res.json({ data: rows[0].data });
    } catch {
      return res.status(500).json({ error: "Failed to load site data" });
    }
  }

  if (req.method === "PUT") {
    const { data } = req.body;
    if (!data || typeof data !== "object") {
      return res.status(400).json({ error: "Invalid data" });
    }
    try {
      await db
        .insert(siteConfigTable)
        .values({ id: "main", data })
        .onConflictDoUpdate({ target: siteConfigTable.id, set: { data, updatedAt: new Date() } });
      return res.json({ data });
    } catch {
      return res.status(500).json({ error: "Failed to save site data" });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
