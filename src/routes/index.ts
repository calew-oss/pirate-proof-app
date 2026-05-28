import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import deliveriesRouter from "./deliveries";
import lockRouter from "./lock";
import pinsRouter from "./pins";
import notificationsRouter from "./notifications";
import emailAccountsRouter from "./emailAccounts";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(deliveriesRouter);
router.use(lockRouter);
router.use(pinsRouter);
router.use(notificationsRouter);
router.use(emailAccountsRouter);

export default router;
