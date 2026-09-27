import type { Prisma } from "../../../generated/prisma/client";
import { publicUserSelect } from "../../constants/userSelect";
import config from "../../config";
import { prisma } from "../../lib/prisma";
import type { RequestUser } from "../../middleware/checkAuth";
import { AppError } from "../../utils/AppError";
import { writeAudit } from "../../utils/audit";
import { addDays, compatibleDonorGroups, recipientGroupsForDonor } from "../../utils/bloodCompatibility";
import { getPagination, pickSort, type ListQuery } from "../../utils/query";
import { DonorService } from "../donor/donor.service";

const requestSelect = {
	id: true,
	bloodGroup: true,
	units: true,
	urgency: true,
	hospitalName: true,
	district: true,
	area: true,
	contactPhone: true,
	reason: true,
	neededBy: true,
	status: true,
	serviceFee: true,
	rejectionNote: true,
	createdAt: true,
	updatedAt: true,
	patient: { select: publicUserSelect },
	donation: {
		select: {
			id: true,
			status: true,
			acceptedAt: true,
			completedAt: true,
			donorId: true,
			donor: { select: publicUserSelect },
		},
	},
} satisfies Prisma.BloodRequestSelect;

const buildFilters = (query: ListQuery): Prisma.BloodRequestWhereInput => {
	const where: Prisma.BloodRequestWhereInput = { deletedAt: null };

	if (query.status) {
		where.status = query.status as never;
	}
	if (query.bloodGroup) {
		where.bloodGroup = query.bloodGroup as never;
	}
	if (query.urgency) {
		where.urgency = query.urgency as never;
	}
	if (query.district) {
		where.district = { equals: query.district, mode: "insensitive" };
	}
	if (query.search) {
		where.OR = [
			{ hospitalName: { contains: query.search, mode: "insensitive" } },
			{ reason: { contains: query.search, mode: "insensitive" } },
		];
	}

	return where;
};

const listRequests = async (query: ListQuery) => {
	const { page, limit, skip, sortOrder } = getPagination(query);
	const sortBy = pickSort(query.sortBy, ["createdAt", "neededBy", "units", "updatedAt"], "createdAt");
	const where = buildFilters(query);

	const [data, total] = await prisma.$transaction([
		prisma.bloodRequest.findMany({
			where,
			skip,
			take: limit,
			orderBy: { [sortBy]: sortOrder },
			select: requestSelect,
		}),
		prisma.bloodRequest.count({ where }),
	]);

	return {
		data,
		meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
	};
};

const myRequests = async (user: RequestUser, query: ListQuery) => {
	const { page, limit, skip, sortOrder } = getPagination(query);
	const sortBy = pickSort(query.sortBy, ["createdAt", "neededBy", "updatedAt"], "createdAt");
	const where: Prisma.BloodRequestWhereInput = {
		...buildFilters(query),
		patientId: user.userId,
	};

	const [data, total] = await prisma.$transaction([
		prisma.bloodRequest.findMany({
			where,
			skip,
			take: limit,
			orderBy: { [sortBy]: sortOrder },
			select: requestSelect,
		}),
		prisma.bloodRequest.count({ where }),
	]);

	return {
		data,
		meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
	};
};

const compatibleRequests = async (user: RequestUser, query: ListQuery) => {
	await DonorService.refreshCooldowns();
	const donor = await prisma.donorProfile.findUnique({ where: { userId: user.userId } });
	if (!donor) {
		throw new AppError(404, "Create a donor profile before viewing requests");
	}
	if (!donor.isEligible || donor.availability !== "AVAILABLE") {
		return {
			data: [],
			meta: { page: 1, limit: 10, total: 0, totalPages: 0 },
		};
	}

	const { page, limit, skip, sortOrder } = getPagination(query);
	const sortBy = pickSort(query.sortBy, ["createdAt", "neededBy", "urgency"], "neededBy");
	const where: Prisma.BloodRequestWhereInput = {
		...buildFilters(query),
		status: "VERIFIED",
		bloodGroup: { in: recipientGroupsForDonor(donor.bloodGroup) },
		patientId: { not: user.userId },
	};

	const [data, total] = await prisma.$transaction([
		prisma.bloodRequest.findMany({
			where,
			skip,
			take: limit,
			orderBy: { [sortBy]: sortOrder },
			select: requestSelect,
		}),
		prisma.bloodRequest.count({ where }),
	]);

	return {
		data,
		meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
	};
};

const getById = async (id: string, user: RequestUser) => {
	const request = await prisma.bloodRequest.findFirst({
		where: { id, deletedAt: null },
		select: requestSelect,
	});
	if (!request) {
		throw new AppError(404, "Blood request not found");
	}

	const isPatient = request.patient.id === user.userId;
	const isAssignedDonor = request.donation?.donorId === user.userId;
	const donorCanPreview = user.role === "DONOR" && request.status === "VERIFIED";
	if (user.role !== "ADMIN" && !isPatient && !isAssignedDonor && !donorCanPreview) {
		throw new AppError(403, "You cannot view this blood request");
	}

	return request;
};

