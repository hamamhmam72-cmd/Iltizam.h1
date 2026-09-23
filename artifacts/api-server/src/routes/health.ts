import { Router, type Request, type Response } from "express";

const router = Router();

router.get("/healthz", (_req: Request, res: Response) => {
  const data = { status: "ok" as const };
  res.json(data);
});

export default router;
