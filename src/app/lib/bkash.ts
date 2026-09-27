import config from "../config";
import { AppError } from "../utils/AppError";
import { cache } from "./cache";

const ID_TOKEN_KEY = "bkash:idToken";

export const getBkashIdToken = async () => {
	const cached = cache.get(ID_TOKEN_KEY);
	if (cached) {
		return cached;
	}

	const response = await fetch(`${config.bkash_base_url}/tokenized/checkout/token/grant`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Accept: "application/json",
			username: config.bkash_username,
			password: config.bkash_password,
		},
		body: JSON.stringify({
			app_key: config.bkash_app_key,
			app_secret: config.bkash_app_secret,
		}),
	});

	const result = (await response.json()) as {
		id_token?: string;
		statusMessage?: string;
		msg?: string;
	};

	if (!response.ok || !result.id_token) {
		throw new AppError(
			502,
			result.statusMessage || result.msg || "bKash token grant failed",
		);
	}

	cache.set(ID_TOKEN_KEY, result.id_token, 50 * 60);
	return result.id_token;
};
