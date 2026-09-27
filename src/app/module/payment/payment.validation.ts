import { z } from "zod";

export const initiatePaymentSchema = z.object({
	requestId: z.string().uuid(),
});
