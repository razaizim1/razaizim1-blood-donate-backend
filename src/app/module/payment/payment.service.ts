import crypto from "crypto";
import type { Prisma } from "../../../generated/prisma/client";
import config from "../../config";
import { getBkashIdToken } from "../../lib/bkash";
import { prisma } from "../../lib/prisma";
import type { RequestUser } from "../../middleware/checkAuth";
import { AppError } from "../../utils/AppError";
import { writeAudit } from "../../utils/audit";
import { getPagination, pickSort, type ListQuery } from "../../utils/query";

const paymentSelect = {
	id: true,
	requestId: true,
	userId: true,
	amount: true,
	status: true,
	bkashPaymentId: true,
	trxId: true,
	invoiceNumber: true,
	bkashURL: true,
	paidAt: true,
	createdAt: true,
	updatedAt: true,
} satisfies Prisma.PaymentSelect;

const bkashHeaders = (token: string) => ({
	"Content-Type": "application/json",
	Accept: "application/json",
	Authorization: token,
	"X-App-Key": config.bkash_app_key,
});

const initiate = async (user: RequestUser, requestId: string) => {
	const request = await prisma.bloodRequest.findFirst({
		where: { id: requestId, deletedAt: null },
	});
	if (!request) {
		throw new AppError(404, "Blood request not found");
	}
	if (request.patientId !== user.userId) {
		throw new AppError(403, "You can only pay for your own blood request");
	}
	if (request.status !== "PENDING_PAYMENT") {
		throw new AppError(400, "This request does not need a payment");
	}

	const token = await getBkashIdToken();
	const invoiceNumber = `BL${crypto.randomBytes(6).toString("hex")}`;
	const payerReference = (user.email || "01700000000").slice(0, 20);

	const response = await fetch(`${config.bkash_base_url}/tokenized/checkout/create`, {
		method: "POST",
		headers: bkashHeaders(token),
		body: JSON.stringify({
			mode: "0011",
			payerReference,
			callbackURL: config.bkash_callback_url,
			amount: request.serviceFee.toString(),
			currency: "BDT",
			intent: "sale",
			merchantInvoiceNumber: invoiceNumber,
		}),
	});

	const result = (await response.json()) as {
		paymentID?: string;
		bkashURL?: string;
		statusMessage?: string;
		merchantInvoiceNumber?: string;
	};

	if (!result.paymentID || !result.bkashURL) {
		throw new AppError(502, result.statusMessage || "bKash could not create the payment");
	}

	const payment = await prisma.$transaction(async (tx) => {
		await tx.payment.updateMany({
			where: { requestId, status: "INITIATED" },
			data: { status: "CANCELLED" },
		});

		const created = await tx.payment.create({
			data: {
				requestId,
				userId: user.userId,
				amount: request.serviceFee,
				status: "INITIATED",
				bkashPaymentId: result.paymentID,
				invoiceNumber,
				bkashURL: result.bkashURL,
				payerReference,
				gatewayResponse: result as Prisma.InputJsonValue,
			},
			select: paymentSelect,
		});

		await writeAudit(tx, {
			actorId: user.userId,
			action: "PAYMENT_INITIATED",
			entity: "Payment",
			entityId: created.id,
			metadata: { requestId, amount: request.serviceFee },
		});

		return created;
	});

	return payment;
};

const callback = async (query: Record<string, unknown>) => {
	const paymentID = String(query.paymentID || "");
	const status = String(query.status || "");

	if (!paymentID || !status) {
		throw new AppError(400, "bKash callback is missing paymentID or status");
	}

	const existing = await prisma.payment.findUnique({ where: { bkashPaymentId: paymentID } });
	if (!existing) {
		throw new AppError(404, "Payment not found");
	}
	if (existing.status === "PAID") {
		return existing;
	}

	if (status === "cancel") {
		return prisma.payment.update({
			where: { id: existing.id },
			data: { status: "CANCELLED" },
			select: paymentSelect,
		});
	}

	if (status !== "success") {
		await prisma.$transaction(async (tx) => {
			await tx.payment.update({
				where: { id: existing.id },
				data: { status: "FAILED" },
			});
			await writeAudit(tx, {
				actorId: existing.userId,
				action: "PAYMENT_FAILED",
				entity: "Payment",
				entityId: existing.id,
			});
		});
		throw new AppError(400, "bKash payment failed");
	}

	const token = await getBkashIdToken();
	const executeResponse = await fetch(`${config.bkash_base_url}/tokenized/checkout/execute`, {
		method: "POST",
		headers: bkashHeaders(token),
		body: JSON.stringify({ paymentID }),
	});
	const executed = (await executeResponse.json()) as {
		transactionStatus?: string;
		statusCode?: string;
		trxID?: string;
		statusMessage?: string;
	};

	const paid = executed.transactionStatus === "Completed" || executed.statusCode === "0000";
	if (!paid) {
		await prisma.payment.update({
			where: { id: existing.id },
			data: {
				status: "FAILED",
				gatewayResponse: executed as Prisma.InputJsonValue,
			},
		});
		throw new AppError(400, executed.statusMessage || "bKash payment could not be executed");
	}

	const updated = await prisma.$transaction(async (tx) => {
		const payment = await tx.payment.update({
			where: { id: existing.id },
			data: {
				status: "PAID",
				trxId: executed.trxID,
				paidAt: new Date(),
				gatewayResponse: executed as Prisma.InputJsonValue,
			},
			select: paymentSelect,
		});
		await tx.bloodRequest.updateMany({
			where: { id: existing.requestId, status: "PENDING_PAYMENT", deletedAt: null },
			data: { status: "OPEN" },
		});
		await writeAudit(tx, {
			actorId: existing.userId,
			action: "PAYMENT_SUCCESS",
			entity: "Payment",
			entityId: existing.id,
			metadata: { trxId: executed.trxID, requestId: existing.requestId },
		});
		return payment;
	});

	return updated;
};

const myPayments = async (user: RequestUser, query: ListQuery) => {
	const { page, limit, skip, sortOrder } = getPagination(query);
	const sortBy = pickSort(query.sortBy, ["createdAt", "amount"], "createdAt");
	const where: Prisma.PaymentWhereInput = { userId: user.userId };
	if (query.status) {
		where.status = query.status as never;
	}

	const [data, total] = await prisma.$transaction([
		prisma.payment.findMany({
			where,
			skip,
			take: limit,
			orderBy: { [sortBy]: sortOrder },
			select: paymentSelect,
		}),
		prisma.payment.count({ where }),
	]);

	return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
};

const listPayments = async (query: ListQuery) => {
	const { page, limit, skip, sortOrder } = getPagination(query);
	const sortBy = pickSort(query.sortBy, ["createdAt", "amount"], "createdAt");
	const where: Prisma.PaymentWhereInput = {};
	if (query.status) {
		where.status = query.status as never;
	}

	const [data, total] = await prisma.$transaction([
		prisma.payment.findMany({
			where,
			skip,
			take: limit,
			orderBy: { [sortBy]: sortOrder },
			select: paymentSelect,
		}),
		prisma.payment.count({ where }),
	]);

	return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
};

const getById = async (id: string, user: RequestUser) => {
	const payment = await prisma.payment.findUnique({
		where: { id },
		select: paymentSelect,
	});
	if (!payment) {
		throw new AppError(404, "Payment not found");
	}
	if (user.role !== "ADMIN" && payment.userId !== user.userId) {
		throw new AppError(403, "You cannot view this payment");
	}
	return payment;
};

export const PaymentService = {
	initiate,
	callback,
	myPayments,
	listPayments,
	getById,
};
