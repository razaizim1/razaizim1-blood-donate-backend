import type { Request, Response } from "express";
import { routeId, type ListQuery } from "../../utils/query";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { AdminService } from "./admin.service";

const listUsers = catchAsync(async (req: Request, res: Response) => {
	const result = await AdminService.listUsers(req.query as ListQuery);
	sendResponse(res, {
		statusCode: 200,
		message: "Users retrieved successfully",
		data: result.data,
		meta: result.meta,
	});
});

const changeRole = catchAsync(async (req: Request, res: Response) => {
	const result = await AdminService.changeRole(routeId(req.params.id), req.user!, req.body.role);
	sendResponse(res, { statusCode: 200, message: "User role updated", data: result });
});

const changeStatus = catchAsync(async (req: Request, res: Response) => {
	const result = await AdminService.changeStatus(routeId(req.params.id), req.user!, req.body.status);
	sendResponse(res, { statusCode: 200, message: "User status updated", data: result });
});

const removeUser = catchAsync(async (req: Request, res: Response) => {
	await AdminService.softDeleteUser(routeId(req.params.id), req.user!);
	sendResponse(res, { statusCode: 200, message: "User deleted", data: null });
});

const dashboard = catchAsync(async (_req: Request, res: Response) => {
	const result = await AdminService.dashboard();
	sendResponse(res, { statusCode: 200, message: "Dashboard stats retrieved", data: result });
});

const auditLogs = catchAsync(async (req: Request, res: Response) => {
	const result = await AdminService.auditLogs(req.query as ListQuery);
	sendResponse(res, {
		statusCode: 200,
		message: "Audit logs retrieved",
		data: result.data,
		meta: result.meta,
	});
});

export const AdminController = {
	listUsers,
	changeRole,
	changeStatus,
	removeUser,
	dashboard,
	auditLogs,
};
