import { Router, type IRouter } from "express";
import healthRouter from "./health";
import nurseryRouter from "./nursery";
import quotationsRouter from "./quotations";

const router: IRouter = Router();

router.use(healthRouter);
router.use(nurseryRouter);
router.use(quotationsRouter);

export default router;
