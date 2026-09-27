import type { NextFunction, Request, Response } from "express";
import type { ZodTypeAny } from "zod";
import { AppError } from "../utils/AppError";

export const validateRequest = (schema: ZodTypeAny) => {
	return (req: Request, _res: Response, next: NextFunction) => {
		const result = schema.safeParse(req.body ?? {});

		if (!result.success) {
			const errors = result.error.issues.map((issue) => ({
				path: issue.path.join("."),
				message: issue.message,
			}));
			next(new AppError(400, errors[0]?.message || "Validation failed", errors));
			return;
		}

		req.body = result.data;
		next();
	};
};
