import { and, asc, eq } from "drizzle-orm";
import { db, captainsTable, ordersTable, settlementsTable } from "@workspace/db";

export const COMMISSION_RATE = 0.5;

const toNumber = (value: string | number | null | undefined): number =>
  Number(value ?? 0);

export type CaptainWithStats = {
  id: number;
  name: string;
  phone: string;
  status: "online" | "offline";
  totalTrips: number;
  totalCommission: number;
  totalPaid: number;
  balance: number;
};

export async function ensureSeedData(): Promise<void> {
  const [captainCount] = await db
    .select({ count: captainsTable.id })
    .from(captainsTable)
    .limit(1);

  if (captainCount) return;

  const [sami, layla, omar] = await db
    .insert(captainsTable)
    .values([
      { name: "سامي الخطيب", phone: "079 555 1020", status: "online" },
      { name: "ليلى العياصرة", phone: "078 441 2866", status: "online" },
      { name: "عمر الزعبي", phone: "077 923 7014", status: "offline" },
    ])
    .returning();

  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const monthStart = new Date(now);
  monthStart.setDate(2);

  await db.insert(ordersTable).values([
    {
      type: "ride",
      customerName: "رنا حداد",
      customerPhone: "079 663 1240",
      pickup: "الدوار السابع",
      destination: "عبدون",
      status: "completed",
      captainId: sami.id,
      commission: "0.50",
      createdAt: now,
      completedAt: now,
      notes: "الراكبة بانتظار الاتصال",
    },
    {
      type: "delivery",
      customerName: "مخبز رغدان",
      customerPhone: "06 585 2901",
      pickup: "شارع الجامعة",
      destination: "الجبيهة",
      status: "completed",
      captainId: layla.id,
      commission: "0.50",
      createdAt: yesterday,
      completedAt: yesterday,
      notes: "طرد غذائي — تعامل بحذر",
    },
    {
      type: "ride",
      customerName: "محمود العبد",
      customerPhone: "079 321 7702",
      pickup: "طبربور",
      destination: "الشميساني",
      status: "in_progress",
      captainId: sami.id,
      commission: "0.00",
      createdAt: now,
    },
    {
      type: "delivery",
      customerName: "صيدلية الحياة",
      customerPhone: "078 220 9911",
      pickup: "الرابية",
      destination: "تلاع العلي",
      status: "pending",
      commission: "0.00",
      createdAt: now,
    },
    {
      type: "ride",
      customerName: "تالا نصار",
      customerPhone: "079 889 3412",
      pickup: "الدوار الأول",
      destination: "ماركا",
      status: "completed",
      captainId: omar.id,
      commission: "0.50",
      createdAt: monthStart,
      completedAt: monthStart,
    },
  ]);

  await db.insert(settlementsTable).values({
    captainId: sami.id,
    amount: "0.50",
    note: "تسوية أسبوعية",
  });
}

export async function getOrders(): Promise<Array<Record<string, unknown>>> {
  const rows = await db
    .select({ order: ordersTable, captainName: captainsTable.name })
    .from(ordersTable)
    .leftJoin(captainsTable, eq(ordersTable.captainId, captainsTable.id))
    .orderBy(asc(ordersTable.createdAt));

  return rows.map(({ order, captainName }) => ({
    ...order,
    commission: toNumber(order.commission),
    captainName,
  }));
}

export async function getCaptainStats(captainId: number): Promise<CaptainWithStats | null> {
  const [captain] = await db
    .select()
    .from(captainsTable)
    .where(eq(captainsTable.id, captainId));
  if (!captain) return null;

  const completed = await db
    .select()
    .from(ordersTable)
    .where(and(eq(ordersTable.captainId, captainId), eq(ordersTable.status, "completed")));
  const settlements = await db
    .select()
    .from(settlementsTable)
    .where(eq(settlementsTable.captainId, captainId));

  const totalCommission = completed.reduce((sum, order) => sum + toNumber(order.commission), 0);
  const totalPaid = settlements.reduce((sum, settlement) => sum + toNumber(settlement.amount), 0);

  return {
    id: captain.id,
    name: captain.name,
    phone: captain.phone,
    status: captain.status === "online" ? "online" : "offline",
    totalTrips: completed.length,
    totalCommission,
    totalPaid,
    balance: Math.max(0, totalCommission - totalPaid),
  };
}

export async function getAllCaptainStats(): Promise<CaptainWithStats[]> {
  const captains = await db.select().from(captainsTable).orderBy(asc(captainsTable.id));
  const stats = await Promise.all(captains.map((captain) => getCaptainStats(captain.id)));
  return stats.filter((captain): captain is CaptainWithStats => captain !== null);
}

export function isSameDay(left: Date | null, right = new Date()): boolean {
  if (!left) return false;
  return left.toDateString() === right.toDateString();
}

export function isSameMonth(left: Date | null, right = new Date()): boolean {
  if (!left) return false;
  return left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth();
}