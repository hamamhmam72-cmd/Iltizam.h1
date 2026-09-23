import { and, asc, eq } from "drizzle-orm";
import { db, captainsTable, ordersTable, settlementsTable } from "@workspace/db";

export const COMMISSION_RATE = 0.5;
const toNumber = (value: string | number | null | undefined): number => Number(value ?? 0);
export type CaptainWithStats = {
  id: number; name: string; phone: string; status: "online" | "offline";
  totalTrips: number; totalCommission: number; totalPaid: number; balance: number;
};

export async function ensureSeedData(): Promise<void> {
  const [existing] = await db.select({ id: captainsTable.id }).from(captainsTable).limit(1);
  if (existing) return;
  await db.insert(captainsTable).values([
    { name: "كابتن تجريبي ١", phone: "0000000000", status: "online" },
    { name: "كابتن تجريبي ٢", phone: "0000000000", status: "online" },
  ]);
}

export async function getOrders(): Promise<Array<Record<string, unknown>>> {
  const rows = await db.select({ order: ordersTable, captainName: captainsTable.name })
    .from(ordersTable).leftJoin(captainsTable, eq(ordersTable.captainId, captainsTable.id))
    .orderBy(asc(ordersTable.createdAt));
  return rows.map(({ order, captainName }) => ({ ...order, commission: toNumber(order.commission), captainName }));
}

export async function getCaptainStats(captainId: number): Promise<CaptainWithStats | null> {
  const [captain] = await db.select().from(captainsTable).where(eq(captainsTable.id, captainId));
  if (!captain) return null;
  const completed = await db.select().from(ordersTable)
    .where(and(eq(ordersTable.captainId, captainId), eq(ordersTable.status, "completed")));
  const settlements = await db.select().from(settlementsTable).where(eq(settlementsTable.captainId, captainId));
  const totalCommission = completed.reduce((sum, order) => sum + toNumber(order.commission), 0);
  const totalPaid = settlements.reduce((sum, settlement) => sum + toNumber(settlement.amount), 0);
  return { id: captain.id, name: captain.name, phone: captain.phone,
    status: captain.status === "online" ? "online" : "offline", totalTrips: completed.length,
    totalCommission, totalPaid, balance: Math.max(0, totalCommission - totalPaid) };
}

export async function getAllCaptainStats(): Promise<CaptainWithStats[]> {
  const captains = await db.select().from(captainsTable).orderBy(asc(captainsTable.id));
  const stats = await Promise.all(captains.map((captain) => getCaptainStats(captain.id)));
  return stats.filter((captain): captain is CaptainWithStats => captain !== null);
}
export function isSameDay(left: Date | null, right = new Date()): boolean {
  return !!left && left.toDateString() === right.toDateString();
}
export function isSameMonth(left: Date | null, right = new Date()): boolean {
  return !!left && left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth();
}