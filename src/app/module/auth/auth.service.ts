import bcrypt from "bcryptjs";
import type { JwtPayload } from "jsonwebtoken";
import { AuthProvider, Role } from "../../../generated/prisma/enums";
import { publicUserSelect } from "../../constants/userSelect";
import config from "../../config";
import { googleClient } from "../../lib/googleAuth";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import { writeAudit } from "../../utils/audit";
import { jwtUtils } from "../../utils/jwt";
import { createRawToken, hashToken } from "../../utils/tokenHash";

type TokenUser = {
	id: string;
	name: string;
	email: string;
	role: Role;
};

const issueTokens = async (user: TokenUser) => {
	const jwtPayload: JwtPayload = {
		userId: user.id,
		name: user.name,
		email: user.email,
		role: user.role,
	};

	const accessToken = jwtUtils.createToken(
		jwtPayload,
		config.jwt_access_secret,
		config.jwt_access_expires_in,
	);
	const refreshToken = jwtUtils.createToken(
		{ userId: user.id },
		config.jwt_refresh_secret,
		config.jwt_refresh_expires_in,
	);

	await prisma.refreshToken.create({
		data: {
			tokenHash: hashToken(refreshToken),
			userId: user.id,
			expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
		},
	});

	return { accessToken, refreshToken };
};

const publicAuthUser = (user: TokenUser) => ({
	id: user.id,
	name: user.name,
	email: user.email,
	role: user.role,
});

const register = async (payload: {
	name: string;
	email: string;
	password: string;
	role: "DONOR" | "PATIENT";
	phone?: string;
	district?: string;
	address?: string;
	donor?: { bloodGroup: string; district: string; area?: string };
	patient?: { bloodGroup?: string; district?: string; emergencyContact?: string };
}) => {
	const email = payload.email.trim().toLowerCase();
	const existing = await prisma.user.findUnique({ where: { email } });
	if (existing) {
		throw new AppError(409, "An account with this email already exists");
	}

	const hashedPassword = await bcrypt.hash(passwordOrThrow(payload.password), config.bcrypt_salt_rounds);

	const user = await prisma.$transaction(async (tx) => {
		const created = await tx.user.create({
			data: {
				name: payload.name.trim(),
				email,
				password: hashedPassword,
				phone: payload.phone,
				district: payload.district || payload.donor?.district || payload.patient?.district,
				address: payload.address,
				role: payload.role,
				status: "ACTIVE",
				emailVerified: true,
				authProvider: AuthProvider.CREDENTIAL,
				donorProfile:
					payload.role === "DONOR" && payload.donor
						? {
								create: {
									bloodGroup: payload.donor.bloodGroup as never,
									district: payload.donor.district,
									area: payload.donor.area,
									availability: "AVAILABLE",
									isEligible: true,
								},
							}
						: undefined,
				patientProfile:
					payload.role === "PATIENT"
						? {
								create: {
									bloodGroup: payload.patient?.bloodGroup as never,
									district: payload.patient?.district || payload.district,
									emergencyContact: payload.patient?.emergencyContact || payload.phone,
								},
							}
						: undefined,
			},
			select: publicUserSelect,
		});

		await writeAudit(tx, {
			actorId: created.id,
			action: "USER_REGISTERED",
			entity: "User",
			entityId: created.id,
			metadata: { role: created.role },
		});

		return created;
	});

	const tokens = await issueTokens(user);
	return { user, ...tokens };
};

function passwordOrThrow(password: string) {
	return password;
}

const login = async (payload: { email: string; password: string }) => {
	const email = payload.email.trim().toLowerCase();
	const user = await prisma.user.findUnique({ where: { email } });

	if (!user || user.isDeleted) {
		throw new AppError(401, "Invalid email or password");
	}
	if (user.status === "BLOCKED") {
		throw new AppError(403, "Your account has been blocked");
	}
	if (!user.password) {
		throw new AppError(400, "This account uses Google sign-in");
	}

	const matched = await bcrypt.compare(payload.password, user.password);
	if (!matched) {
		throw new AppError(401, "Invalid email or password");
	}

	const tokens = await issueTokens(user);
	return {
		user: publicAuthUser(user),
		...tokens,
	};
};

