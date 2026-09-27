import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { DonorController } from "./donor.controller";
import {
	availabilitySchema,
	createDonorProfileSchema,
	updateDonorProfileSchema,
} from "./donor.validation";

const router = Router();

router.get("/me", auth(Role.DONOR), DonorController.getMe);
router.post("/profile", auth(Role.DONOR), validateRequest(createDonorProfileSchema), DonorController.createProfile);
router.patch("/me", auth(Role.DONOR), validateRequest(updateDonorProfileSchema), DonorController.updateMe);
router.patch("/me/availability", auth(Role.DONOR), validateRequest(availabilitySchema), DonorController.updateAvailability);
router.get("/", auth(Role.ADMIN, Role.PATIENT), DonorController.listDonors);

export const DonorRoutes = router;
