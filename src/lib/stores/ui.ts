import { writable, derived } from 'svelte/store';
import type {
	ToastMessage,
	UserStatus,
	Message,
	User,
	UserSettings,
	InstanceSelectorMode
} from '$lib/types';

// Sidebar states
export const isCommunitySidebarCollapsed = writable(false);
export const showMemberSidebar = writable(true);
export const isMobileMenuOpen = writable(false);

// Modal states
export const instanceModalOpen = writable(false);
export const createCommunityModalOpen = writable(false);
export const createChannelModalOpen = writable(false);
export const profileCardOpen = writable(false);
export const profileCardUser = writable<User | null>(null);
export const profileCardPosition = writable({ x: 0, y: 0 });
export const filePreviewOpen = writable(false);
export const filePreviewData = writable<unknown | null>(null);

export const createChannelModalData = writable<{ categoryId: string | null }>({ categoryId: null });

// Toast notifications
export const toasts = writable<ToastMessage[]>([]);

// Notification previews (Discord-style message preview cards)
export interface NotificationPreview {
	id: string;
	actorAvatarUrl: string | null;
	actorName: string;
	title: string;
	body: string | null;
	duration: number;
	onClick?: () => void;
}

export const notificationPreviews = writable<NotificationPreview[]>([]);

// Quick switcher (Ctrl+K)
export const isQuickSwitcherOpen = writable(false);

// Reply state
export const replyingToMessage = writable<Message | null>(null);

// Editing state
export const editingMessageId = writable<string | null>(null);

// Typing indicators per channel
export const typingUsers = writable<Record<string, { userId: string; username: string; timestamp: number }[]>>({});

// Online users per community
export const onlineUsers = writable<Record<string, string[]>>({});

// User presence cache
export const userPresence = writable<Record<string, { status: UserStatus; customStatus?: string }>>({});

// Instance selector visibility
export const instanceSelectorMode = writable<InstanceSelectorMode>('disabled');

// User settings cache
export const userSettings = writable<UserSettings | null>(null);

function normalizeInstanceSelectorMode(value: unknown): InstanceSelectorMode {
	if (value === 'auto' || value === 'show' || value === 'disabled') {
		return value;
	}
	return 'disabled';
}

export function applyUserSettings(settings: UserSettings): void {
	userSettings.set(settings);
	instanceSelectorMode.set(normalizeInstanceSelectorMode(settings.settings?.instanceSelectorMode));
}

// Modal functions
export function openModal(type: string, data?: unknown): void {
	// Map to specific stores for consistency
	if (type === 'createCommunity') createCommunityModalOpen.set(true);
	if (type === 'createChannel') {
		const maybeCategoryId =
			data && typeof data === 'object' && 'categoryId' in data
				? (data as { categoryId?: unknown }).categoryId
				: null;
		createChannelModalData.set({
			categoryId: typeof maybeCategoryId === 'string' ? maybeCategoryId : null
		});
		createChannelModalOpen.set(true);
	}
	if (type === 'instance') instanceModalOpen.set(true);
}

export function closeModal(): void {
	createCommunityModalOpen.set(false);
	createChannelModalOpen.set(false);
	instanceModalOpen.set(false);
}

export function openProfileCard(user: User, event?: MouseEvent): void {
	profileCardUser.set(user);
	if (event) {
		// Calculate position, ensuring it's not off-screen
		let x = event.clientX;
		let y = event.clientY;

		// Basic adjustment to keep within viewport
		// These values need to be changed later
		const cardWidth = 300;
		const cardHeight = 400;

		if (x + cardWidth > window.innerWidth) x = window.innerWidth - cardWidth - 20;
		if (y + cardHeight > window.innerHeight) y = window.innerHeight - cardHeight - 20;

		profileCardPosition.set({ x, y });
	}
	profileCardOpen.set(true);
}

export function closeProfileCard(): void {
	profileCardOpen.set(false);
	profileCardUser.set(null);
}

// Toast functions
let toastIdCounter = 0;

