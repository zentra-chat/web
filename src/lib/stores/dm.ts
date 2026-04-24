import { writable, derived, get } from 'svelte/store';
import type { DMConversation, Message, User } from '$lib/types';
import { activeInstance, currentUserId } from './instance';
import { clearReplyingTo } from './ui';

export const activeDmConversationId = writable<string | null>(null);
export const dmConversationsCache = writable<Record<string, DMConversation[]>>({});
export const dmMessagesCache = writable<Record<string, Message[]>>({});

// Total unread DM count across all conversations (current instance)
export const totalDmUnread = derived(
	[dmConversationsCache, activeInstance],
	([$cache, $instance]) => {
		if (!$instance) return 0;
		return ($cache[$instance.id] ?? []).reduce((sum, c) => sum + (c.unreadCount || 0), 0);
	}
);

// Conversations with unread messages, sorted by most recent
export const unreadDmConversations = derived(
	[dmConversationsCache, activeInstance],
	([$cache, $instance]) => {
		if (!$instance) return [] as DMConversation[];
		return ($cache[$instance.id] ?? []).filter((c) => (c.unreadCount || 0) > 0);
	}
);

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
	clearReplyingTo();
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

export function updateDmUser(userId: string, updates: Partial<User>): void {
	dmConversationsCache.update((cache) => {
		const nextCache: Record<string, DMConversation[]> = {};

		for (const [instanceId, conversations] of Object.entries(cache)) {
			nextCache[instanceId] = conversations.map((conversation) => {
				const updatedParticipants = conversation.participants.map((participant) =>
					participant.id === userId ? { ...participant, ...updates } : participant
				);

				const updatedLastMessage = conversation.lastMessage
					? {
						...conversation.lastMessage,
						author:
							conversation.lastMessage.authorId === userId && conversation.lastMessage.author
								? { ...conversation.lastMessage.author, ...updates }
								: conversation.lastMessage.author,
						replyTo:
							conversation.lastMessage.replyTo?.authorId === userId && conversation.lastMessage.replyTo?.author
								? {
									...conversation.lastMessage.replyTo,
									author: { ...conversation.lastMessage.replyTo.author, ...updates }
								}
								: conversation.lastMessage.replyTo
					}
					: conversation.lastMessage;

				return {
					...conversation,
					participants: updatedParticipants,
					lastMessage: updatedLastMessage
				};
			});
		}

		return nextCache;
	});

	dmMessagesCache.update((cache) => {
		const nextCache: Record<string, Message[]> = {};

		for (const [conversationId, messages] of Object.entries(cache)) {
			nextCache[conversationId] = messages.map((message) => ({
				...message,
				author:
					message.authorId === userId && message.author
						? { ...message.author, ...updates }
						: message.author,
				replyTo:
					message.replyTo?.authorId === userId && message.replyTo?.author
						? {
							...message.replyTo,
							author: { ...message.replyTo.author, ...updates }
						}
						: message.replyTo
			}));
		}

		return nextCache;
	});
}