const refreshToken = async (token: string) => {
	const verified = jwtUtils.verifyToken(token, config.jwt_refresh_secret);
	if (!verified.success) {
		throw new AppError(401, "Invalid or expired refresh token");
	}

	const stored = await prisma.refreshToken.findUnique({
		where: { tokenHash: hashToken(token) },
		include: { user: true },
	});

	if (!stored || stored.expiresAt < new Date()) {
		throw new AppError(401, "Refresh token is no longer valid");
	}
	if (stored.user.isDeleted || stored.user.status !== "ACTIVE") {
		throw new AppError(403, "This account cannot refresh a session");
	}

	await prisma.refreshToken.delete({ where: { id: stored.id } });
	const tokens = await issueTokens(stored.user);
	return { user: publicAuthUser(stored.user), ...tokens };
};

const logout = async (token?: string) => {
	if (!token) {
		return null;
	}
	await prisma.refreshToken.deleteMany({ where: { tokenHash: hashToken(token) } });
	return null;
};

const googleLogin = async (payload: { idToken: string; role?: "DONOR" | "PATIENT" }) => {
	const ticket = await googleClient.verifyIdToken({
		idToken: payload.idToken,
		audience: config.google_client_id,
	});
	const googlePayload = ticket.getPayload();

	if (!googlePayload?.email || !googlePayload.sub) {
		throw new AppError(401, "Google account did not return an email");
	}

	const email = googlePayload.email.toLowerCase();
	let user = await prisma.user.findUnique({ where: { email } });

	if (user?.isDeleted || user?.status === "DELETED") {
		throw new AppError(403, "This account has been deleted");
	}
	if (user?.status === "BLOCKED") {
		throw new AppError(403, "Your account has been blocked");
	}

	if (!user) {
		const role = payload.role || "PATIENT";
		user = await prisma.$transaction(async (tx) => {
			const created = await tx.user.create({
				data: {
					name: googlePayload.name || email.split("@")[0],
					email,
					googleId: googlePayload.sub,
					authProvider: AuthProvider.GOOGLE,
					emailVerified: true,
					role,
					status: "ACTIVE",
					imageUrl: googlePayload.picture || "",
					patientProfile: role === "PATIENT" ? { create: {} } : undefined,
				},
			});
			await writeAudit(tx, {
				actorId: created.id,
				action: "USER_REGISTERED",
				entity: "User",
				entityId: created.id,
				metadata: { role, provider: "GOOGLE" },
			});
			return created;
		});
	} else if (!user.googleId) {
		user = await prisma.user.update({
			where: { id: user.id },
			data: { googleId: googlePayload.sub, emailVerified: true },
		});
	}

	const tokens = await issueTokens(user);
	return { user: publicAuthUser(user), ...tokens };
};

const forgotPassword = async (emailInput: string) => {
	const email = emailInput.trim().toLowerCase();
	const user = await prisma.user.findUnique({ where: { email } });

	if (!user || user.isDeleted || !user.password) {
		return { resetToken: undefined as string | undefined };
	}

	const rawToken = createRawToken();
	await prisma.passwordReset.create({
		data: {
			tokenHash: hashToken(rawToken),
			userId: user.id,
			expiresAt: new Date(Date.now() + 15 * 60 * 1000),
		},
	});

	return {
		resetToken: config.node_env === "development" ? rawToken : undefined,
	};
};

const resetPassword = async (payload: { token: string; password: string }) => {
	const stored = await prisma.passwordReset.findUnique({
		where: { tokenHash: hashToken(payload.token) },
	});

	if (!stored || stored.used || stored.expiresAt < new Date()) {
		throw new AppError(400, "Reset token is invalid or expired");
	}

	const hashedPassword = await bcrypt.hash(payload.password, config.bcrypt_salt_rounds);

	await prisma.$transaction([
		prisma.user.update({
			where: { id: stored.userId },
			data: { password: hashedPassword },
		}),
		prisma.passwordReset.update({
			where: { id: stored.id },
			data: { used: true },
		}),
		prisma.refreshToken.deleteMany({ where: { userId: stored.userId } }),
	]);

	return null;
};

export const AuthService = {
	register,
	login,
	refreshToken,
	logout,
	googleLogin,
	forgotPassword,
	resetPassword,
};
