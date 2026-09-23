import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { and, eq } from "drizzle-orm";
import { db, captainsTable, ordersTable, settlementsTable } from "@workspace/db";
import {
  CreateCaptainSettlementBody, CreateCaptainSettlementParams, CreateCaptainSettlementResponse,
  CreateOrderBody, CreateOrderResponse, GetCaptainFinancialSummaryParams,
  GetCaptainFinancialSummaryResponse, GetDashboardSummaryResponse, GetFinancialReportResponse,
  ListCaptainsResponse, ListOrdersQueryParams, ListOrdersResponse, UpdateOrderStatusBody,
  UpdateOrderStatusParams, UpdateOrderStatusResponse,
} from "@workspace/api-zod";
import { COMMISSION_RATE, ensureSeedData, getAllCaptainStats, getCaptainStats, getOrders, isSameDay, isSameMonth } from "../lib/eltizam";

const router: IRouter = Router();
const previewOnly = (_req: Request, res: Response, next: NextFunction): void => {
  if (process.env.NODE_ENV === "production") {
    res.status(403).json({ error: "This preview-only operations API is disabled in production until authentication is implemented." });
    return;
  }
  next();
};
const recentRequests = new Map<string, number>();
router.post("/orders", (req, res, next) => {
  if (process.env.NODE_ENV === "production") {
    res.status(403).json({ error: "Public order creation is disabled in production until authentication and abuse protection are implemented." });
    return;
  }
  const key = req.ip ?? "unknown";
  const now = Date.now(); const previous = recentRequests.get(key) ?? 0;
  if (now - previous < 10_000) { res.status(429).json({ error: "Please wait before creating another order." }); return; }
  recentRequests.set(key, now); next();
}, async (req, res): Promise<void> => {
  const parsed = CreateOrderBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "تحقق من الاسم ورقم الهاتف ومواقع الرحلة." }); return; }
  const [order] = await db.insert(ordersTable).values({
    ...parsed.data, customerName: parsed.data.customerName.trim(), customerPhone: parsed.data.customerPhone.trim(),
    pickup: parsed.data.pickup.trim(), destination: parsed.data.destination.trim(),
    scheduledAt: parsed.data.scheduledAt ?? null, notes: parsed.data.notes?.trim() || null,
  }).returning();
  res.status(201).json(CreateOrderResponse.parse({ ...order, commission: 0, captainName: null }));
});

router.use(previewOnly);
router.get("/orders", async (req, res): Promise<void> => {
  await ensureSeedData();
  const parsed = ListOrdersQueryParams.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const orders = await getOrders(); const filter = parsed.data.filter;
  const filtered = orders.filter((order) => {
    const created = order.createdAt instanceof Date ? order.createdAt : null;
    const completed = order.completedAt instanceof Date ? order.completedAt : null;
    if (filter === "today") return isSameDay(completed) || isSameDay(created);
    if (filter === "scheduled") return Boolean(order.scheduledAt) && order.status !== "completed";
    if (filter === "recurring") return typeof order.notes === "string" && order.notes.includes("شهري");
    if (filter === "completed") return order.status === "completed"; return true;
  });
  res.json(ListOrdersResponse.parse(filtered));
});

router.patch("/orders/:id/status", async (req, res): Promise<void> => {
  await ensureSeedData(); const params = UpdateOrderStatusParams.safeParse(req.params);
  const body = UpdateOrderStatusBody.safeParse(req.body);
  if (!params.success) { res.status(400).json({ error: "رقم الطلب غير صالح." }); return; }
  if (!body.success) { res.status(400).json({ error: "بيانات تحديث الطلب غير صالحة." }); return; }
  const [current] = await db.select().from(ordersTable).where(eq(ordersTable.id, params.data.id));
  if (!current) { res.status(404).json({ error: "Order not found" }); return; }
  const allowed: Record<string, string[]> = { pending: ["claimed"], claimed: ["in_progress"], in_progress: ["completed"], completed: [] };
  if (!allowed[current.status]?.includes(body.data.status)) { res.status(409).json({ error: "لا يمكن نقل الطلب إلى هذه الحالة." }); return; }
  const captainId = body.data.captainId ?? current.captainId;
  if (!captainId) { res.status(400).json({ error: "يجب اختيار كابتن لهذا الطلب." }); return; }
  const [captain] = await db.select({ id: captainsTable.id }).from(captainsTable).where(eq(captainsTable.id, captainId));
  if (!captain) { res.status(404).json({ error: "الكابتن المحدد غير موجود." }); return; }
  const [updated] = await db.update(ordersTable).set({
    status: body.data.status, captainId,
    commission: body.data.status === "completed" && current.status !== "completed" ? "0.50" : current.commission,
    completedAt: body.data.status === "completed" && current.status !== "completed" ? new Date() : current.completedAt,
  }).where(and(eq(ordersTable.id, params.data.id), eq(ordersTable.status, current.status))).returning();
  if (!updated) { res.status(409).json({ error: "تم تحديث الطلب من مستخدم آخر. حدّث القائمة وحاول مجددًا." }); return; }
  const [withCaptain] = await db.select({ captainName: captainsTable.name }).from(captainsTable).where(eq(captainsTable.id, updated.captainId ?? -1));
  res.json(UpdateOrderStatusResponse.parse({ ...updated, commission: Number(updated.commission), captainName: withCaptain?.captainName ?? null }));
});

