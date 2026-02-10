import { writable, derived, get } from 'svelte/store';
import type { Community, Channel, ChannelCategory, CommunityMember, Message, User } from '$lib/types';
import { activeInstance } from './instance';

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
		const { [communityId]: removed, ...rest } = cache;
		void removed;
		return rest;
	});
	categoriesCache.update((cache) => {
		const { [communityId]: removed, ...rest } = cache;
		void removed;
		return rest;
	});
	membersCache.update((cache) => {
		const { [communityId]: removed, ...rest } = cache;
		void removed;
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
		const { [channelId]: removed, ...rest } = cache;
		void removed;
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

export function updateMemberUser(userId: string, updates: Partial<User>): void {
	// Update members cache
	membersCache.update((cache) => {
		const newCache = { ...cache };
		for (const communityId in newCache) {
			newCache[communityId] = newCache[communityId].map((member) => {
				if (member.userId === userId) {
					return {
						...member,
						user: member.user ? { ...member.user, ...updates } : member.user
					};
				}
				return member;
			});
		}
		return newCache;
	});

	// Update messages cache (user info in messages)
	messagesCache.update((cache) => {
		const newCache = { ...cache };
		for (const channelId in newCache) {
			newCache[channelId] = newCache[channelId].map((msg) => {
				if (msg.authorId === userId && msg.author) {
					return {
						...msg,
						author: { ...msg.author, ...updates }
					};
				}
				return msg;
			});
		}
		return newCache;
	});
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
	messagesCache.update((cache) => {
		const channelMsgs = cache[channelId];
		if (!channelMsgs) return cache;

		return {
			...cache,
			[channelId]: channelMsgs.map((m) => {
				if (m.id !== messageId) return m;

				const reactions = [...(m.reactions || [])];
				const existingIndex = reactions.findIndex((r) => r.emoji === emoji);

				if (existingIndex !== -1) {
					const r = reactions[existingIndex];
					// Only increment if we haven't already reacted
					if (!r.reacted) {
						reactions[existingIndex] = {
							...r,
							count: r.count + 1,
							reacted: true
						};
					}
				} else {
					reactions.push({
						emoji,
						count: 1,
						reacted: true
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
	messagesCache.update((cache) => {
		const channelMsgs = cache[channelId];
		if (!channelMsgs) return cache;

		return {
			...cache,
			[channelId]: channelMsgs.map((m) => {
				if (m.id !== messageId) return m;

				const reactions = (m.reactions || [])
					.map((r) => {
						if (r.emoji !== emoji) return r;
						// Only decrement if we had already reacted
						if (r.reacted) {
							return {
								...r,
								count: Math.max(0, r.count - 1),
								reacted: false
							};
						}
						return r;
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
