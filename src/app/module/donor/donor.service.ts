import type { Prisma } from "../../../generated/prisma/client";
import { publicUserSelect } from "../../constants/userSelect";
import config from "../../config";
import { prisma } from "../../lib/prisma";
import type { RequestUser } from "../../middleware/checkAuth";
import { AppError } from "../../utils/AppError";
import { writeAudit } from "../../utils/audit";
import { addDays } from "../../utils/bloodCompatibility";
import { getPagination, pickSort, type ListQuery } from "../../utils/query";

const donorSelect = {
	id: true,
	bloodGroup: true,
	lastDonationDate: true,
	nextEligibleAt: true,
	availability: true,
	district: true,
	area: true,
	isEligible: true,
	totalDonations: true,
	createdAt: true,
	updatedAt: true,
	user: { select: publicUserSelect },
} satisfies Prisma.DonorProfileSelect;

export const refreshCooldowns = async () => {
	await prisma.donorProfile.updateMany({
		where: {
			availability: "COOLDOWN",
			nextEligibleAt: { lte: new Date() },
		},
		data: {
			availability: "AVAILABLE",
			isEligible: true,
		},
	});
};

const assertEligibleWindow = (lastDonationDate: Date | null) => {
	if (!lastDonationDate) {
		return;
	}
	const next = addDays(lastDonationDate, config.donation_cooldown_days);
	if (next > new Date()) {
		throw new AppError(
			400,
			`You can donate again after ${next.toISOString().slice(0, 10)}`,
		);
	}
};

const getMe = async (user: RequestUser) => {
	await refreshCooldowns();
	const profile = await prisma.donorProfile.findUnique({
		where: { userId: user.userId },
		select: donorSelect,
	});
	if (!profile) {
		throw new AppError(404, "Donor profile not found");
	}
	return profile;
};

const createProfile = async (
	user: RequestUser,
	payload: { bloodGroup: string; district: string; area?: string },
) => {
	if (user.role !== "DONOR") {
		throw new AppError(403, "Only donors can create a donor profile");
	}

	const existing = await prisma.donorProfile.findUnique({ where: { userId: user.userId } });
	if (existing) {
		throw new AppError(409, "Donor profile already exists");
	}

	const profile = await prisma.$transaction(async (tx) => {
		const created = await tx.donorProfile.create({
			data: {
				userId: user.userId,
				bloodGroup: payload.bloodGroup as never,
				district: payload.district,
				area: payload.area,
				availability: "AVAILABLE",
				isEligible: true,
			},
			select: donorSelect,
		});
		await tx.user.update({
			where: { id: user.userId },
			data: { district: payload.district },
		});
		await writeAudit(tx, {
			actorId: user.userId,
			action: "PROFILE_UPDATED",
			entity: "DonorProfile",
			entityId: created.id,
			metadata: { bloodGroup: payload.bloodGroup, district: payload.district },
		});
		return created;
	});

	return profile;
};

const updateMe = async (
	user: RequestUser,
	payload: { bloodGroup?: string; district?: string; area?: string },
) => {
	const existing = await prisma.donorProfile.findUnique({ where: { userId: user.userId } });
	if (!existing) {
		throw new AppError(404, "Donor profile not found");
	}

	const updated = await prisma.$transaction(async (tx) => {
		const result = await tx.donorProfile.update({
			where: { userId: user.userId },
			data: {
				bloodGroup: payload.bloodGroup as never,
				district: payload.district,
				area: payload.area,
			},
			select: donorSelect,
		});
		if (payload.district) {
			await tx.user.update({
				where: { id: user.userId },
				data: { district: payload.district },
			});
		}
		await writeAudit(tx, {
			actorId: user.userId,
			action: "PROFILE_UPDATED",
			entity: "DonorProfile",
			entityId: existing.id,
		});
		return result;
	});

	return updated;
};

const updateAvailability = async (user: RequestUser, availability: "AVAILABLE" | "UNAVAILABLE") => {
	const existing = await prisma.donorProfile.findUnique({ where: { userId: user.userId } });
	if (!existing) {
		throw new AppError(404, "Donor profile not found");
	}

	if (availability === "AVAILABLE") {
		assertEligibleWindow(existing.lastDonationDate);
		if (existing.nextEligibleAt && existing.nextEligibleAt > new Date()) {
			throw new AppError(400, "You are still inside the 90-day donation cooldown");
		}
	}

	const updated = await prisma.donorProfile.update({
		where: { userId: user.userId },
		data: {
			availability,
			isEligible: availability === "AVAILABLE",
		},
		select: donorSelect,
	});

	return updated;
};

const listDonors = async (query: ListQuery) => {
	await refreshCooldowns();
	const { page, limit, skip, sortOrder } = getPagination(query);
	const sortBy = pickSort(query.sortBy, ["createdAt", "totalDonations", "district"], "createdAt");

	const where: Prisma.DonorProfileWhereInput = {
		user: { isDeleted: false, status: "ACTIVE" },
	};

	if (query.bloodGroup) {
		where.bloodGroup = query.bloodGroup as never;
	}
	if (query.district) {
		where.district = { equals: query.district, mode: "insensitive" };
	}
	if (query.availability) {
		where.availability = query.availability as never;
	}
	if (query.search) {
		where.user = {
			isDeleted: false,
			status: "ACTIVE",
			name: { contains: query.search, mode: "insensitive" },
		};
	}

	const [data, total] = await prisma.$transaction([
		prisma.donorProfile.findMany({
			where,
			skip,
			take: limit,
			orderBy: { [sortBy]: sortOrder },
			select: donorSelect,
		}),
		prisma.donorProfile.count({ where }),
	]);

	return {
		data,
		meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
	};
};

export const DonorService = {
	getMe,
	createProfile,
	updateMe,
	updateAvailability,
	listDonors,
	donorSelect,
	assertEligibleWindow,
	refreshCooldowns,
};