router.get("/dashboard", async (_req, res): Promise<void> => {
  await ensureSeedData(); const orders = await getOrders(); const stats = await getAllCaptainStats();
  res.json(GetDashboardSummaryResponse.parse({ activeOrders: orders.filter((o) => o.status !== "completed").length,
    completedToday: orders.filter((o) => o.status === "completed" && isSameDay(o.completedAt instanceof Date ? o.completedAt : null)).length,
    totalCaptains: stats.length, pendingBalance: stats.reduce((s, c) => s + c.balance, 0), commissionRate: COMMISSION_RATE, recentOrders: orders.slice(-5).reverse() }));
});
router.get("/captains", async (_req, res): Promise<void> => { await ensureSeedData(); res.json(ListCaptainsResponse.parse(await getAllCaptainStats())); });
router.get("/financials", async (_req, res): Promise<void> => {
  await ensureSeedData(); const captains = await getAllCaptainStats();
  const totalCompletedTrips = captains.reduce((s, c) => s + c.totalTrips, 0);
  const totalAccrued = captains.reduce((s, c) => s + c.totalCommission, 0); const totalPaid = captains.reduce((s, c) => s + c.totalPaid, 0);
  res.json(GetFinancialReportResponse.parse({ commissionRate: COMMISSION_RATE, totalCompletedTrips, totalAccrued, totalPaid, totalOutstanding: Math.max(0, totalAccrued - totalPaid), captains }));
});
router.get("/captains/:id/financial-summary", async (req, res): Promise<void> => {
  await ensureSeedData(); const params = GetCaptainFinancialSummaryParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "رقم الكابتن غير صالح." }); return; }
  const captain = await getCaptainStats(params.data.id); if (!captain) { res.status(404).json({ error: "Captain not found" }); return; }
  const completed = await db.select().from(ordersTable).where(and(eq(ordersTable.captainId, captain.id), eq(ordersTable.status, "completed")));
  const settlements = await db.select().from(settlementsTable).where(eq(settlementsTable.captainId, captain.id));
  res.json(GetCaptainFinancialSummaryResponse.parse({ captain, tripsToday: completed.filter((o) => isSameDay(o.completedAt)).length,
    tripsThisMonth: completed.filter((o) => isSameMonth(o.completedAt)).length, pendingCommission: captain.balance,
    recentSettlements: settlements.slice(-5).reverse().map((s) => ({ ...s, amount: Number(s.amount), note: s.note ?? null })) }));
});
router.post("/captains/:id/settlements", async (req, res): Promise<void> => {
  await ensureSeedData(); const params = CreateCaptainSettlementParams.safeParse(req.params); const body = CreateCaptainSettlementBody.safeParse(req.body);
  if (!params.success) { res.status(400).json({ error: "رقم الكابتن غير صالح." }); return; }
  if (!body.success) { res.status(400).json({ error: "قيمة التسوية أو الملاحظة غير صالحة." }); return; }
  const captain = await getCaptainStats(params.data.id); if (!captain) { res.status(404).json({ error: "Captain not found" }); return; }
  if (body.data.amount > captain.balance + 0.001) { res.status(400).json({ error: "Settlement exceeds the captain outstanding balance" }); return; }
  const [settlement] = await db.insert(settlementsTable).values({ captainId: captain.id, amount: body.data.amount.toFixed(2), note: body.data.note?.trim() || null }).returning();
  res.status(201).json(CreateCaptainSettlementResponse.parse({ ...settlement, amount: Number(settlement.amount), note: settlement.note ?? null }));
});
export default router;