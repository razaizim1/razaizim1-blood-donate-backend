import { z } from "zod";

export const changeRoleSchema = z.object({
	role: z.enum(["DONOR", "PATIENT", "ADMIN"]),
});

export const changeStatusSchema = z.object({
	status: z.enum(["ACTIVE", "BLOCKED"]),
});
