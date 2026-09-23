import { Router, type IRouter } from "express";
import healthRouter from "./health";
import eltizamRouter from "./eltizam";

const router: IRouter = Router();

router.use(healthRouter);
router.use(eltizamRouter);

export default router;
