import { writable, derived, get } from 'svelte/store';
import { PUBLIC_DEFAULT_INSTANCE_URL, PUBLIC_DEFAULT_INSTANCE_NAME } from '$env/static/public';
import type { Instance, InstanceAuth, FullUser } from '$lib/types';

// Storage keys
const INSTANCES_KEY = 'zentra_instances';
const AUTH_KEY = 'zentra_auth';
const SAVED_ACCOUNTS_KEY = 'zentra_saved_accounts';
const ACTIVE_INSTANCE_KEY = 'zentra_active_instance';

export interface SavedAccountSession {
	userId: string;
	username: string;
	displayName: string;
	avatarUrl: string | null;
	email: string;
	auth: InstanceAuth;
	lastUsedAt: string;
}

// Default instance from environment
const DEFAULT_INSTANCE: Instance | null = PUBLIC_DEFAULT_INSTANCE_URL
	? {
			id: 'default',
			url: PUBLIC_DEFAULT_INSTANCE_URL,
			name: PUBLIC_DEFAULT_INSTANCE_NAME || 'Default Instance',
			isOnline: true,
			lastChecked: new Date().toISOString()
		}
	: null;

// Helper to safely access localStorage
function getFromStorage<T>(key: string, defaultValue: T): T {
	if (typeof window === 'undefined') return defaultValue;
	try {
		const item = localStorage.getItem(key);
		return item ? JSON.parse(item) : defaultValue;
	} catch {
		return defaultValue;
	}
}

function setToStorage<T>(key: string, value: T): void {
	if (typeof window === 'undefined') return;
	try {
		localStorage.setItem(key, JSON.stringify(value));
	} catch {
		console.error('Failed to save to localStorage:', key);
	}
}

// Create persistent writable store
function persistentWritable<T>(key: string, defaultValue: T) {
	const store = writable<T>(getFromStorage(key, defaultValue));

	store.subscribe((value) => {
		setToStorage(key, value);
	});

	return store;
}

// Instances store - list of all added backend instances
export const instances = persistentWritable<Instance[]>(
	INSTANCES_KEY,
	DEFAULT_INSTANCE ? [DEFAULT_INSTANCE] : []
);

// Active instance ID
export const activeInstanceId = persistentWritable<string | null>(
	ACTIVE_INSTANCE_KEY,
	DEFAULT_INSTANCE?.id || null
);

// Auth data per instance
export const instanceAuth = persistentWritable<Record<string, InstanceAuth>>(AUTH_KEY, {});

// Saved account sessions per instance (for quick account switch)
export const savedAccounts = persistentWritable<Record<string, SavedAccountSession[]>>(
	SAVED_ACCOUNTS_KEY,
	{}
);

// Derived store for active instance
export const activeInstance = derived(
	[instances, activeInstanceId],
	([$instances, $activeInstanceId]) => {
		if (!$activeInstanceId) return null;
		return $instances.find((i) => i.id === $activeInstanceId) || null;
	}
);

// Derived store for active instance auth
export const activeAuth = derived(
	[instanceAuth, activeInstanceId],
	([$instanceAuth, $activeInstanceId]) => {
		if (!$activeInstanceId) return null;
		return $instanceAuth[$activeInstanceId] || null;
	}
);

// Derived store for current user
export const currentUser = derived(activeAuth, ($activeAuth) => {
	return $activeAuth?.user || null;
});

export const activeInstanceSavedAccounts = derived(
	[savedAccounts, activeInstanceId, activeAuth],
	([$savedAccounts, $activeInstanceId, $activeAuth]) => {
		if (!$activeInstanceId) return [];
		const accounts = $savedAccounts[$activeInstanceId] || [];
		const activeUserId = $activeAuth?.user?.id || null;

		return [...accounts].sort((a, b) => {
			if (a.userId === activeUserId) return -1;
			if (b.userId === activeUserId) return 1;
			return new Date(b.lastUsedAt).getTime() - new Date(a.lastUsedAt).getTime();
		});
	}
);

// Derived store to check if logged in to active instance
export const isLoggedIn = derived(activeAuth, ($activeAuth) => {
	if (!$activeAuth) return false;
	return new Date($activeAuth.expiresAt) > new Date();
});

// Instance management functions
export function addInstance(instance: Instance): void {
	instances.update((list) => {
		// Check for duplicate URL
		if (list.some((i) => i.url === instance.url)) {
			return list;
		}
		return [...list, instance];
	});
}

