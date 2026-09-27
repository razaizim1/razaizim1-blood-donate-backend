import type { NextFunction, Request, Response } from "express";
import type { JwtPayload } from "jsonwebtoken";
import type { Role } from "../../generated/prisma/enums";
import config from "../config";
import { prisma } from "../lib/prisma";
import { AppError } from "../utils/AppError";
import { jwtUtils } from "../utils/jwt";

export interface RequestUser {
	email: string;
	name: string;
	userId: string;
	role: Role;
}

declare global {
	namespace Express {
		interface Request {
			user?: RequestUser;
		}
	}
}

export const auth = (...requiredRoles: Role[]) => {
	return async (req: Request, _res: Response, next: NextFunction) => {
		try {
			const header = req.headers.authorization;
			const token = req.cookies?.accessToken
				? req.cookies.accessToken
				: header?.startsWith("Bearer ")
					? header.split(" ")[1]
					: undefined;

			if (!token) {
				throw new AppError(401, "You are not logged in. Please log in to continue.");
			}

			const verifiedToken = jwtUtils.verifyToken(token, config.jwt_access_secret);
			if (!verifiedToken.success) {
				throw new AppError(401, "Invalid or expired access token");
			}

			const { userId, role } = verifiedToken.data as JwtPayload;
			const user = await prisma.user.findUnique({ where: { id: userId } });

			if (!user || user.isDeleted || user.status === "DELETED") {
				throw new AppError(401, "User not found. Please log in again.");
			}

			if (user.status === "BLOCKED") {
				throw new AppError(403, "Your account has been blocked. Please contact support.");
			}

			if (user.role !== role) {
				throw new AppError(401, "Your role has changed. Please log in again.");
			}

			if (requiredRoles.length && !requiredRoles.includes(user.role)) {
				throw new AppError(403, "You do not have permission to access this resource.");
			}

			req.user = {
				email: user.email,
				name: user.name,
				userId: user.id,
				role: user.role,
			};

			next();
		} catch (error) {
			next(error);
		}
	};
};
