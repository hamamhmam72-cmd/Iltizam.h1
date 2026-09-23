import { createInsertSchema } from "drizzle-zod";
import { index, integer, numeric, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const captainsTable = pgTable("captains", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  status: text("status").notNull().default("offline"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const ordersTable = pgTable("orders", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(),
  customerName: text("customer_name").notNull(),
  customerPhone: text("customer_phone").notNull(),
  pickup: text("pickup").notNull(),
  destination: text("destination").notNull(),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
  notes: text("notes"),
  status: text("status").notNull().default("pending"),
  captainId: integer("captain_id").references(() => captainsTable.id, { onDelete: "set null" }),
  commission: numeric("commission", { precision: 10, scale: 2 }).notNull().default("0.00"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
}, (table) => [
  index("orders_status_idx").on(table.status),
  index("orders_captain_idx").on(table.captainId),
  index("orders_created_at_idx").on(table.createdAt),
]);

export const settlementsTable = pgTable("settlements", {
  id: serial("id").primaryKey(),
  captainId: integer("captain_id").notNull().references(() => captainsTable.id, { onDelete: "restrict" }),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  note: text("note"),
  settledAt: timestamp("settled_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("settlements_captain_idx").on(table.captainId),
  index("settlements_settled_at_idx").on(table.settledAt),
]);

export const insertCaptainSchema = createInsertSchema(captainsTable).omit({ id: true, createdAt: true });
export const insertOrderSchema = createInsertSchema(ordersTable).omit({ id: true, createdAt: true, completedAt: true });
export const insertSettlementSchema = createInsertSchema(settlementsTable).omit({ id: true, settledAt: true });
export type Captain = z.infer<typeof insertCaptainSchema> & { id: number; createdAt: Date };
export type Order = z.infer<typeof insertOrderSchema> & { id: number; createdAt: Date; completedAt: Date | null };
export type Settlement = z.infer<typeof insertSettlementSchema> & { id: number; settledAt: Date };