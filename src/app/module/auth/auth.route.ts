import { Router } from "express";
import { auth } from "../../middleware/checkAuth";
import { authLimiter } from "../../middleware/rateLimiter";
import { validateRequest } from "../../middleware/validateRequest";
import { AuthController } from "./auth.controller";
import {
	forgotPasswordSchema,
	googleLoginSchema,
	loginSchema,
	refreshTokenSchema,
	registerSchema,
	resetPasswordSchema,
} from "./auth.validation";

const router = Router();

router.post("/register", authLimiter, validateRequest(registerSchema), AuthController.register);
router.post("/login", authLimiter, validateRequest(loginSchema), AuthController.login);
router.post("/refresh-token", validateRequest(refreshTokenSchema), AuthController.refreshToken);
router.post("/logout", auth(), validateRequest(refreshTokenSchema), AuthController.logout);
router.post("/google", authLimiter, validateRequest(googleLoginSchema), AuthController.googleLogin);
router.post("/forgot-password", authLimiter, validateRequest(forgotPasswordSchema), AuthController.forgotPassword);
router.post("/reset-password", authLimiter, validateRequest(resetPasswordSchema), AuthController.resetPassword);

export const AuthRoutes = router;
