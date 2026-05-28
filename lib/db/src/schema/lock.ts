import {
  pgTable,
  text,
  serial,
  timestamp,
  boolean,
  integer,
  unique,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { deliveriesTable } from "./deliveries";

export const lockStatusTable = pgTable(
  "lock_status",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id),
    isLocked: boolean("is_locked").notNull().default(true),
    lastAction: text("last_action").notNull().default("locked"),
    lastActionAt: timestamp("last_action_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deliveryModeEnabled: boolean("delivery_mode_enabled").notNull().default(false),
    deliveryModeTimeout: integer("delivery_mode_timeout").notNull().default(30),
    batteryLevel: integer("battery_level").notNull().default(85),
  },
  (t) => [unique("lock_status_user_unique").on(t.userId)],
);

export const lockEventsTable = pgTable("lock_events", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => usersTable.id),
  action: text("action").notNull(),
  triggeredBy: text("triggered_by").notNull(),
  pinLabel: text("pin_label"),
  codeUsed: text("code_used"),
  deliveryId: integer("delivery_id").references(() => deliveriesTable.id),
  occurredAt: timestamp("occurred_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertLockStatusSchema = createInsertSchema(lockStatusTable).omit({
  id: true,
});
export const insertLockEventSchema = createInsertSchema(lockEventsTable).omit({
  id: true,
  occurredAt: true,
});
export type InsertLockStatus = z.infer<typeof insertLockStatusSchema>;
export type InsertLockEvent = z.infer<typeof insertLockEventSchema>;
export type LockStatus = typeof lockStatusTable.$inferSelect;
export type LockEvent = typeof lockEventsTable.$inferSelect;
