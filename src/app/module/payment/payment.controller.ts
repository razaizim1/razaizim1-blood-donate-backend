import type { Request, Response } from "express";
import { routeId, type ListQuery } from "../../utils/query";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { PaymentService } from "./payment.service";

const initiate = catchAsync(async (req: Request, res: Response) => {
	const result = await PaymentService.initiate(req.user!, req.body.requestId);
	sendResponse(res, {
		statusCode: 201,
		message: "Payment session created",
		data: result,
	});
});

const callback = catchAsync(async (req: Request, res: Response) => {
	const result = await PaymentService.callback(req.query as Record<string, unknown>);
	sendResponse(res, {
		statusCode: 200,
		message: "Payment callback processed",
		data: result,
	});
});

const my = catchAsync(async (req: Request, res: Response) => {
	const result = await PaymentService.myPayments(req.user!, req.query as ListQuery);
	sendResponse(res, {
		statusCode: 200,
		message: "Your payments retrieved",
		data: result.data,
		meta: result.meta,
	});
});

const list = catchAsync(async (req: Request, res: Response) => {
	const result = await PaymentService.listPayments(req.query as ListQuery);
	sendResponse(res, {
		statusCode: 200,
		message: "Payments retrieved",
		data: result.data,
		meta: result.meta,
	});
});

const getById = catchAsync(async (req: Request, res: Response) => {
	const result = await PaymentService.getById(routeId(req.params.id), req.user!);
	sendResponse(res, { statusCode: 200, message: "Payment retrieved", data: result });
});

export const PaymentController = { initiate, callback, my, list, getById };
