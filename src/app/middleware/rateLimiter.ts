import rateLimit from "express-rate-limit";

const rateLimitBody = {
	success: false,
	message: "Too many requests. Please try again later.",
	errors: [{ message: "Too many requests. Please try again later." }],
};

export const apiLimiter = rateLimit({
	windowMs: 15 * 60 * 1000,
	limit: 300,
	standardHeaders: true,
	legacyHeaders: false,
	message: rateLimitBody,
});

export const authLimiter = rateLimit({
	windowMs: 15 * 60 * 1000,
	limit: 30,
	standardHeaders: true,
	legacyHeaders: false,
	message: rateLimitBody,
});
