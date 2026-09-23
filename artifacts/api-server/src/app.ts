import express, { type Express, Request, Response, NextFunction } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

// استخدام (pinoHttp as any) للتخلص نهائياً من خطأ TS2349 و TS7006 للأنواع الضمنية
app.use(
  (pinoHttp as any)({
    logger,
    serializers: {
      req(req: any) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res: any) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  })
);

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

app.use((error: unknown, req: Request, res: Response, _next: NextFunction) => {
  req.log?.error({ err: error }, "API request failed");
  if (res.headersSent) return;
  res.status(503).json({ error: "The database or API service is temporarily unavailable. Please try again later." });
});

export default app;
