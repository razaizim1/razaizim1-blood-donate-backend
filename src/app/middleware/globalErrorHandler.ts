import type { NextFunction, Request, Response } from "express";
import { Prisma } from "../../generated/prisma/client";
import { AppError } from "../utils/AppError";

export const globalErrorHandler = (
	err: unknown,
	_req: Request,
	res: Response,
	_next: NextFunction,
) => {
	let statusCode = 500;
	let message = "Something went wrong";
	let errors: { path?: string; message: string }[] = [{ message }];

	if (err instanceof AppError) {
		statusCode = err.statusCode;
		message = err.message;
		errors = err.errors;
	} else if (err instanceof Prisma.PrismaClientKnownRequestError) {
		statusCode = 400;
		if (err.code === "P2002") {
			message = "A record with this value already exists";
		} else if (err.code === "P2025") {
			message = "The requested record was not found";
		} else if (err.code === "P2003") {
			message = "This action conflicts with a related record";
		} else {
			message = "Database request failed";
		}
		errors = [{ message }];
	} else if (err instanceof Prisma.PrismaClientValidationError) {
		statusCode = 400;
		message = "Invalid data was sent to the database";
		errors = [{ message }];
	} else if (err instanceof Error) {
		message = err.message || message;
		errors = [{ message }];
	}

	res.status(statusCode).json({
		success: false,
		message,
		errors,
	});
};
