export type ErrorDetail = {
	path?: string;
	message: string;
};

export class AppError extends Error {
	public statusCode: number;
	public errors: ErrorDetail[];

	constructor(statusCode: number, message: string, errors?: ErrorDetail[]) {
		super(message);
		this.statusCode = statusCode;
		this.errors = errors?.length ? errors : [{ message }];
		Error.captureStackTrace(this, this.constructor);
	}
}
