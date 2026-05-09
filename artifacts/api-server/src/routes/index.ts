import { Router, type IRouter } from "express";
import healthRouter from "./health";
import siteDataRouter from "./siteData";

const router: IRouter = Router();

router.use(healthRouter);
router.use(siteDataRouter);

export default router;
