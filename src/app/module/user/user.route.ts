import { Router } from "express";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { UserController } from "./user.controller";
import { updateMeSchema } from "./user.validation";

const router = Router();

router.get("/me", auth(), UserController.getMe);
router.patch("/me", auth(), validateRequest(updateMeSchema), UserController.updateMe);

export const UserRoutes = router;