const createRequest = async (
	user: RequestUser,
	payload: {
		bloodGroup: string;
		units: number;
		urgency: "NORMAL" | "URGENT" | "CRITICAL";
		hospitalName: string;
		district: string;
		area?: string;
		contactPhone: string;
		reason: string;
		neededBy: Date;
	},
) => {
	const patient = await prisma.patientProfile.findUnique({ where: { userId: user.userId } });
	if (!patient) {
		throw new AppError(404, "Patient profile not found");
	}

	const request = await prisma.$transaction(async (tx) => {
		const created = await tx.bloodRequest.create({
			data: {
				patientId: user.userId,
				bloodGroup: payload.bloodGroup as never,
				units: payload.units,
				urgency: payload.urgency,
				hospitalName: payload.hospitalName,
				district: payload.district,
				area: payload.area,
				contactPhone: payload.contactPhone,
				reason: payload.reason,
				neededBy: payload.neededBy,
				status: "PENDING_PAYMENT",
				serviceFee: config.service_fee_bdt,
			},
			select: requestSelect,
		});
		await writeAudit(tx, {
			actorId: user.userId,
			action: "REQUEST_CREATED",
			entity: "BloodRequest",
			entityId: created.id,
			metadata: { bloodGroup: payload.bloodGroup, urgency: payload.urgency },
		});
		return created;
	});

	return request;
};

const updateRequest = async (id: string, user: RequestUser, payload: Record<string, unknown>) => {
	const existing = await prisma.bloodRequest.findFirst({
		where: { id, deletedAt: null },
	});
	if (!existing) {
		throw new AppError(404, "Blood request not found");
	}
	if (existing.patientId !== user.userId && user.role !== "ADMIN") {
		throw new AppError(403, "You cannot update this blood request");
	}
	if (!["PENDING_PAYMENT", "OPEN"].includes(existing.status)) {
		throw new AppError(400, "Only unpaid or open requests can be edited");
	}

	const updated = await prisma.$transaction(async (tx) => {
		const result = await tx.bloodRequest.update({
			where: { id },
			data: payload,
			select: requestSelect,
		});
		await writeAudit(tx, {
			actorId: user.userId,
			action: "REQUEST_UPDATED",
			entity: "BloodRequest",
			entityId: id,
		});
		return result;
	});

	return updated;
};

const softDelete = async (id: string, user: RequestUser) => {
	const existing = await prisma.bloodRequest.findFirst({ where: { id, deletedAt: null } });
	if (!existing) {
		throw new AppError(404, "Blood request not found");
	}
	if (existing.patientId !== user.userId && user.role !== "ADMIN") {
		throw new AppError(403, "You cannot delete this blood request");
	}
	if (["MATCHED", "COMPLETED"].includes(existing.status)) {
		throw new AppError(400, "Matched or completed requests cannot be deleted");
	}

	await prisma.$transaction(async (tx) => {
		await tx.bloodRequest.update({
			where: { id },
			data: { deletedAt: new Date(), status: "CANCELLED" },
		});
		await writeAudit(tx, {
			actorId: user.userId,
			action: "REQUEST_DELETED",
			entity: "BloodRequest",
			entityId: id,
		});
	});

	return null;
};

const verify = async (id: string, user: RequestUser) => {
	const existing = await prisma.bloodRequest.findFirst({ where: { id, deletedAt: null } });
	if (!existing) {
		throw new AppError(404, "Blood request not found");
	}
	if (existing.status !== "OPEN") {
		throw new AppError(400, "Only paid open requests can be verified");
	}

	const updated = await prisma.$transaction(async (tx) => {
		const result = await tx.bloodRequest.update({
			where: { id },
			data: { status: "VERIFIED" },
			select: requestSelect,
		});
		await writeAudit(tx, {
			actorId: user.userId,
			action: "REQUEST_VERIFIED",
			entity: "BloodRequest",
			entityId: id,
		});
		return result;
	});

	return updated;
};

const reject = async (id: string, user: RequestUser, note: string) => {
	const existing = await prisma.bloodRequest.findFirst({ where: { id, deletedAt: null } });
	if (!existing) {
		throw new AppError(404, "Blood request not found");
	}
	if (!["OPEN", "VERIFIED", "PENDING_PAYMENT"].includes(existing.status)) {
		throw new AppError(400, "This request can no longer be rejected");
	}

	const updated = await prisma.$transaction(async (tx) => {
		const result = await tx.bloodRequest.update({
			where: { id },
			data: { status: "REJECTED", rejectionNote: note },
			select: requestSelect,
		});
		await writeAudit(tx, {
			actorId: user.userId,
			action: "REQUEST_REJECTED",
			entity: "BloodRequest",
			entityId: id,
			metadata: { note },
		});
		return result;
	});

	return updated;
};

