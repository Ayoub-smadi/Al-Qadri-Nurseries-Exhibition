import { pgTable, text, jsonb, timestamp } from "drizzle-orm/pg-core";

export const siteConfigTable = pgTable("site_config", {
  id: text("id").primaryKey().default("main"),
  data: jsonb("data").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
