import type { Request, Response } from "express";
import { prisma } from "../../lib/prisma";
import type { RequestUser } from "../../middleware/checkAuth";
import { AppError } from "../../utils/AppError";
import { catchAsync } from "../../utils/catchAsync";
import { getPagination, routeId, type ListQuery } from "../../utils/query";
import { sendResponse } from "../../utils/sendResponse";

const my = catchAsync(async (req: Request, res: Response) => {
	const user = req.user as RequestUser;
	const query = req.query as ListQuery;
	const { page, limit, skip, sortOrder } = getPagination(query);

	const where = { donorId: user.userId };
	const [data, total] = await prisma.$transaction([
		prisma.donation.findMany({
			where,
			skip,
			take: limit,
			orderBy: { createdAt: sortOrder },
			include: {
				request: {
					select: {
						id: true,
						bloodGroup: true,
						hospitalName: true,
						district: true,
						status: true,
						urgency: true,
					},
				},
			},
		}),
		prisma.donation.count({ where }),
	]);

	sendResponse(res, {
		statusCode: 200,
		message: "Donation history retrieved",
		data,
		meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
	});
});

const getById = catchAsync(async (req: Request, res: Response) => {
	const donation = await prisma.donation.findUnique({
		where: { id: routeId(req.params.id) },
		include: {
			request: {
				select: {
					id: true,
					patientId: true,
					bloodGroup: true,
					hospitalName: true,
					district: true,
					status: true,
				},
			},
		},
	});

	if (!donation) {
		throw new AppError(404, "Donation not found");
	}

	const user = req.user as RequestUser;
	const allowed =
		user.role === "ADMIN" ||
		donation.donorId === user.userId ||
		donation.request.patientId === user.userId;

	if (!allowed) {
		throw new AppError(403, "You cannot view this donation");
	}

	sendResponse(res, { statusCode: 200, message: "Donation retrieved", data: donation });
});

const routerImports = { my, getById };
export const DonationController = routerImports;
