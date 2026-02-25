import { get } from 'svelte/store';
import { activeInstance, activeAuth, updateCurrentUser, currentUserId } from '$lib/stores/instance';
import {
	addMessage,
	updateMessage,
	removeMessage,
	addChannel,
	updateChannel,
	removeChannel,
	updateCommunity,
	updateMemberUser,
	addMessageReaction,
	removeMessageReaction
} from '$lib/stores/community';
import {
	addDmMessage,
	updateDmMessage,
	removeDmMessage,
	updateDmConversationFromMessage,
	clearDmUnread,
	activeDmConversationId,
	addDmMessageReaction,
	removeDmMessageReaction
} from '$lib/stores/dm';
import { setTyping, setUserPresence, showToast, showNotificationPreview } from '$lib/stores/ui';
import { prependNotification, markNotificationReadLocal, markAllNotificationsReadLocal } from '$lib/stores/notification';
import { sendNativeNotification } from '$lib/utils/nativeNotification';
import type {
	WebSocketEvent,
	ReadyEvent,
	Message,
	Channel,
	Community,
	TypingEvent,
	PresenceEvent,
	User,
	Notification
} from '$lib/types';
import { mapDmMessage } from '$lib/utils/dm';

type EventHandler = (data: unknown) => void;

class WebSocketManager {
	private ws: WebSocket | null = null;
	private reconnectAttempts = 0;
	private maxReconnectAttempts = 10;
	private reconnectDelay = 1000;
	private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
	private eventHandlers: Map<string, EventHandler[]> = new Map();
	private messageQueue: string[] = [];
	private isConnecting = false;
	private activeSubscriptions: Set<string> = new Set();

	connect(): void {
		const instance = get(activeInstance);
		const auth = get(activeAuth);

		if (!instance || !auth) {
			console.warn('Cannot connect WebSocket: no active instance or auth');
			return;
		}

		if (this.ws?.readyState === WebSocket.OPEN || this.isConnecting) {
			return;
		}

		this.isConnecting = true;

		// Convert http(s) to ws(s)
		const wsUrl = instance.url.replace(/^http/, 'ws');
		const url = `${wsUrl}/ws?token=${auth.accessToken}`;

		try {
			this.ws = new WebSocket(url);
			this.setupEventListeners();
		} catch (error) {
			console.error('Failed to create WebSocket:', error);
			this.isConnecting = false;
			this.scheduleReconnect();
		}
	}

	private setupEventListeners(): void {
		if (!this.ws) return;

		this.ws.onopen = () => {
			console.log('WebSocket connected');
			this.isConnecting = false;
			this.reconnectAttempts = 0;
			this.startHeartbeat();
			this.flushMessageQueue();

			// Resubscribe to active channels
			this.activeSubscriptions.forEach((channelId) => {
				this.send({ type: 'SUBSCRIBE', data: { channelId } });
			});
		};

		this.ws.onmessage = (event) => {
			try {
				const message: WebSocketEvent = JSON.parse(event.data);
				this.handleEvent(message);
			} catch (error) {
				console.error('Failed to parse WebSocket message:', error);
			}
		};

		this.ws.onerror = (error) => {
			console.error('WebSocket error:', error);
		};

		this.ws.onclose = (event) => {
			console.log('WebSocket closed:', event.code, event.reason);
			this.isConnecting = false;
			this.stopHeartbeat();

			// Don't reconnect on intentional close
			if (event.code !== 1000) {
				this.scheduleReconnect();
			}
		};
	}

