type CacheEntry = {
	value: string;
	expiresAt: number;
};

const store = new Map<string, CacheEntry>();

export const cache = {
	get(key: string) {
		const item = store.get(key);
		if (!item) {
			return null;
		}
		if (Date.now() > item.expiresAt) {
			store.delete(key);
			return null;
		}
		return item.value;
	},
	set(key: string, value: string, ttlSeconds: number) {
		store.set(key, {
			value,
			expiresAt: Date.now() + ttlSeconds * 1000,
		});
	},
	del(key: string) {
		store.delete(key);
	},
};
