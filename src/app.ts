import cookieParser from "cookie-parser";
import cors from "cors";
import express, { type Application, type Request, type Response } from "express";
import helmet from "helmet";
import config from "./app/config";
import { globalErrorHandler } from "./app/middleware/globalErrorHandler";
import { notFound } from "./app/middleware/notFound";
import { apiLimiter } from "./app/middleware/rateLimiter";
import { AdminRoutes } from "./app/module/admin/admin.route";
import { AuthRoutes } from "./app/module/auth/auth.route";
import { BloodRequestRoutes } from "./app/module/bloodRequest/bloodRequest.route";
import { DonationRoutes } from "./app/module/donation/donation.route";
import { DonorRoutes } from "./app/module/donor/donor.route";
import { PaymentRoutes } from "./app/module/payment/payment.route";
import { UserRoutes } from "./app/module/user/user.route";

const app: Application = express();

app.set("trust proxy", 1);
app.use(helmet());
app.use(
	cors({
		origin: config.frontend_url,
		credentials: true,
	}),
);
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use("/api", apiLimiter);

app.get("/", (_req: Request, res: Response) => {
	res.status(200).json({
		success: true,
		message: "BloodLink emergency blood donation API",
		data: { health: "ok" },
	});
});

app.use("/api/v1/auth", AuthRoutes);
app.use("/api/v1/users", UserRoutes);
app.use("/api/v1/donors", DonorRoutes);
app.use("/api/v1/blood-requests", BloodRequestRoutes);
app.use("/api/v1/donations", DonationRoutes);
app.use("/api/v1/payments", PaymentRoutes);
app.use("/api/v1/admin", AdminRoutes);

app.use(globalErrorHandler);
app.use(notFound);

export default app;