export function showToast(
	type: 'success' | 'error' | 'warning' | 'info',
	message: string,
	duration = 5000
): string {
	const id = `toast_${++toastIdCounter}`;
	toasts.update((list) => [...list, { id, type, message, duration }]);

	if (duration > 0) {
		setTimeout(() => {
			dismissToast(id);
		}, duration);
	}

	return id;
}

export function addToast(options: {
	type: 'success' | 'error' | 'warning' | 'info';
	message: string;
	duration?: number;
}): string {
	return showToast(options.type, options.message, options.duration ?? 5000);
}

export function dismissToast(id: string): void {
	toasts.update((list) => list.filter((t) => t.id !== id));
}

let notifPreviewIdCounter = 0;

export function showNotificationPreview(
	preview: Omit<NotificationPreview, 'id'>
): string {
	const id = `notif_${++notifPreviewIdCounter}`;
	notificationPreviews.update((list) => [...list, { ...preview, id }]);
	if (preview.duration > 0) {
		setTimeout(() => dismissNotificationPreview(id), preview.duration);
	}
	return id;
}

export function dismissNotificationPreview(id: string): void {
	notificationPreviews.update((list) => list.filter((n) => n.id !== id));
}

// Typing indicator functions
export function setTyping(channelId: string, userId: string, username: string): void {
	typingUsers.update((current) => {
		const channelTyping = current[channelId] || [];
		const existing = channelTyping.find((t) => t.userId === userId);

		if (existing) {
			return {
				...current,
				[channelId]: channelTyping.map((t) =>
					t.userId === userId ? { ...t, timestamp: Date.now() } : t
				)
			};
		}

		return {
			...current,
			[channelId]: [...channelTyping, { userId, username, timestamp: Date.now() }]
		};
	});

	// Auto-remove after 5 seconds
	setTimeout(() => {
		clearTyping(channelId, userId);
	}, 5000);
}

export function clearTyping(channelId: string, userId: string): void {
	typingUsers.update((current) => ({
		...current,
		[channelId]: (current[channelId] || []).filter((t) => t.userId !== userId)
	}));
}

// Presence functions
export function setUserPresence(userId: string, status: UserStatus, customStatus?: string): void {
	userPresence.update((current) => ({
		...current,
		[userId]: { status, customStatus }
	}));

	// Also update in community members list
	import('./community').then((m) => {
		m.updateMemberUser(userId, { status, customStatus });
	});
}

export function setOnlineUsers(communityId: string, userIds: string[]): void {
	onlineUsers.update((current) => ({
		...current,
		[communityId]: userIds
	}));
}

// Derived stores
export const activeTypingUsers = derived(
	typingUsers,
	($typingUsers) => {
		// Filter out stale typing indicators (older than 5 seconds)
		const now = Date.now();
		const result: Record<string, { userId: string; username: string }[]> = {};

		for (const [channelId, users] of Object.entries($typingUsers)) {
			result[channelId] = users
				.filter((u) => now - u.timestamp < 5000)
				.map(({ userId, username }) => ({ userId, username }));
		}

		return result;
	}
);

// Sidebar toggle functions
export function toggleCommunitySidebar(): void {
	isCommunitySidebarCollapsed.update((v) => !v);
}

export function toggleMemberSidebar(): void {
	showMemberSidebar.update((v) => !v);
}

export function toggleMobileMenu(): void {
	isMobileMenuOpen.update((v) => !v);
}

export function closeMobileMenu(): void {
	isMobileMenuOpen.set(false);
}

// Reply functions
export function setReplyingTo(message: Message | null): void {
	replyingToMessage.set(message);
}

export function clearReplyingTo(): void {
	replyingToMessage.set(null);
}

// Edit functions
export function setEditingMessage(messageId: string | null): void {
	editingMessageId.set(messageId);
}

// Modal functions
export function openInstanceModal(): void {
	instanceModalOpen.set(true);
}

export function closeInstanceModal(): void {
	instanceModalOpen.set(false);
}

export function openCreateCommunityModal(): void {
	createCommunityModalOpen.set(true);
}

export function closeCreateCommunityModal(): void {
	createCommunityModalOpen.set(false);
}

export function openCreateChannelModal(): void {
	createChannelModalOpen.set(true);
}

export function closeCreateChannelModal(): void {
	createChannelModalOpen.set(false);
}

