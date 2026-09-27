export type ListQuery = {
	page?: string;
	limit?: string;
	sortBy?: string;
	sortOrder?: string;
	search?: string;
	status?: string;
	bloodGroup?: string;
	district?: string;
	availability?: string;
	urgency?: string;
	role?: string;
	action?: string;
};

export const getPagination = (query: ListQuery) => {
	const page = Math.max(Number(query.page) || 1, 1);
	const limit = Math.min(Math.max(Number(query.limit) || 10, 1), 50);
	const skip = (page - 1) * limit;
	const sortOrder: "asc" | "desc" = query.sortOrder === "asc" ? "asc" : "desc";
	return { page, limit, skip, sortOrder };
};

export const routeId = (value: string | string[] | undefined) => {
	const id = Array.isArray(value) ? value[0] : value;
	if (!id) {
		throw new Error("Missing route id");
	}
	return id;
};

export const pickSort = (sortBy: string | undefined, allowed: string[], fallback: string) => {
	if (sortBy && allowed.includes(sortBy)) {
		return sortBy;
	}
	return fallback;
};
