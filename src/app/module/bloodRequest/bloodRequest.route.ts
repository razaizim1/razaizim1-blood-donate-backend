import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { BloodRequestController } from "./bloodRequest.controller";
import {
	createRequestSchema,
	rejectRequestSchema,
	updateRequestSchema,
} from "./bloodRequest.validation";

const router = Router();

router.post("/", auth(Role.PATIENT), validateRequest(createRequestSchema), BloodRequestController.create);
router.get("/", auth(Role.ADMIN), BloodRequestController.list);
router.get("/my", auth(Role.PATIENT), BloodRequestController.my);
router.get("/compatible", auth(Role.DONOR), BloodRequestController.compatible);
router.get("/:id", auth(), BloodRequestController.getById);
router.patch("/:id", auth(Role.PATIENT, Role.ADMIN), validateRequest(updateRequestSchema), BloodRequestController.update);
router.delete("/:id", auth(Role.PATIENT, Role.ADMIN), BloodRequestController.remove);
router.patch("/:id/verify", auth(Role.ADMIN), BloodRequestController.verify);
router.patch("/:id/reject", auth(Role.ADMIN), validateRequest(rejectRequestSchema), BloodRequestController.reject);
router.post("/:id/cancel", auth(Role.PATIENT, Role.ADMIN), BloodRequestController.cancel);
router.post("/:id/accept", auth(Role.DONOR), BloodRequestController.accept);
router.post("/:id/complete", auth(Role.DONOR, Role.ADMIN), BloodRequestController.complete);

export const BloodRequestRoutes = router;
