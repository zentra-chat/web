import { writable, derived, get } from 'svelte/store';
import type { Community, Channel, ChannelCategory, CommunityMember, Message } from '$lib/types';
import { activeInstance, currentUserId } from './instance';

// Currently selected community
export const activeCommunityId = writable<string | null>(null);

// Currently selected channel
export const activeChannelId = writable<string | null>(null);

// Communities cache per instance
export const communitiesCache = writable<Record<string, Community[]>>({});

// Channels cache per community
export const channelsCache = writable<Record<string, Channel[]>>({});

// Categories cache per community
export const categoriesCache = writable<Record<string, ChannelCategory[]>>({});

// Members cache per community
export const membersCache = writable<Record<string, CommunityMember[]>>({});

// Messages cache per channel
export const messagesCache = writable<Record<string, Message[]>>({});

// Unread counts per channel
export const unreadCounts = writable<Record<string, number>>({});

// Loading states
export const isLoadingCommunities = writable(false);
export const isLoadingChannels = writable(false);
export const isLoadingMessages = writable(false);

// Derived stores
export const activeCommunity = derived(
	[communitiesCache, activeCommunityId],
	([$cache, $activeId]) => {
		if (!$activeId) return null;
		for (const communities of Object.values($cache)) {
			const found = communities.find((c) => c.id === $activeId);
			if (found) return found;
		}
		return null;
	}
);

export const activeChannel = derived(
	[channelsCache, activeChannelId],
	([$cache, $activeId]) => {
		if (!$activeId) return null;
		for (const channels of Object.values($cache)) {
			const found = channels.find((c) => c.id === $activeId);
			if (found) return found;
		}
		return null;
	}
);

export const activeCommunityChannels = derived(
	[channelsCache, activeCommunityId],
	([$cache, $communityId]) => {
		if (!$communityId) return [];
		return $cache[$communityId] || [];
	}
);

export const activeCommunityCategories = derived(
	[categoriesCache, activeCommunityId],
	([$cache, $communityId]) => {
		if (!$communityId) return [];
		return $cache[$communityId] || [];
	}
);

export const activeCommunityMembers = derived(
	[membersCache, activeCommunityId],
	([$cache, $communityId]) => {
		if (!$communityId) return [];
		return $cache[$communityId] || [];
	}
);

export const activeChannelMessages = derived(
	[messagesCache, activeChannelId],
	([$cache, $channelId]) => {
		if (!$channelId) return [];
		return $cache[$channelId] || [];
	}
);

// Cache management functions
export function setCommunities(communities: Community[]): void {
	const instance = get(activeInstance);
	if (!instance) return;

	communitiesCache.update((cache) => ({
		...cache,
		[instance.id]: communities
	}));
}

export function addCommunity(community: Community): void {
	const instance = get(activeInstance);
	if (!instance) return;

	communitiesCache.update((cache) => ({
		...cache,
		[instance.id]: [...(cache[instance.id] || []), community]
	}));
}

export function updateCommunity(communityId: string, updates: Partial<Community>): void {
	communitiesCache.update((cache) => {
		const result: Record<string, Community[]> = {};
		for (const [key, communities] of Object.entries(cache)) {
			result[key] = communities.map((c) => (c.id === communityId ? { ...c, ...updates } : c));
		}
		return result;
	});
}

export function removeCommunity(communityId: string): void {
	communitiesCache.update((cache) => {
		const result: Record<string, Community[]> = {};
		for (const [key, communities] of Object.entries(cache)) {
			result[key] = communities.filter((c) => c.id !== communityId);
		}
		return result;
	});

	// Clear related caches
	channelsCache.update((cache) => {
		const { [communityId]: _, ...rest } = cache;
		return rest;
	});
	categoriesCache.update((cache) => {
		const { [communityId]: _, ...rest } = cache;
		return rest;
	});
	membersCache.update((cache) => {
		const { [communityId]: _, ...rest } = cache;
		return rest;
	});
}

export function setChannels(communityId: string, channels: Channel[]): void {
	channelsCache.update((cache) => ({
		...cache,
		[communityId]: channels
	}));
}

export function addChannel(communityId: string, channel: Channel): void {
	channelsCache.update((cache) => ({
		...cache,
		[communityId]: [...(cache[communityId] || []), channel]
	}));
}

export function updateChannel(channel: Channel): void {
	channelsCache.update((cache) => ({
		...cache,
		[channel.communityId]: (cache[channel.communityId] || []).map((c) =>
			c.id === channel.id ? channel : c
		)
	}));
}

