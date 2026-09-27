import type { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { DonorService } from "./donor.service";

const createProfile = catchAsync(async (req: Request, res: Response) => {
	const result = await DonorService.createProfile(req.user!, req.body);
	sendResponse(res, { statusCode: 201, message: "Donor profile created", data: result });
});

const getMe = catchAsync(async (req: Request, res: Response) => {
	const result = await DonorService.getMe(req.user!);
	sendResponse(res, { statusCode: 200, message: "Donor profile retrieved", data: result });
});

const updateMe = catchAsync(async (req: Request, res: Response) => {
	const result = await DonorService.updateMe(req.user!, req.body);
	sendResponse(res, { statusCode: 200, message: "Donor profile updated", data: result });
});

const updateAvailability = catchAsync(async (req: Request, res: Response) => {
	const result = await DonorService.updateAvailability(req.user!, req.body.availability);
	sendResponse(res, { statusCode: 200, message: "Availability updated", data: result });
});

const listDonors = catchAsync(async (req: Request, res: Response) => {
	const result = await DonorService.listDonors(req.query);
	sendResponse(res, {
		statusCode: 200,
		message: "Donors retrieved successfully",
		data: result.data,
		meta: result.meta,
	});
});

export const DonorController = {
	createProfile,
	getMe,
	updateMe,
	updateAvailability,
	listDonors,
};
