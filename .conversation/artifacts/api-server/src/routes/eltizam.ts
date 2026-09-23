import { Router, type IRouter } from "express";
import { and, eq } from "drizzle-orm";
import { db, captainsTable, ordersTable, settlementsTable } from "@workspace/db";
import {
  CreateCaptainSettlementBody,
  CreateCaptainSettlementParams,
  CreateCaptainSettlementResponse,
  CreateOrderBody,
  CreateOrderResponse,
  GetCaptainFinancialSummaryParams,
  GetCaptainFinancialSummaryResponse,
  GetDashboardSummaryResponse,
  GetFinancialReportResponse,
  ListCaptainsResponse,
  ListOrdersQueryParams,
  ListOrdersResponse,
  UpdateOrderStatusBody,
  UpdateOrderStatusParams,
  UpdateOrderStatusResponse,
} from "@workspace/api-zod";
import {
  COMMISSION_RATE,
  ensureSeedData,
  getAllCaptainStats,
  getCaptainStats,
  getOrders,
  isSameDay,
  isSameMonth,
} from "../lib/eltizam";

const router: IRouter = Router();

router.get("/orders", async (req, res): Promise<void> => {
  await ensureSeedData();
  const parsed = ListOrdersQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const orders = await getOrders();
  const filter = parsed.data.filter;
  const filtered = orders.filter((order) => {
    const createdAt = order.createdAt instanceof Date ? order.createdAt : null;
    const completedAt = order.completedAt instanceof Date ? order.completedAt : null;
    if (filter === "today") return isSameDay(completedAt) || isSameDay(createdAt);
    if (filter === "scheduled") return Boolean(order.scheduledAt) && order.status !== "completed";
    if (filter === "recurring") return typeof order.notes === "string" && order.notes.includes("شهري");
    if (filter === "completed") return order.status === "completed";
    return true;
  });

  res.json(ListOrdersResponse.parse(filtered));
});

router.post("/orders", async (req, res): Promise<void> => {
  const parsed = CreateOrderBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "تحقق من الاسم ورقم الهاتف ومواقع الرحلة." });
    return;
  }

  const [order] = await db.insert(ordersTable).values({
    ...parsed.data,
    customerName: parsed.data.customerName.trim(),
    customerPhone: parsed.data.customerPhone.trim(),
    pickup: parsed.data.pickup.trim(),
    destination: parsed.data.destination.trim(),
    scheduledAt: parsed.data.scheduledAt ?? null,
    notes: parsed.data.notes?.trim() || null,
  }).returning();

  res.status(201).json(CreateOrderResponse.parse({ ...order, commission: 0, captainName: null }));
});

router.patch("/orders/:id/status", async (req, res): Promise<void> => {
  await ensureSeedData();
  const params = UpdateOrderStatusParams.safeParse(req.params);
  const body = UpdateOrderStatusBody.safeParse(req.body);
  if (!params.success) {
    res.status(400).json({ error: "رقم الطلب غير صالح." });
    return;
  }
  if (!body.success) {
    res.status(400).json({ error: "بيانات تحديث الطلب غير صالحة." });
    return;
  }

  const [current] = await db.select().from(ordersTable).where(eq(ordersTable.id, params.data.id));
  if (!current) {
    res.status(404).json({ error: "Order not found" });
    return;
  }
  const allowedTransitions: Record<string, string[]> = {
    pending: ["claimed"],
    claimed: ["in_progress"],
    in_progress: ["completed"],
    completed: [],
  };
  if (!allowedTransitions[current.status]?.includes(body.data.status)) {
    res.status(409).json({ error: "لا يمكن نقل الطلب إلى هذه الحالة." });
    return;
  }

  const captainId = body.data.captainId ?? current.captainId;
  if (!captainId) {
    res.status(400).json({ error: "يجب اختيار كابتن لهذا الطلب." });
    return;
  }
  const [captain] = await db.select({ id: captainsTable.id }).from(captainsTable).where(eq(captainsTable.id, captainId));
  if (!captain) {
    res.status(404).json({ error: "الكابتن المحدد غير موجود." });
    return;
  }

  const [updated] = await db.update(ordersTable).set({
    status: body.data.status,
    captainId,
    commission: body.data.status === "completed" && current.status !== "completed" ? "0.50" : current.commission,
    completedAt: body.data.status === "completed" && current.status !== "completed" ? new Date() : current.completedAt,
  }).where(and(eq(ordersTable.id, params.data.id), eq(ordersTable.status, current.status))).returning();

  if (!updated) {
    res.status(409).json({ error: "تم تحديث الطلب من مستخدم آخر. حدّث القائمة وحاول مجددًا." });
    return;
  }

  const [withCaptain] = await db
    .select({ captainName: captainsTable.name })
    .from(captainsTable)
    .where(eq(captainsTable.id, updated.captainId ?? -1));

  res.json(UpdateOrderStatusResponse.parse({
    ...updated,
    commission: Number(updated.commission),
    captainName: withCaptain?.captainName ?? null,
  }));
});

