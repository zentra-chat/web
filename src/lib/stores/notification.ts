import { writable, derived, get } from 'svelte/store';
import type { Notification } from '$lib/types';
import { activeInstance } from './instance';

// Per-instance notification storage (keyed by instanceId)
export const notificationsCache = writable<Record<string, Notification[]>>({});
export const unreadCountCache = writable<Record<string, number>>({});
export const notificationPanelOpen = writable(false);

// ---- Derived ----

export const notifications = derived(
	[notificationsCache, activeInstance],
	([$cache, $instance]) => {
		if (!$instance) return [] as Notification[];
		return $cache[$instance.id] ?? [];
	}
);

export const unreadCount = derived(
	[unreadCountCache, activeInstance],
	([$cache, $instance]) => {
		if (!$instance) return 0;
		return $cache[$instance.id] ?? 0;
	}
);

// ---- Setters ----

export function setNotifications(items: Notification[]): void {
	const instance = get(activeInstance);
	if (!instance) return;
	notificationsCache.update((c) => ({ ...c, [instance.id]: items }));
}

export function prependNotification(n: Notification): void {
	const instance = get(activeInstance);
	if (!instance) return;
	notificationsCache.update((c) => {
		const existing = c[instance.id] ?? [];
		// Avoid duplicates
		if (existing.some((x) => x.id === n.id)) return c;
		return { ...c, [instance.id]: [n, ...existing] };
	});
	incrementUnreadCount();
}

export function markNotificationReadLocal(id: string): void {
	const instance = get(activeInstance);
	if (!instance) return;

	let wasUnread = false;
	notificationsCache.update((c) => {
		const existing = c[instance.id] ?? [];
		const updated = existing.map((n) => {
			if (n.id === id && !n.isRead) {
				wasUnread = true;
				return { ...n, isRead: true };
			}
			return n;
		});
		return { ...c, [instance.id]: updated };
	});

	if (wasUnread) decrementUnreadCount();
}

export function markAllNotificationsReadLocal(): void {
	const instance = get(activeInstance);
	if (!instance) return;
	notificationsCache.update((c) => ({
		...c,
		[instance.id]: (c[instance.id] ?? []).map((n) => ({ ...n, isRead: true }))
	}));
	unreadCountCache.update((c) => ({ ...c, [instance.id]: 0 }));
}

export function removeNotificationLocal(id: string): void {
	const instance = get(activeInstance);
	if (!instance) return;
	notificationsCache.update((c) => ({
		...c,
		[instance.id]: (c[instance.id] ?? []).filter((n) => n.id !== id)
	}));
}

export function setUnreadCount(count: number): void {
	const instance = get(activeInstance);
	if (!instance) return;
	unreadCountCache.update((c) => ({ ...c, [instance.id]: count }));
}

function incrementUnreadCount(): void {
	const instance = get(activeInstance);
	if (!instance) return;
	unreadCountCache.update((c) => ({ ...c, [instance.id]: (c[instance.id] ?? 0) + 1 }));
}

function decrementUnreadCount(): void {
	const instance = get(activeInstance);
	if (!instance) return;
	unreadCountCache.update((c) => ({
		...c,
		[instance.id]: Math.max(0, (c[instance.id] ?? 0) - 1)
	}));
}

export function toggleNotificationPanel(): void {
	notificationPanelOpen.update((v) => !v);
}

export function closeNotificationPanel(): void {
	notificationPanelOpen.set(false);
}
