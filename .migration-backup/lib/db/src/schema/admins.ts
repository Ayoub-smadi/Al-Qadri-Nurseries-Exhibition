import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const adminsTable = pgTable("admins", {
  username: text("username").primaryKey(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
