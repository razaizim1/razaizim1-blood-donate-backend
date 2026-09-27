import type { Request, Response } from "express";
import config from "../../config";
import { AppError } from "../../utils/AppError";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { AuthService } from "./auth.service";

const cookieBase = {
	httpOnly: true,
	secure: config.node_env === "production",
	sameSite: "lax" as const,
};

const setAuthCookies = (res: Response, accessToken: string, refreshToken: string) => {
	res.cookie("accessToken", accessToken, {
		...cookieBase,
		maxAge: 24 * 60 * 60 * 1000,
	});
	res.cookie("refreshToken", refreshToken, {
		...cookieBase,
		maxAge: 7 * 24 * 60 * 60 * 1000,
	});
};

const clearAuthCookies = (res: Response) => {
	res.clearCookie("accessToken", cookieBase);
	res.clearCookie("refreshToken", cookieBase);
};

const register = catchAsync(async (req: Request, res: Response) => {
	const result = await AuthService.register(req.body);
	setAuthCookies(res, result.accessToken, result.refreshToken);
	sendResponse(res, {
		statusCode: 201,
		message: "Registration successful",
		data: result,
	});
});

const login = catchAsync(async (req: Request, res: Response) => {
	const result = await AuthService.login(req.body);
	setAuthCookies(res, result.accessToken, result.refreshToken);
	sendResponse(res, {
		statusCode: 200,
		message: "Login successful",
		data: result,
	});
});

const refreshToken = catchAsync(async (req: Request, res: Response) => {
	const token = req.body?.refreshToken || req.cookies?.refreshToken;
	if (!token) {
		throw new AppError(401, "Refresh token is required");
	}
	const result = await AuthService.refreshToken(token);
	setAuthCookies(res, result.accessToken, result.refreshToken);
	sendResponse(res, {
		statusCode: 200,
		message: "Token refreshed successfully",
		data: result,
	});
});

const logout = catchAsync(async (req: Request, res: Response) => {
	const token = req.body?.refreshToken || req.cookies?.refreshToken;
	await AuthService.logout(token);
	clearAuthCookies(res);
	sendResponse(res, {
		statusCode: 200,
		message: "Logout successful",
		data: null,
	});
});

const googleLogin = catchAsync(async (req: Request, res: Response) => {
	const result = await AuthService.googleLogin(req.body);
	setAuthCookies(res, result.accessToken, result.refreshToken);
	sendResponse(res, {
		statusCode: 200,
		message: "Google login successful",
		data: result,
	});
});

const forgotPassword = catchAsync(async (req: Request, res: Response) => {
	const result = await AuthService.forgotPassword(req.body.email);
	sendResponse(res, {
		statusCode: 200,
		message: "If the account exists, a reset token has been created",
		data: result,
	});
});

const resetPassword = catchAsync(async (req: Request, res: Response) => {
	await AuthService.resetPassword(req.body);
	sendResponse(res, {
		statusCode: 200,
		message: "Password reset successful",
		data: null,
	});
});

export const AuthController = {
	register,
	login,
	refreshToken,
	logout,
	googleLogin,
	forgotPassword,
	resetPassword,
};