router.get("/dashboard", async (_req, res): Promise<void> => {
  await ensureSeedData();
  const orders = await getOrders();
  const stats = await getAllCaptainStats();
  const activeOrders = orders.filter((order) => order.status !== "completed").length;
  const completedToday = orders.filter((order) => order.status === "completed" && isSameDay(order.completedAt instanceof Date ? order.completedAt : null)).length;
  const pendingBalance = stats.reduce((sum, captain) => sum + captain.balance, 0);

  res.json(GetDashboardSummaryResponse.parse({
    activeOrders,
    completedToday,
    totalCaptains: stats.length,
    pendingBalance,
    commissionRate: COMMISSION_RATE,
    recentOrders: orders.slice(-5).reverse(),
  }));
});

router.get("/captains", async (_req, res): Promise<void> => {
  await ensureSeedData();
  res.json(ListCaptainsResponse.parse(await getAllCaptainStats()));
});

router.get("/financials", async (_req, res): Promise<void> => {
  await ensureSeedData();
  const captains = await getAllCaptainStats();
  const totalCompletedTrips = captains.reduce((sum, captain) => sum + captain.totalTrips, 0);
  const totalAccrued = captains.reduce((sum, captain) => sum + captain.totalCommission, 0);
  const totalPaid = captains.reduce((sum, captain) => sum + captain.totalPaid, 0);
  res.json(GetFinancialReportResponse.parse({
    commissionRate: COMMISSION_RATE,
    totalCompletedTrips,
    totalAccrued,
    totalPaid,
    totalOutstanding: Math.max(0, totalAccrued - totalPaid),
    captains,
  }));
});

router.get("/captains/:id/financial-summary", async (req, res): Promise<void> => {
  await ensureSeedData();
  const params = GetCaptainFinancialSummaryParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "رقم الكابتن غير صالح." });
    return;
  }
  const captain = await getCaptainStats(params.data.id);
  if (!captain) {
    res.status(404).json({ error: "Captain not found" });
    return;
  }

  const completed = await db.select().from(ordersTable).where(and(eq(ordersTable.captainId, captain.id), eq(ordersTable.status, "completed")));
  const recentSettlements = await db.select().from(settlementsTable).where(eq(settlementsTable.captainId, captain.id));
  res.json(GetCaptainFinancialSummaryResponse.parse({
    captain,
    tripsToday: completed.filter((order) => isSameDay(order.completedAt)).length,
    tripsThisMonth: completed.filter((order) => isSameMonth(order.completedAt)).length,
    pendingCommission: captain.balance,
    recentSettlements: recentSettlements.slice(-5).reverse().map((settlement) => ({
      ...settlement,
      amount: Number(settlement.amount),
      note: settlement.note ?? null,
    })),
  }));
});

router.post("/captains/:id/settlements", async (req, res): Promise<void> => {
  await ensureSeedData();
  const params = CreateCaptainSettlementParams.safeParse(req.params);
  const body = CreateCaptainSettlementBody.safeParse(req.body);
  if (!params.success) {
    res.status(400).json({ error: "رقم الكابتن غير صالح." });
    return;
  }
  if (!body.success) {
    res.status(400).json({ error: "قيمة التسوية أو الملاحظة غير صالحة." });
    return;
  }
  const captain = await getCaptainStats(params.data.id);
  if (!captain) {
    res.status(404).json({ error: "Captain not found" });
    return;
  }
  if (body.data.amount > captain.balance + 0.001) {
    res.status(400).json({ error: "Settlement exceeds the captain outstanding balance" });
    return;
  }

  const [settlement] = await db.insert(settlementsTable).values({
    captainId: captain.id,
    amount: body.data.amount.toFixed(2),
    note: body.data.note?.trim() || null,
  }).returning();
  res.status(201).json(CreateCaptainSettlementResponse.parse({
    ...settlement,
    amount: Number(settlement.amount),
    note: settlement.note ?? null,
  }));
});

export default router;