const cancel = async (id: string, user: RequestUser) => {
	const existing = await prisma.bloodRequest.findFirst({
		where: { id, deletedAt: null },
		include: { donation: true },
	});
	if (!existing) {
		throw new AppError(404, "Blood request not found");
	}
	if (existing.patientId !== user.userId && user.role !== "ADMIN") {
		throw new AppError(403, "You cannot cancel this blood request");
	}
	if (["COMPLETED", "CANCELLED", "REJECTED"].includes(existing.status)) {
		throw new AppError(400, "This request is already closed");
	}

	const updated = await prisma.$transaction(async (tx) => {
		if (existing.donation && existing.donation.status === "ACCEPTED") {
			await tx.donation.update({
				where: { id: existing.donation.id },
				data: { status: "CANCELLED" },
			});
		}
		const result = await tx.bloodRequest.update({
			where: { id },
			data: { status: "CANCELLED" },
			select: requestSelect,
		});
		await writeAudit(tx, {
			actorId: user.userId,
			action: "REQUEST_CANCELLED",
			entity: "BloodRequest",
			entityId: id,
		});
		return result;
	});

	return updated;
};

const accept = async (id: string, user: RequestUser) => {
	const donor = await prisma.donorProfile.findUnique({ where: { userId: user.userId } });
	if (!donor) {
		throw new AppError(404, "Donor profile not found");
	}
	DonorService.assertEligibleWindow(donor.lastDonationDate);
	if (!donor.isEligible || donor.availability !== "AVAILABLE") {
		throw new AppError(400, "You are not eligible to accept a request right now");
	}

	const result = await prisma.$transaction(async (tx) => {
		const request = await tx.bloodRequest.findFirst({
			where: { id, deletedAt: null },
		});
		if (!request) {
			throw new AppError(404, "Blood request not found");
		}
		if (request.patientId === user.userId) {
			throw new AppError(400, "You cannot accept your own blood request");
		}
		if (request.status !== "VERIFIED") {
			throw new AppError(400, "Only verified requests can be accepted");
		}
		if (!compatibleDonorGroups(request.bloodGroup).includes(donor.bloodGroup)) {
			throw new AppError(400, "Your blood group is not compatible with this request");
		}

		const activeDonation = await tx.donation.findFirst({
			where: { donorId: user.userId, status: "ACCEPTED" },
		});
		if (activeDonation) {
			throw new AppError(409, "You already have an active donation");
		}

		const locked = await tx.bloodRequest.updateMany({
			where: { id, status: "VERIFIED", deletedAt: null },
			data: { status: "MATCHED" },
		});
		if (locked.count !== 1) {
			throw new AppError(409, "This request was just accepted by another donor");
		}

		const donation = await tx.donation.create({
			data: {
				requestId: id,
				donorId: user.userId,
				status: "ACCEPTED",
			},
		});

		await writeAudit(tx, {
			actorId: user.userId,
			action: "REQUEST_ACCEPTED",
			entity: "BloodRequest",
			entityId: id,
			metadata: { donationId: donation.id },
		});

		return tx.bloodRequest.findUniqueOrThrow({
			where: { id },
			select: requestSelect,
		});
	});

	return result;
};

const complete = async (id: string, user: RequestUser) => {
	const result = await prisma.$transaction(async (tx) => {
		const request = await tx.bloodRequest.findFirst({
			where: { id, deletedAt: null },
			include: { donation: true },
		});
		if (!request || !request.donation) {
			throw new AppError(404, "Matched donation not found");
		}
		if (user.role !== "ADMIN" && request.donation.donorId !== user.userId) {
			throw new AppError(403, "Only the assigned donor can complete this donation");
		}
		if (request.status !== "MATCHED" || request.donation.status !== "ACCEPTED") {
			throw new AppError(400, "This donation is not ready to complete");
		}

		const now = new Date();
		await tx.donation.update({
			where: { id: request.donation.id },
			data: { status: "COMPLETED", completedAt: now },
		});
		await tx.bloodRequest.update({
			where: { id },
			data: { status: "COMPLETED" },
		});
		await tx.donorProfile.update({
			where: { userId: request.donation.donorId },
			data: {
				lastDonationDate: now,
				nextEligibleAt: addDays(now, config.donation_cooldown_days),
				availability: "COOLDOWN",
				isEligible: false,
				totalDonations: { increment: 1 },
			},
		});
		await writeAudit(tx, {
			actorId: user.userId,
			action: "DONATION_COMPLETED",
			entity: "Donation",
			entityId: request.donation.id,
		});

		return tx.bloodRequest.findUniqueOrThrow({
			where: { id },
			select: requestSelect,
		});
	});

	return result;
};

export const BloodRequestService = {
	listRequests,
	myRequests,
	compatibleRequests,
	getById,
	createRequest,
	updateRequest,
	softDelete,
	verify,
	reject,
	cancel,
	accept,
	complete,
};