	private handleEvent(event: WebSocketEvent): void {
		// Call registered handlers
		const handlers = this.eventHandlers.get(event.type) || [];
		handlers.forEach((handler) => handler(event.data));

		// Handle built-in events
		switch (event.type) {
			case 'READY':
				this.handleReady(event.data as ReadyEvent);
				break;
			case 'MESSAGE_CREATE':
				this.handleMessageCreate(event.data as Message);
				break;
			case 'MESSAGE_UPDATE':
				this.handleMessageUpdate(event.data as Message);
				break;
			case 'MESSAGE_DELETE':
				this.handleMessageDelete(event.data as { channelId: string; messageId: string });
				break;
			case 'DM_MESSAGE_CREATE':
				this.handleDmMessageCreate(event.data as any);
				break;
			case 'DM_MESSAGE_UPDATE':
				this.handleDmMessageUpdate(event.data as any);
				break;
			case 'DM_MESSAGE_DELETE':
				this.handleDmMessageDelete(event.data as { conversationId: string; messageId: string });
				break;
			case 'DM_REACTION_ADD':
				this.handleDmReactionAdd(
					event.data as { conversationId: string; messageId: string; userId: string; emoji: string }
				);
				break;
			case 'DM_REACTION_REMOVE':
				this.handleDmReactionRemove(
					event.data as { conversationId: string; messageId: string; userId: string; emoji: string }
				);
				break;
			case 'TYPING_START':
				this.handleTypingStart(event.data as TypingEvent);
				break;
			case 'PRESENCE_UPDATE':
				this.handlePresenceUpdate(event.data as PresenceEvent);
				break;
			case 'CHANNEL_CREATE':
				this.handleChannelCreate(event.data as Channel);
				break;
			case 'CHANNEL_UPDATE':
				this.handleChannelUpdate(event.data as Channel);
				break;
			case 'CHANNEL_DELETE':
				this.handleChannelDelete(event.data as { communityId: string; channelId: string });
				break;
			case 'COMMUNITY_UPDATE':
				this.handleCommunityUpdate(event.data as Community);
				break;
			case 'USER_UPDATE':
				this.handleUserUpdate(event.data as User);
				break;
			case 'REACTION_ADD':
				this.handleReactionAdd(
					event.data as { channelId: string; messageId: string; userId: string; emoji: string }
				);
				break;
			case 'REACTION_REMOVE':
				this.handleReactionRemove(
					event.data as { channelId: string; messageId: string; userId: string; emoji: string }
				);
				break;
			case 'NOTIFICATION':
				this.handleNotification(event.data as Notification);
				break;
			case 'NOTIFICATION_READ':
				this.handleNotificationRead(event.data as { notificationId?: string; all?: boolean });
				break;
		}
	}

	private handleReady(data: ReadyEvent): void {
		console.log('WebSocket ready, session:', data.sessionId);
	}

	private handleMessageCreate(message: Message): void {
		addMessage(message.channelId, message);
	}

	private handleMessageUpdate(message: Message): void {
		updateMessage(message.channelId, message.id, message);
	}

	private handleMessageDelete(data: { channelId: string; messageId: string }): void {
		removeMessage(data.channelId, data.messageId);
	}

	private handleDmMessageCreate(message: any): void {
		const mapped = mapDmMessage(message);
		addDmMessage(mapped.channelId, mapped);
		updateDmConversationFromMessage(mapped.channelId, mapped);
		if (get(activeDmConversationId) === mapped.channelId) {
			clearDmUnread(mapped.channelId);
		}
	}

	private handleDmMessageUpdate(message: any): void {
		const mapped = mapDmMessage(message);
		updateDmMessage(mapped.channelId, mapped.id, mapped);
		updateDmConversationFromMessage(mapped.channelId, mapped);
	}

	private handleDmMessageDelete(data: { conversationId: string; messageId: string }): void {
		removeDmMessage(data.conversationId, data.messageId);
	}

	private handleDmReactionAdd(data: { conversationId: string; messageId: string; userId: string; emoji: string }): void {
		addDmMessageReaction(data.conversationId, data.messageId, data.userId, data.emoji);
	}

	private handleDmReactionRemove(data: { conversationId: string; messageId: string; userId: string; emoji: string }): void {
		removeDmMessageReaction(data.conversationId, data.messageId, data.userId, data.emoji);
	}

	private handleTypingStart(data: TypingEvent): void {
		setTyping(data.channelId, data.userId, data.user.username);
	}

	private handlePresenceUpdate(data: PresenceEvent): void {
		setUserPresence(data.userId, data.status, data.customStatus);
	}

	private handleChannelCreate(channel: Channel): void {
		addChannel(channel.communityId, channel);
	}

	private handleChannelUpdate(channel: Channel): void {
		updateChannel(channel);
	}

	private handleChannelDelete(data: { communityId: string; channelId: string }): void {
		removeChannel(data.communityId, data.channelId);
	}

