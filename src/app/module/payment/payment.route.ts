import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { PaymentController } from "./payment.controller";
import { initiatePaymentSchema } from "./payment.validation";

const router = Router();

router.post("/initiate", auth(Role.PATIENT), validateRequest(initiatePaymentSchema), PaymentController.initiate);
router.get("/callback", PaymentController.callback);
router.get("/my", auth(Role.PATIENT), PaymentController.my);
router.get("/", auth(Role.ADMIN), PaymentController.list);
router.get("/:id", auth(), PaymentController.getById);

export const PaymentRoutes = router;
