import { z } from "zod";

export const bloodGroupSchema = z.enum([
	"A_POSITIVE",
	"A_NEGATIVE",
	"B_POSITIVE",
	"B_NEGATIVE",
	"AB_POSITIVE",
	"AB_NEGATIVE",
	"O_POSITIVE",
	"O_NEGATIVE",
]);

export const registerSchema = z
	.object({
		name: z.string().trim().min(2).max(80),
		email: z.string().trim().email(),
		password: z
			.string()
			.min(8)
			.regex(/^(?=.*[A-Za-z])(?=.*\d).+$/, "Password must include a letter and a number"),
		role: z.enum(["DONOR", "PATIENT"]),
		phone: z.string().trim().min(11).max(20).optional(),
		district: z.string().trim().min(2).max(60).optional(),
		address: z.string().trim().max(200).optional(),
		donor: z
			.object({
				bloodGroup: bloodGroupSchema,
				district: z.string().trim().min(2).max(60),
				area: z.string().trim().max(80).optional(),
			})
			.optional(),
		patient: z
			.object({
				bloodGroup: bloodGroupSchema.optional(),
				district: z.string().trim().min(2).max(60).optional(),
				emergencyContact: z.string().trim().min(11).max(20).optional(),
			})
			.optional(),
	})
	.superRefine((data, ctx) => {
		if (data.role === "DONOR" && !data.donor) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: "Donor blood group and district are required",
				path: ["donor"],
			});
		}
	});

export const loginSchema = z.object({
	email: z.string().trim().email(),
	password: z.string().min(1),
});

export const googleLoginSchema = z.object({
	idToken: z.string().min(10),
	role: z.enum(["DONOR", "PATIENT"]).optional(),
});

export const forgotPasswordSchema = z.object({
	email: z.string().trim().email(),
});

export const resetPasswordSchema = z.object({
	token: z.string().min(10),
	password: z
		.string()
		.min(8)
		.regex(/^(?=.*[A-Za-z])(?=.*\d).+$/, "Password must include a letter and a number"),
});

export const refreshTokenSchema = z.object({
	refreshToken: z.string().min(10).optional(),
});
