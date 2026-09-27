import type { Response } from "express";

export type TMeta = {
	page: number;
	limit: number;
	total: number;
	totalPages: number;
};

type TResponseData<T> = {
	statusCode: number;
	message: string;
	data: T;
	meta?: TMeta;
};

export const sendResponse = <T>(res: Response, payload: TResponseData<T>) => {
	res.status(payload.statusCode).json({
		success: true,
		message: payload.message,
		data: payload.data,
		...(payload.meta ? { meta: payload.meta } : {}),
	});
};