export function removeInstance(instanceId: string): void {
	instances.update((list) => list.filter((i) => i.id !== instanceId));
	instanceAuth.update((auth) => {
		const { [instanceId]: removed, ...rest } = auth;
		void removed;
		return rest;
	});

	// If removing active instance, clear active
	if (get(activeInstanceId) === instanceId) {
		const remaining = get(instances);
		activeInstanceId.set(remaining.length > 0 ? remaining[0].id : null);
	}
}

export function updateInstance(instanceId: string, updates: Partial<Instance>): void {
	instances.update((list) =>
		list.map((i) => (i.id === instanceId ? { ...i, ...updates } : i))
	);
}

export function setActiveInstance(instanceId: string | null): void {
	activeInstanceId.set(instanceId);
}

export function setInstanceAuth(instanceId: string, auth: InstanceAuth): void {
	instanceAuth.update((current) => ({
		...current,
		[instanceId]: auth
	}));

	const user = auth.user;
	const now = new Date().toISOString();
	savedAccounts.update((current) => {
		const instanceAccounts = current[instanceId] || [];
		const nextSession: SavedAccountSession = {
			userId: user.id,
			username: user.username,
			displayName: user.displayName || user.username,
			avatarUrl: user.avatarUrl || null,
			email: user.email || '',
			auth,
			lastUsedAt: now
		};

		const nextInstanceAccounts = [
			nextSession,
			...instanceAccounts.filter((account) => account.userId !== user.id)
		];

		return {
			...current,
			[instanceId]: nextInstanceAccounts
		};
	});
}

export function clearInstanceAuth(instanceId: string): void {
	instanceAuth.update((current) => {
		const { [instanceId]: removed, ...rest } = current;
		void removed;
		return rest;
	});
}

export function removeSavedAccount(instanceId: string, userId: string): void {
	savedAccounts.update((current) => {
		const instanceAccounts = current[instanceId] || [];
		const nextInstanceAccounts = instanceAccounts.filter((account) => account.userId !== userId);

		if (nextInstanceAccounts.length === 0) {
			const { [instanceId]: removed, ...rest } = current;
			void removed;
			return rest;
		}

		return {
			...current,
			[instanceId]: nextInstanceAccounts
		};
	});
}

export function switchActiveAccount(userId: string): boolean {
	const instanceId = get(activeInstanceId);
	if (!instanceId) return false;

	const instanceAccounts = get(savedAccounts)[instanceId] || [];
	const selected = instanceAccounts.find((account) => account.userId === userId);
	if (!selected) return false;

	if (new Date(selected.auth.expiresAt) <= new Date()) {
		removeSavedAccount(instanceId, userId);
		return false;
	}

	setInstanceAuth(instanceId, selected.auth);
	return true;
}

export function updateInstanceUser(instanceId: string, user: FullUser): void {
	instanceAuth.update((current) => {
		if (!current[instanceId]) return current;
		return {
			...current,
			[instanceId]: {
				...current[instanceId],
				user
			}
		};
	});
}

// Generate unique instance ID
export function generateInstanceId(): string {
	return `inst_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

// Alias for current instance
export const currentInstance = activeInstance;

// Check if authenticated for current instance
export const isAuthenticated = isLoggedIn;

// Current user ID
export const currentUserId = derived(currentUser, ($user) => $user?.id || null);

// Load instances from storage (for initialization)
export function loadInstances(): void {
	// Instances are already loaded via persistent store
	// This function exists for explicit initialization if needed
}

// Update current user
export function updateCurrentUser(updates: Partial<FullUser>): void {
	const activeId = get(activeInstanceId);
	if (!activeId) return;

	instanceAuth.update((current) => {
		if (!current[activeId]) return current;
		const baseUser = current[activeId].user ?? ({} as FullUser);
		return {
			...current,
			[activeId]: {
				...current[activeId],
				user: { ...baseUser, ...updates } as FullUser
			}
		};
	});
}

// Logout from current instance
export function logout(options?: { removeSavedAccount?: boolean }): void {
	const activeId = get(activeInstanceId);
	if (activeId) {
		if (options?.removeSavedAccount) {
			const auth = get(activeAuth);
			if (auth?.user?.id) {
				removeSavedAccount(activeId, auth.user.id);
			}
		}
		clearInstanceAuth(activeId);
	}
}
