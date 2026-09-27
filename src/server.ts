import app from "./app";
import config from "./app/config";
import { prisma } from "./app/lib/prisma";
import { seedDemoData } from "./app/utils/seed";

const main = async () => {
	await prisma.$connect();
	console.log("Database connected");
	await seedDemoData();
	app.listen(config.port, () => {
		console.log(`BloodLink API running on port ${config.port}`);
	});
};

if (!process.env.VERCEL) {
	main().catch(async (error) => {
		console.error("Failed to start server", error);
		await prisma.$disconnect();
		process.exit(1);
	});
}

export default app;
