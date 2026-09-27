import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { AdminController } from "./admin.controller";
import { changeRoleSchema, changeStatusSchema } from "./admin.validation";

const router = Router();

router.get("/users", auth(Role.ADMIN), AdminController.listUsers);
router.patch("/users/:id/role", auth(Role.ADMIN), validateRequest(changeRoleSchema), AdminController.changeRole);
router.patch("/users/:id/status", auth(Role.ADMIN), validateRequest(changeStatusSchema), AdminController.changeStatus);
router.delete("/users/:id", auth(Role.ADMIN), AdminController.removeUser);
router.get("/dashboard", auth(Role.ADMIN), AdminController.dashboard);
router.get("/audit-logs", auth(Role.ADMIN), AdminController.auditLogs);

export const AdminRoutes = router;
