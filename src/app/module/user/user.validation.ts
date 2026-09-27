import { z } from "zod";

export const updateMeSchema = z
	.object({
		name: z.string().trim().min(2).max(80).optional(),
		phone: z.string().trim().min(11).max(20).optional(),
		district: z.string().trim().min(2).max(60).optional(),
		address: z.string().trim().max(200).optional(),
	})
	.refine((data) => Object.keys(data).length > 0, {
		message: "At least one field is required",
	});
