import { Router, type IRouter } from "express";
import healthRouter from "./health";
import siteDataRouter from "./siteData";
import quotesRouter from "./quotes";

const router: IRouter = Router();

router.use(healthRouter);
router.use(siteDataRouter);
router.use(quotesRouter);

export default router;
