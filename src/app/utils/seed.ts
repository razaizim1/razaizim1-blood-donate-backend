import bcrypt from "bcryptjs";
import config from "../config";
import { prisma } from "../lib/prisma";
import { addDays } from "./bloodCompatibility";

const upsertUser = async (input: {
	name: string;
	email: string;
	password: string;
	role: "ADMIN" | "DONOR" | "PATIENT";
	district?: string;
	phone?: string;
}) => {
	const password = await bcrypt.hash(input.password, config.bcrypt_salt_rounds);
	return prisma.user.upsert({
		where: { email: input.email },
		update: {
			name: input.name,
			password,
			role: input.role,
			status: "ACTIVE",
			isDeleted: false,
			deletedAt: null,
			emailVerified: true,
			district: input.district,
			phone: input.phone,
		},
		create: {
			name: input.name,
			email: input.email,
			password,
			role: input.role,
			status: "ACTIVE",
			emailVerified: true,
			district: input.district,
			phone: input.phone,
		},
	});
};

export const seedDemoData = async () => {
	const admin = await upsertUser({
		name: config.super_admin_name,
		email: config.super_admin_email.toLowerCase(),
		password: config.super_admin_password,
		role: "ADMIN",
		district: "Dhaka",
		phone: "01700000001",
	});

	const patient = await upsertUser({
		name: "Demo Patient",
		email: "patient@bloodlink.com",
		password: "Patient@12345",
		role: "PATIENT",
		district: "Dhaka",
		phone: "01700000002",
	});

	await prisma.patientProfile.upsert({
		where: { userId: patient.id },
		update: { bloodGroup: "A_POSITIVE", district: "Dhaka", emergencyContact: "01700000002" },
		create: {
			userId: patient.id,
			bloodGroup: "A_POSITIVE",
			district: "Dhaka",
			emergencyContact: "01700000002",
		},
	});

	const donors = [
		{
			name: "Demo Donor",
			email: "donor@bloodlink.com",
			bloodGroup: "O_POSITIVE" as const,
			district: "Dhaka",
			phone: "01700000003",
			availability: "AVAILABLE" as const,
			lastDonationDate: null as Date | null,
		},
		{
			name: "Universal Donor",
			email: "donor.onega@bloodlink.com",
			bloodGroup: "O_NEGATIVE" as const,
			district: "Dhaka",
			phone: "01700000004",
			availability: "AVAILABLE" as const,
			lastDonationDate: null as Date | null,
		},
		{
			name: "Chattogram Donor",
			email: "donor.chattogram@bloodlink.com",
			bloodGroup: "A_POSITIVE" as const,
			district: "Chattogram",
			phone: "01700000005",
			availability: "AVAILABLE" as const,
			lastDonationDate: null as Date | null,
		},
		{
			name: "Cooldown Donor",
			email: "donor.cooldown@bloodlink.com",
			bloodGroup: "B_POSITIVE" as const,
			district: "Dhaka",
			phone: "01700000006",
			availability: "COOLDOWN" as const,
			lastDonationDate: addDays(new Date(), -10),
		},
	];

	for (const donor of donors) {
		const user = await upsertUser({
			name: donor.name,
			email: donor.email,
			password: "Donor@12345",
			role: "DONOR",
			district: donor.district,
			phone: donor.phone,
		});

		await prisma.donorProfile.upsert({
			where: { userId: user.id },
			update: {
				bloodGroup: donor.bloodGroup,
				district: donor.district,
				availability: donor.availability,
				isEligible: donor.availability === "AVAILABLE",
				lastDonationDate: donor.lastDonationDate,
				nextEligibleAt: donor.lastDonationDate
					? addDays(donor.lastDonationDate, config.donation_cooldown_days)
					: null,
			},
			create: {
				userId: user.id,
				bloodGroup: donor.bloodGroup,
				district: donor.district,
				availability: donor.availability,
				isEligible: donor.availability === "AVAILABLE",
				lastDonationDate: donor.lastDonationDate,
				nextEligibleAt: donor.lastDonationDate
					? addDays(donor.lastDonationDate, config.donation_cooldown_days)
					: null,
			},
		});
	}

	const demoRequest = {
		patientId: patient.id,
		bloodGroup: "A_POSITIVE" as const,
		units: 2,
		urgency: "CRITICAL" as const,
		hospitalName: "Dhaka Medical College Hospital",
		district: "Dhaka",
		area: "Shahbag",
		contactPhone: "01700000002",
		reason: "Emergency surgery needs A positive blood",
		neededBy: addDays(new Date(), 2),
		status: "VERIFIED" as const,
		serviceFee: config.service_fee_bdt,
		deletedAt: null,
		rejectionNote: null,
	};

	const existingRequest = await prisma.bloodRequest.findFirst({
		where: { hospitalName: demoRequest.hospitalName, patientId: patient.id },
	});

	if (!existingRequest) {
		await prisma.bloodRequest.create({ data: demoRequest });
	} else {
		await prisma.donation.deleteMany({ where: { requestId: existingRequest.id } });
		await prisma.bloodRequest.update({
			where: { id: existingRequest.id },
			data: demoRequest,
		});
	}

	console.log(`Demo admin ready: ${admin.email}`);
};
