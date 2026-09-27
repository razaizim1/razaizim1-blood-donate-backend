import type { Prisma } from "../../../generated/prisma/client";
import { publicUserSelect } from "../../constants/userSelect";
import { prisma } from "../../lib/prisma";
import type { RequestUser } from "../../middleware/checkAuth";
import { AppError } from "../../utils/AppError";
import { writeAudit } from "../../utils/audit";
import { getPagination, pickSort, type ListQuery } from "../../utils/query";

const listUsers = async (query: ListQuery) => {
	const { page, limit, skip, sortOrder } = getPagination(query);
	const sortBy = pickSort(query.sortBy, ["createdAt", "name", "email"], "createdAt");
	const where: Prisma.UserWhereInput = { isDeleted: false };

	if (query.role) {
		where.role = query.role as never;
	}
	if (query.status) {
		where.status = query.status as never;
	}
	if (query.search) {
		where.OR = [
			{ name: { contains: query.search, mode: "insensitive" } },
			{ email: { contains: query.search, mode: "insensitive" } },
		];
	}

	const [data, total] = await prisma.$transaction([
		prisma.user.findMany({
			where,
			skip,
			take: limit,
			orderBy: { [sortBy]: sortOrder },
			select: publicUserSelect,
		}),
		prisma.user.count({ where }),
	]);

	return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
};

const changeRole = async (id: string, actor: RequestUser, role: "DONOR" | "PATIENT" | "ADMIN") => {
	if (id === actor.userId) {
		throw new AppError(400, "You cannot change your own role");
	}
	const user = await prisma.user.findFirst({ where: { id, isDeleted: false } });
	if (!user) {
		throw new AppError(404, "User not found");
	}

	const updated = await prisma.$transaction(async (tx) => {
		const result = await tx.user.update({
			where: { id },
			data: { role },
			select: publicUserSelect,
		});
		if (role === "PATIENT") {
			await tx.patientProfile.upsert({
				where: { userId: id },
				update: {},
				create: { userId: id },
			});
		}
		await writeAudit(tx, {
			actorId: actor.userId,
			action: "USER_ROLE_CHANGED",
			entity: "User",
			entityId: id,
			metadata: { from: user.role, to: role },
		});
		return result;
	});

	return updated;
};

const changeStatus = async (id: string, actor: RequestUser, status: "ACTIVE" | "BLOCKED") => {
	if (id === actor.userId) {
		throw new AppError(400, "You cannot change your own status");
	}
	const user = await prisma.user.findFirst({ where: { id, isDeleted: false } });
	if (!user) {
		throw new AppError(404, "User not found");
	}

	const updated = await prisma.$transaction(async (tx) => {
		const result = await tx.user.update({
			where: { id },
			data: { status },
			select: publicUserSelect,
		});
		if (status === "BLOCKED") {
			await tx.refreshToken.deleteMany({ where: { userId: id } });
		}
		await writeAudit(tx, {
			actorId: actor.userId,
			action: "USER_STATUS_CHANGED",
			entity: "User",
			entityId: id,
			metadata: { from: user.status, to: status },
		});
		return result;
	});

	return updated;
};

const softDeleteUser = async (id: string, actor: RequestUser) => {
	if (id === actor.userId) {
		throw new AppError(400, "You cannot delete your own account");
	}
	const user = await prisma.user.findFirst({ where: { id, isDeleted: false } });
	if (!user) {
		throw new AppError(404, "User not found");
	}

	await prisma.$transaction(async (tx) => {
		await tx.user.update({
			where: { id },
			data: { isDeleted: true, deletedAt: new Date(), status: "DELETED" },
		});
		await tx.refreshToken.deleteMany({ where: { userId: id } });
		await writeAudit(tx, {
			actorId: actor.userId,
			action: "USER_DELETED",
			entity: "User",
			entityId: id,
		});
	});

	return null;
};

const dashboard = async () => {
	const [
		totalUsers,
		donors,
		patients,
		pendingPayment,
		open,
		verified,
		matched,
		completed,
		paid,
		bloodGroups,
	] = await prisma.$transaction([
		prisma.user.count({ where: { isDeleted: false } }),
		prisma.user.count({ where: { isDeleted: false, role: "DONOR" } }),
		prisma.user.count({ where: { isDeleted: false, role: "PATIENT" } }),
		prisma.bloodRequest.count({ where: { deletedAt: null, status: "PENDING_PAYMENT" } }),
		prisma.bloodRequest.count({ where: { deletedAt: null, status: "OPEN" } }),
		prisma.bloodRequest.count({ where: { deletedAt: null, status: "VERIFIED" } }),
		prisma.bloodRequest.count({ where: { deletedAt: null, status: "MATCHED" } }),
		prisma.bloodRequest.count({ where: { deletedAt: null, status: "COMPLETED" } }),
		prisma.payment.aggregate({
			where: { status: "PAID" },
			_sum: { amount: true },
			_count: true,
		}),
		prisma.bloodRequest.findMany({
			where: { deletedAt: null, status: { in: ["OPEN", "VERIFIED"] } },
			select: { bloodGroup: true },
		}),
	]);

	return {
		users: { total: totalUsers, donors, patients },
		requests: { pendingPayment, open, verified, matched, completed },
		payments: { paidCount: paid._count, paidAmount: paid._sum.amount || 0 },
		bloodGroupDemand: Array.from(
			bloodGroups.reduce((counts, item) => {
				counts.set(item.bloodGroup, (counts.get(item.bloodGroup) || 0) + 1);
				return counts;
			}, new Map<string, number>()),
			([bloodGroup, count]) => ({ bloodGroup, count }),
		),
	};
};

const auditLogs = async (query: ListQuery) => {
	const { page, limit, skip, sortOrder } = getPagination(query);
	const where: Prisma.AuditLogWhereInput = {};
	if (query.action) {
		where.action = query.action as never;
	}

	const [data, total] = await prisma.$transaction([
		prisma.auditLog.findMany({
			where,
			skip,
			take: limit,
			orderBy: { createdAt: sortOrder },
			include: {
				actor: { select: { id: true, name: true, email: true, role: true } },
			},
		}),
		prisma.auditLog.count({ where }),
	]);

	return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
};

export const AdminService = {
	listUsers,
	changeRole,
	changeStatus,
	softDeleteUser,
	dashboard,
	auditLogs,
};