	private handleCommunityUpdate(community: Community): void {
		updateCommunity(community.id, community);
	}

	private handleUserUpdate(user: User): void {
		// Update current user if it's us
		if (user.id === get(currentUserId)) {
			updateCurrentUser(user);
		}
		// Update user in all member lists and messages
		updateMemberUser(user.id, user);
	}

	private handleReactionAdd(data: {
		channelId: string;
		messageId: string;
		userId: string;
		emoji: string;
	}): void {
		addMessageReaction(data.channelId, data.messageId, data.userId, data.emoji);
	}

	private handleReactionRemove(data: {
		channelId: string;
		messageId: string;
		userId: string;
		emoji: string;
	}): void {
		removeMessageReaction(data.channelId, data.messageId, data.userId, data.emoji);
	}

	private handleNotification(notification: Notification): void {
		prependNotification(notification);
		showNotificationPreview({
			actorAvatarUrl: notification.actor?.avatarUrl ?? null,
			actorName: notification.actor?.displayName ?? notification.actor?.username ?? 'Zentra',
			title: notification.title,
			body: notification.body ?? null,
			duration: 5000
		});
		sendNativeNotification(notification.title, { body: notification.body ?? undefined });
	}

	private handleNotificationRead(data: { notificationId?: string; all?: boolean }): void {
		if (data.all) {
			markAllNotificationsReadLocal();
		} else if (data.notificationId) {
			markNotificationReadLocal(data.notificationId);
		}
	}

	private startHeartbeat(): void {
		this.heartbeatInterval = setInterval(() => {
			this.send({ type: 'HEARTBEAT', data: {} });
		}, 30000);
	}

	private stopHeartbeat(): void {
		if (this.heartbeatInterval) {
			clearInterval(this.heartbeatInterval);
			this.heartbeatInterval = null;
		}
	}

	private scheduleReconnect(): void {
		if (this.reconnectAttempts >= this.maxReconnectAttempts) {
			console.error('Max reconnect attempts reached');
			showToast('error', 'Connection lost. Please refresh the page.');
			return;
		}

		const delay = Math.min(
			this.reconnectDelay * Math.pow(2, this.reconnectAttempts),
			30000
		);

		console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts + 1})`);

		setTimeout(() => {
			this.reconnectAttempts++;
			this.connect();
		}, delay);
	}

	private flushMessageQueue(): void {
		while (this.messageQueue.length > 0) {
			const message = this.messageQueue.shift();
			if (message && this.ws?.readyState === WebSocket.OPEN) {
				this.ws.send(message);
			}
		}
	}

	send(message: { type: string; data: unknown }): void {
		const data = JSON.stringify(message);

		if (this.ws?.readyState === WebSocket.OPEN) {
			this.ws.send(data);
		} else {
			this.messageQueue.push(data);
		}
	}

	subscribe(channelId: string): void {
		this.activeSubscriptions.add(channelId);
		this.send({ type: 'SUBSCRIBE', data: { channelId } });
	}

	unsubscribe(channelId: string): void {
		this.activeSubscriptions.delete(channelId);
		this.send({ type: 'UNSUBSCRIBE', data: { channelId } });
	}

	sendTyping(channelId: string): void {
		this.send({ type: 'TYPING_START', data: { channelId } });
	}

	updatePresence(status: string): void {
		this.send({ type: 'PRESENCE_UPDATE', data: { status } });
	}

	on(event: string, handler: EventHandler): () => void {
		const handlers = this.eventHandlers.get(event) || [];
		handlers.push(handler);
		this.eventHandlers.set(event, handlers);

		// Return unsubscribe function
		return () => {
			const current = this.eventHandlers.get(event) || [];
			this.eventHandlers.set(
				event,
				current.filter((h) => h !== handler)
			);
		};
	}

	disconnect(): void {
		this.stopHeartbeat();
		if (this.ws) {
			this.ws.close(1000, 'User disconnected');
			this.ws = null;
		}
		this.messageQueue = [];
	}

	isConnected(): boolean {
		return this.ws?.readyState === WebSocket.OPEN;
	}
}

export const websocket = new WebSocketManager();
