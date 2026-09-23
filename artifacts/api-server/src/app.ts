import express from "express";
import pinoHttp from "pino-http";

const app = express();

app.use(pinoHttp());

app.get("/", (req, res) => {
  res.json({ message: "Server is running" });
});

export default app;

import express, { type Express, Request, Response, NextFunction } from "express";
import cors from "cors";
import * as pinoHttpModule from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

// الحل الذري لجعل حزمة pino-http قابلة للاستدعاء والتوافق مع TypeScript
const pinoHttp = (pinoHttpModule as any).default || pinoHttpModule;

const app: Express = express();

app.use(
  pinoHttp({
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
