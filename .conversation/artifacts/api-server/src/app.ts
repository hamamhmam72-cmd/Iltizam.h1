import express, { type ErrorRequestHandler, type Express, type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { randomUUID } from "node:crypto";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();
const publicOrderAttempts = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 60_000;
const MAX_PUBLIC_ORDERS_PER_MINUTE = 8;

function publicOrderRateLimit(req: Request, res: Response, next: NextFunction): void {
  const now = Date.now();
  if (publicOrderAttempts.size > 10_000) {
    for (const [ip, entry] of publicOrderAttempts) {
      if (entry.resetAt <= now) publicOrderAttempts.delete(ip);
    }
  }
  const key = req.ip || "unknown";
  const current = publicOrderAttempts.get(key);
  const bucket = !current || current.resetAt <= now
    ? { count: 0, resetAt: now + WINDOW_MS }
    : current;

  bucket.count += 1;
  publicOrderAttempts.set(key, bucket);
  res.setHeader("RateLimit-Limit", String(MAX_PUBLIC_ORDERS_PER_MINUTE));
  res.setHeader("RateLimit-Remaining", String(Math.max(0, MAX_PUBLIC_ORDERS_PER_MINUTE - bucket.count)));
  res.setHeader("RateLimit-Reset", String(Math.ceil(bucket.resetAt / 1000)));

  if (bucket.count > MAX_PUBLIC_ORDERS_PER_MINUTE) {
    res.setHeader("Retry-After", String(Math.ceil((bucket.resetAt - now) / 1000)));
    res.status(429).json({ error: "طلبات كثيرة خلال وقت قصير. حاول بعد دقيقة." });
    return;
  }
  next();
}

app.use(
  pinoHttp({
    logger,
    genReqId(req, res) {
      const incoming = req.headers["x-request-id"];
      const requestId = typeof incoming === "string" && incoming.length <= 100
        ? incoming
        : randomUUID();
      res.setHeader("X-Request-Id", requestId);
      return requestId;
    },
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
const allowedOrigins = new Set(
  (process.env.CORS_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
);
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin) || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error("Origin not allowed"));
  },
}));
app.use(express.json({ limit: "64kb" }));
app.use(express.urlencoded({ extended: false, limit: "64kb" }));
app.use("/api/orders", (req, res, next) => {
  if (req.method === "POST") publicOrderRateLimit(req, res, next);
  else next();
});

app.use("/api", router);

app.use((_req, res) => {
  res.status(404).json({ error: "المسار المطلوب غير موجود." });
});

const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  req.log.error({ err: error, requestId: req.id, path: req.path }, "Unhandled request error");
  if (res.headersSent) return;
  res.status(500).json({
    error: "حدث خطأ غير متوقع. حاول مرة أخرى.",
    requestId: String(req.id),
  });
};

app.use(errorHandler);

export default app;
