import jwt, { type JwtPayload, type SignOptions } from "jsonwebtoken";

const createToken = (payload: JwtPayload, secret: string, expiresIn: string) => {
	return jwt.sign(payload, secret, { expiresIn } as SignOptions);
};

const verifyToken = (token: string, secret: string) => {
	try {
		const verifiedToken = jwt.verify(token, secret);
		return { success: true as const, data: verifiedToken as JwtPayload };
	} catch (error) {
		const message = error instanceof Error ? error.message : "Invalid token";
		return { success: false as const, error: message };
	}
};

export const jwtUtils = { createToken, verifyToken };
