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

export const deliveriesTable = pgTable("deliveries", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => usersTable.id),
  carrier: text("carrier").notNull(),
  trackingNumber: text("tracking_number").notNull(),
  description: text("description"),
  status: text("status").notNull().default("pending"),
  estimatedDelivery: text("estimated_delivery"),
  lastLocation: text("last_location"),
  deliveryModeActive: boolean("delivery_mode_active").notNull().default(false),
  accessCode: text("access_code"),
  codeStatus: text("code_status").notNull().default("none"),
  codeExpires: timestamp("code_expires", { withTimezone: true }),
  codeSingleUse: boolean("code_single_use").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertDeliverySchema = createInsertSchema(deliveriesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertDelivery = z.infer<typeof insertDeliverySchema>;
export type Delivery = typeof deliveriesTable.$inferSelect;
