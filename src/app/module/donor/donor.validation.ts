import { z } from "zod";
import { bloodGroupSchema } from "../auth/auth.validation";

export const createDonorProfileSchema = z.object({
	bloodGroup: bloodGroupSchema,
	district: z.string().trim().min(2).max(60),
	area: z.string().trim().max(80).optional(),
});

export const updateDonorProfileSchema = z
	.object({
		bloodGroup: bloodGroupSchema.optional(),
		district: z.string().trim().min(2).max(60).optional(),
		area: z.string().trim().max(80).optional(),
	})
	.refine((data) => Object.keys(data).length > 0, {
		message: "At least one field is required",
	});

export const availabilitySchema = z.object({
	availability: z.enum(["AVAILABLE", "UNAVAILABLE"]),
});
