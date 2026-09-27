import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { DonationController } from "./donation.controller";

const router = Router();

router.get("/my", auth(Role.DONOR), DonationController.my);
router.get("/:id", auth(), DonationController.getById);

export const DonationRoutes = router;