export function removeChannel(communityId: string, channelId: string): void {
	channelsCache.update((cache) => ({
		...cache,
		[communityId]: (cache[communityId] || []).filter((c) => c.id !== channelId)
	}));

	// Clear messages cache
	messagesCache.update((cache) => {
		const { [channelId]: _, ...rest } = cache;
		return rest;
	});
}

export function setCategories(communityId: string, categories: ChannelCategory[]): void {
	categoriesCache.update((cache) => ({
		...cache,
		[communityId]: categories
	}));
}

export function setMembers(communityId: string, members: CommunityMember[]): void {
	membersCache.update((cache) => ({
		...cache,
		[communityId]: members
	}));
}

export function setMessages(channelId: string, messages: Message[]): void {
	messagesCache.update((cache) => ({
		...cache,
		[channelId]: messages
	}));
}

export function addMessage(channelId: string, message: Message): void {
	messagesCache.update((cache) => {
		const channelMsgs = cache[channelId] || [];
		if (channelMsgs.some((m) => m.id === message.id)) {
			return cache;
		}
		return {
			...cache,
			[channelId]: [...channelMsgs, message]
		};
	});
}

export function updateMessage(channelId: string, messageId: string, updates: Partial<Message>): void {
	messagesCache.update((cache) => ({
		...cache,
		[channelId]: (cache[channelId] || []).map((m) =>
			m.id === messageId ? { ...m, ...updates } : m
		)
	}));
}

export function removeMessage(channelId: string, messageId: string): void {
	messagesCache.update((cache) => ({
		...cache,
		[channelId]: (cache[channelId] || []).filter((m) => m.id !== messageId)
	}));
}

export function addMessageReaction(
	channelId: string,
	messageId: string,
	userId: string,
	emoji: string
): void {
	const currentId = get(currentUserId);
	messagesCache.update((cache) => {
		const channelMsgs = cache[channelId] || [];
		return {
			...cache,
			[channelId]: channelMsgs.map((m) => {
				if (m.id !== messageId) return m;

				const reactions = [...(m.reactions || [])];
				const existingIndex = reactions.findIndex((r) => r.emoji === emoji);

				if (existingIndex !== -1) {
					const r = reactions[existingIndex];
					reactions[existingIndex] = {
						...r,
						count: r.count + 1,
						reacted: r.reacted || userId === currentId
					};
				} else {
					reactions.push({
						emoji,
						count: 1,
						reacted: userId === currentId
					});
				}

				return { ...m, reactions };
			})
		};
	});
}

export function removeMessageReaction(
	channelId: string,
	messageId: string,
	userId: string,
	emoji: string
): void {
	const currentId = get(currentUserId);
	messagesCache.update((cache) => {
		const channelMsgs = cache[channelId] || [];
		return {
			...cache,
			[channelId]: channelMsgs.map((m) => {
				if (m.id !== messageId) return m;

				const reactions = (m.reactions || [])
					.map((r) => {
						if (r.emoji !== emoji) return r;
						return {
							...r,
							count: Math.max(0, r.count - 1),
							reacted: userId === currentId ? false : r.reacted
						};
					})
					.filter((r) => r.count > 0);

				return { ...m, reactions };
			})
		};
	});
}

export function prependMessages(channelId: string, messages: Message[]): void {
	messagesCache.update((cache) => ({
		...cache,
		[channelId]: [...messages, ...(cache[channelId] || [])]
	}));
}

export function clearUnread(channelId: string): void {
	unreadCounts.update((counts) => ({
		...counts,
		[channelId]: 0
	}));
}

export function incrementUnread(channelId: string): void {
	unreadCounts.update((counts) => ({
		...counts,
		[channelId]: (counts[channelId] || 0) + 1
	}));
}

export function selectCommunity(communityId: string | null): void {
	activeCommunityId.set(communityId);
	activeChannelId.set(null);
}

export function selectChannel(channelId: string | null): void {
	activeChannelId.set(channelId);
	if (channelId) {
		clearUnread(channelId);
	}
}

export function setActiveCommunity(community: Community | null): void {
	activeCommunityId.set(community?.id || null);
	activeChannelId.set(null);
}

export function setActiveChannel(channel: Channel | null): void {
	activeChannelId.set(channel?.id || null);
	if (channel?.id) {
		clearUnread(channel.id);
	}
}

// Messages alias for direct access
export const messages = messagesCache;
