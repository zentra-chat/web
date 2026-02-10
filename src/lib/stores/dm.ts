import { writable, derived, get } from 'svelte/store';
import type { DMConversation, Message } from '$lib/types';
import { activeInstance, currentUserId } from './instance';

export const activeDmConversationId = writable<string | null>(null);
export const dmConversationsCache = writable<Record<string, DMConversation[]>>({});
export const dmMessagesCache = writable<Record<string, Message[]>>({});

export const activeDmConversation = derived(
	[dmConversationsCache, activeDmConversationId],
	([$cache, $activeId]) => {
		if (!$activeId) return null;
		for (const conversations of Object.values($cache)) {
			const found = conversations.find((c) => c.id === $activeId);
			if (found) return found;
		}
		return null;
	}
);

export const activeDmMessages = derived(
	[dmMessagesCache, activeDmConversationId],
	([$cache, $activeId]) => {
		if (!$activeId) return [];
		return $cache[$activeId] || [];
	}
);

export function setDmConversations(conversations: DMConversation[]): void {
	const instance = get(activeInstance);
	if (!instance) return;

	dmConversationsCache.update((cache) => ({
		...cache,
		[instance.id]: conversations
	}));
}

export function upsertDmConversation(conversation: DMConversation): void {
	const instance = get(activeInstance);
	if (!instance) return;

	dmConversationsCache.update((cache) => {
		const existing = cache[instance.id] || [];
		const next = existing.some((c) => c.id === conversation.id)
			? existing.map((c) => (c.id === conversation.id ? { ...c, ...conversation } : c))
			: [...existing, conversation];
		return {
			...cache,
			[instance.id]: next.sort(
				(a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
			)
		};
	});
}

export function setActiveDmConversationId(conversationId: string | null): void {
	activeDmConversationId.set(conversationId);
	if (conversationId) {
		clearDmUnread(conversationId);
	}
}

export function setDmMessages(conversationId: string, messages: Message[]): void {
	dmMessagesCache.update((cache) => ({
		...cache,
		[conversationId]: messages
	}));
}

export function addDmMessage(conversationId: string, message: Message): void {
	dmMessagesCache.update((cache) => {
		const convoMessages = cache[conversationId] || [];
		if (convoMessages.some((m) => m.id === message.id)) return cache;
		return {
			...cache,
			[conversationId]: [...convoMessages, message]
		};
	});
}

export function updateDmMessage(conversationId: string, messageId: string, updates: Partial<Message>): void {
	dmMessagesCache.update((cache) => ({
		...cache,
		[conversationId]: (cache[conversationId] || []).map((m) =>
			m.id === messageId ? { ...m, ...updates } : m
		)
	}));
}

export function removeDmMessage(conversationId: string, messageId: string): void {
	dmMessagesCache.update((cache) => ({
		...cache,
		[conversationId]: (cache[conversationId] || []).filter((m) => m.id !== messageId)
	}));
}

export function addDmMessageReaction(
	conversationId: string,
	messageId: string,
	userId: string,
	emoji: string
): void {
	dmMessagesCache.update((cache) => {
		const convoMessages = cache[conversationId];
		if (!convoMessages) return cache;

		return {
			...cache,
			[conversationId]: convoMessages.map((m) => {
				if (m.id !== messageId) return m;

				const reactions = [...(m.reactions || [])];
				const existingIndex = reactions.findIndex((r) => r.emoji === emoji);

				if (existingIndex !== -1) {
					const r = reactions[existingIndex];
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

export function removeDmMessageReaction(
	conversationId: string,
	messageId: string,
	userId: string,
	emoji: string
): void {
	dmMessagesCache.update((cache) => {
		const convoMessages = cache[conversationId];
		if (!convoMessages) return cache;

		return {
			...cache,
			[conversationId]: convoMessages.map((m) => {
				if (m.id !== messageId) return m;

				const reactions = (m.reactions || [])
					.map((r) => {
						if (r.emoji !== emoji) return r;
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

export function updateDmConversationFromMessage(conversationId: string, message: Message): void {
	const instance = get(activeInstance);
	if (!instance) return;
	const currentUser = get(currentUserId);
	const isActive = get(activeDmConversationId) === conversationId;

	dmConversationsCache.update((cache) => {
		const list = cache[instance.id] || [];
		const exists = list.some((c) => c.id === conversationId);
		if (!exists) {
			return cache;
		}
		const updated = list.map((c) => {
			if (c.id !== conversationId) return c;
			const unreadCount = !isActive && message.authorId !== currentUser
				? (c.unreadCount || 0) + 1
				: c.unreadCount || 0;
			return {
				...c,
				lastMessage: message,
				updatedAt: message.createdAt,
				unreadCount
			};
		});
		return {
			...cache,
			[instance.id]: updated.sort(
				(a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
			)
		};
	});
}

export function clearDmUnread(conversationId: string): void {
	const instance = get(activeInstance);
	if (!instance) return;

	dmConversationsCache.update((cache) => {
		const list = cache[instance.id] || [];
		return {
			...cache,
			[instance.id]: list.map((c) =>
				c.id === conversationId ? { ...c, unreadCount: 0 } : c
			)
		};
	});
}
