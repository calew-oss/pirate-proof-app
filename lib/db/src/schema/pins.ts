import {
  pgTable,
  text,
  serial,
  timestamp,
  boolean,
  integer,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const pinsTable = pgTable("pins", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => usersTable.id),
  label: text("label").notNull(),
  pinCode: text("pin_code").notNull(),
  type: text("type").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  usageCount: integer("usage_count").notNull().default(0),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  validFrom: timestamp("valid_from", { withTimezone: true }),
  validUntil: timestamp("valid_until", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertPinSchema = createInsertSchema(pinsTable).omit({
  id: true,
  createdAt: true,
  usageCount: true,
});
export type InsertPin = z.infer<typeof insertPinSchema>;
export type Pin = typeof pinsTable.$inferSelect;
