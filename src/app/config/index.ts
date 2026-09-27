import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(process.cwd(), ".env") });

const required = (key: string) => {
	const value = process.env[key];
	if (!value) {
		throw new Error(`Missing environment variable: ${key}`);
	}
	return value;
};

export default {
	node_env: process.env.NODE_ENV || "development",
	port: Number(process.env.PORT) || 8080,
	backend_url: process.env.BACKEND_URL || "http://localhost:8080",
	frontend_url: process.env.FRONTEND_URL || "http://localhost:3000",
	database_url: required("DATABASE_URL"),
	bcrypt_salt_rounds: Number(process.env.BCRYPT_SALT_ROUNDS) || 10,
	jwt_access_secret: required("JWT_ACCESS_SECRET"),
	jwt_refresh_secret: required("JWT_REFRESH_SECRET"),
	jwt_access_expires_in: process.env.JWT_ACCESS_EXPIRES_IN || "1d",
	jwt_refresh_expires_in: process.env.JWT_REFRESH_EXPIRES_IN || "7d",
	google_client_id: required("GOOGLE_CLIENT_ID"),
	google_client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
	super_admin_name: process.env.SUPER_ADMIN_NAME || "BloodLink Admin",
	super_admin_email: process.env.SUPER_ADMIN_EMAIL || "admin@bloodlink.com",
	super_admin_password: process.env.SUPER_ADMIN_PASSWORD || "Admin@12345",
	bkash_base_url: required("BKASH_BASE_URL"),
	bkash_username: required("BKASH_USERNAME"),
	bkash_password: required("BKASH_PASSWORD"),
	bkash_app_key: required("BKASH_APP_KEY"),
	bkash_app_secret: required("BKASH_APP_SECRET"),
	bkash_callback_url: required("BKASH_CALLBACK_URL"),
	service_fee_bdt: Number(process.env.SERVICE_FEE_BDT) || 100,
	donation_cooldown_days: Number(process.env.DONATION_COOLDOWN_DAYS) || 90,
};
