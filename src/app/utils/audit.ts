import type { Prisma } from "../../generated/prisma/client";
import type { AuditAction } from "../../generated/prisma/enums";
import { prisma } from "../lib/prisma";

type AuditClient = Prisma.TransactionClient | typeof prisma;

type AuditInput = {
	actorId?: string | null;
	action: AuditAction;
	entity: string;
	entityId?: string | null;
	metadata?: Prisma.InputJsonValue;
};

export const writeAudit = async (db: AuditClient, input: AuditInput) => {
	await db.auditLog.create({
		data: {
			actorId: input.actorId ?? null,
			action: input.action,
			entity: input.entity,
			entityId: input.entityId ?? null,
			metadata: input.metadata,
		},
	});
};
