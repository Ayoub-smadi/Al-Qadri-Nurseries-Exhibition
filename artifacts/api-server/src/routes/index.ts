import { Router, type IRouter } from "express";
import healthRouter from "./health";
import storageRouter from "./storage";
import siteDataRouter from "./siteData";

const router: IRouter = Router();

router.use(healthRouter);
router.use(storageRouter);
router.use(siteDataRouter);

export default router;
