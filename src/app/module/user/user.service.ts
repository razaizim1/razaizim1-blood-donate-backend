import { publicUserSelect } from "../../constants/userSelect";
import { prisma } from "../../lib/prisma";
import type { RequestUser } from "../../middleware/checkAuth";
import { AppError } from "../../utils/AppError";
import { writeAudit } from "../../utils/audit";

const getMe = async (user: RequestUser) => {
	const profile = await prisma.user.findUnique({
		where: { id: user.userId },
		select: {
			...publicUserSelect,
			donorProfile: true,
			patientProfile: true,
		},
	});

	if (!profile) {
		throw new AppError(404, "User not found");
	}

	return profile;
};

const updateMe = async (
	user: RequestUser,
	payload: { name?: string; phone?: string; district?: string; address?: string },
) => {
	const updated = await prisma.$transaction(async (tx) => {
		const result = await tx.user.update({
			where: { id: user.userId },
			data: payload,
			select: publicUserSelect,
		});
		await writeAudit(tx, {
			actorId: user.userId,
			action: "PROFILE_UPDATED",
			entity: "User",
			entityId: user.userId,
			metadata: payload,
		});
		return result;
	});

	return updated;
};

export const UserService = { getMe, updateMe };
