import { z } from "zod";
import { bloodGroupSchema } from "../auth/auth.validation";

export const createRequestSchema = z.object({
	bloodGroup: bloodGroupSchema,
	units: z.number().int().min(1).max(5).default(1),
	urgency: z.enum(["NORMAL", "URGENT", "CRITICAL"]).default("URGENT"),
	hospitalName: z.string().trim().min(2).max(120),
	district: z.string().trim().min(2).max(60),
	area: z.string().trim().max(80).optional(),
	contactPhone: z.string().trim().min(11).max(20),
	reason: z.string().trim().min(5).max(500),
	neededBy: z.coerce.date().refine((date) => date.getTime() > Date.now(), {
		message: "neededBy must be a future date",
	}),
});

export const updateRequestSchema = z
	.object({
		units: z.number().int().min(1).max(5).optional(),
		urgency: z.enum(["NORMAL", "URGENT", "CRITICAL"]).optional(),
		hospitalName: z.string().trim().min(2).max(120).optional(),
		district: z.string().trim().min(2).max(60).optional(),
		area: z.string().trim().max(80).optional(),
		contactPhone: z.string().trim().min(11).max(20).optional(),
		reason: z.string().trim().min(5).max(500).optional(),
		neededBy: z.coerce.date().optional(),
	})
	.refine((data) => Object.keys(data).length > 0, {
		message: "At least one field is required",
	});

export const rejectRequestSchema = z.object({
	note: z.string().trim().min(3).max(300),
});
