import type { Request, Response } from "express";
import { routeId, type ListQuery } from "../../utils/query";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { BloodRequestService } from "./bloodRequest.service";

const create = catchAsync(async (req: Request, res: Response) => {
	const result = await BloodRequestService.createRequest(req.user!, req.body);
	sendResponse(res, { statusCode: 201, message: "Blood request created", data: result });
});

const list = catchAsync(async (req: Request, res: Response) => {
	const result = await BloodRequestService.listRequests(req.query as ListQuery);
	sendResponse(res, {
		statusCode: 200,
		message: "Blood requests retrieved",
		data: result.data,
		meta: result.meta,
	});
});

const my = catchAsync(async (req: Request, res: Response) => {
	const result = await BloodRequestService.myRequests(req.user!, req.query as ListQuery);
	sendResponse(res, {
		statusCode: 200,
		message: "Your blood requests retrieved",
		data: result.data,
		meta: result.meta,
	});
});

const compatible = catchAsync(async (req: Request, res: Response) => {
	const result = await BloodRequestService.compatibleRequests(req.user!, req.query as ListQuery);
	sendResponse(res, {
		statusCode: 200,
		message: "Compatible blood requests retrieved",
		data: result.data,
		meta: result.meta,
	});
});

const getById = catchAsync(async (req: Request, res: Response) => {
	const result = await BloodRequestService.getById(routeId(req.params.id), req.user!);
	sendResponse(res, { statusCode: 200, message: "Blood request retrieved", data: result });
});

const update = catchAsync(async (req: Request, res: Response) => {
	const result = await BloodRequestService.updateRequest(routeId(req.params.id), req.user!, req.body);
	sendResponse(res, { statusCode: 200, message: "Blood request updated", data: result });
});

const remove = catchAsync(async (req: Request, res: Response) => {
	await BloodRequestService.softDelete(routeId(req.params.id), req.user!);
	sendResponse(res, { statusCode: 200, message: "Blood request deleted", data: null });
});

const verify = catchAsync(async (req: Request, res: Response) => {
	const result = await BloodRequestService.verify(routeId(req.params.id), req.user!);
	sendResponse(res, { statusCode: 200, message: "Blood request verified", data: result });
});

const reject = catchAsync(async (req: Request, res: Response) => {
	const result = await BloodRequestService.reject(routeId(req.params.id), req.user!, req.body.note);
	sendResponse(res, { statusCode: 200, message: "Blood request rejected", data: result });
});

const cancel = catchAsync(async (req: Request, res: Response) => {
	const result = await BloodRequestService.cancel(routeId(req.params.id), req.user!);
	sendResponse(res, { statusCode: 200, message: "Blood request cancelled", data: result });
});

const accept = catchAsync(async (req: Request, res: Response) => {
	const result = await BloodRequestService.accept(routeId(req.params.id), req.user!);
	sendResponse(res, { statusCode: 200, message: "Blood request accepted", data: result });
});

const complete = catchAsync(async (req: Request, res: Response) => {
	const result = await BloodRequestService.complete(routeId(req.params.id), req.user!);
	sendResponse(res, { statusCode: 200, message: "Donation completed", data: result });
});

export const BloodRequestController = {
	create,
	list,
	my,
	compatible,
	getById,
	update,
	remove,
	verify,
	reject,
	cancel,
	accept,
	complete,
};
