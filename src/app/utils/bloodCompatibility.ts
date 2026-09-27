export const BLOOD_GROUPS = [
	"A_POSITIVE",
	"A_NEGATIVE",
	"B_POSITIVE",
	"B_NEGATIVE",
	"AB_POSITIVE",
	"AB_NEGATIVE",
	"O_POSITIVE",
	"O_NEGATIVE",
] as const;

export type BloodGroupName = (typeof BLOOD_GROUPS)[number];

const canReceiveFrom: Record<BloodGroupName, BloodGroupName[]> = {
	O_NEGATIVE: ["O_NEGATIVE"],
	O_POSITIVE: ["O_NEGATIVE", "O_POSITIVE"],
	A_NEGATIVE: ["O_NEGATIVE", "A_NEGATIVE"],
	A_POSITIVE: ["O_NEGATIVE", "O_POSITIVE", "A_NEGATIVE", "A_POSITIVE"],
	B_NEGATIVE: ["O_NEGATIVE", "B_NEGATIVE"],
	B_POSITIVE: ["O_NEGATIVE", "O_POSITIVE", "B_NEGATIVE", "B_POSITIVE"],
	AB_NEGATIVE: ["O_NEGATIVE", "A_NEGATIVE", "B_NEGATIVE", "AB_NEGATIVE"],
	AB_POSITIVE: [
		"O_NEGATIVE",
		"O_POSITIVE",
		"A_NEGATIVE",
		"A_POSITIVE",
		"B_NEGATIVE",
		"B_POSITIVE",
		"AB_NEGATIVE",
		"AB_POSITIVE",
	],
};

export const compatibleDonorGroups = (recipient: string) => {
	return canReceiveFrom[recipient as BloodGroupName] ?? [];
};

export const recipientGroupsForDonor = (donorGroup: string) => {
	return BLOOD_GROUPS.filter((recipient) =>
		canReceiveFrom[recipient].includes(donorGroup as BloodGroupName),
	);
};

export const addDays = (date: Date, days: number) => {
	const next = new Date(date);
	next.setDate(next.getDate() + days);
	return next;
};
