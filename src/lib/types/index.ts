// User types
export interface User {
	id: string;
	username: string;
	displayName: string | null;
	avatarUrl: string | null;
	bio: string | null;
	status: UserStatus;
	customStatus: string | null;
	createdAt: string;
}

export interface FullUser extends User {
	email: string;
	emailVerified: boolean;
	twoFactorEnabled: boolean;
	createdAt: string;
	updatedAt: string;
}

export type UserStatus = 'online' | 'away' | 'busy' | 'invisible' | 'offline';

export type InstanceSelectorMode = 'disabled' | 'auto' | 'show';

export interface UserSettings {
	settings: Record<string, unknown> & { instanceSelectorMode?: InstanceSelectorMode };
}

// Authentication types
export interface AuthResponse {
	user: FullUser;
	accessToken: string;
	refreshToken: string;
	expiresAt: string;
	requires2FA?: boolean;
}

export interface LoginRequest {
	login: string;
	password: string;
	totpCode?: string;
}

export interface RegisterRequest {
	username: string;
	email: string;
	password: string;
}

// Community types
export interface Community {
	id: string;
	name: string;
	description: string | null;
	iconUrl: string | null;
	bannerUrl: string | null;
	ownerId: string;
	isPublic: boolean;
	isOpen: boolean;
	memberCount: number;
	createdAt: string;
	updatedAt: string;
}

export interface CommunityMember {
	userId: string;
	communityId: string;
	nickname: string | null;
	joinedAt: string;
	roles: Role[];
	user?: User;
}

export interface CommunityInvite {
	id: string;
	code: string;
	communityId: string;
	createdBy: string;
	maxUses: number | null;
	useCount: number;
	expiresAt: string | null;
	createdAt: string;
}

// Channel types
export interface Channel {
	id: string;
	communityId: string;
	categoryId: string | null;
	name: string;
	topic: string | null;
	type: ChannelType;
	position: number;
	isNsfw: boolean;
	slowmodeSeconds: number;
	createdAt: string;
	updatedAt: string;
}

export type ChannelType = 'text' | 'voice' | 'announcement' | 'gallery' | 'forum' | 'private';

export interface ChannelCategory {
	id: string;
	communityId: string;
	name: string;
	position: number;
	createdAt: string;
}

// Message types
export interface Message {
	id: string;
	channelId: string;
	authorId: string;
	content: string | null;
	replyToId: string | null;
	isEdited: boolean;
	isPinned: boolean;
	reactions: Reaction[];
	author: User;
	attachments: Attachment[];
	linkPreviews?: LinkPreview[];
	replyTo?: Message;
	createdAt: string;
	updatedAt: string;
}

export interface Reaction {
	emoji: string;
	count: number;
	reacted: boolean;
}

export interface Attachment {
	id: string;
	filename: string;
	contentType: string | null;
	size: number;
	url: string;
	thumbnailUrl?: string;
	width?: number;
	height?: number;
}

export interface LinkPreview {
	url: string;
	title?: string;
	description?: string;
	siteName?: string;
	imageUrl?: string;
	faviconUrl?: string;
}

export interface SendMessageRequest {
	content: string;
	replyToId?: string;
	attachments?: string[];
}

// Role and Permission types
export interface Role {
	id: string;
	communityId: string;
	name: string;
	color: string | null;
	position: number;
	permissions: number;
	isDefault: boolean;
	createdAt: string;
}

export interface PermissionOverwrite {
	targetType: 'role' | 'user';
	targetId: string;
	allow: number;
	deny: number;
}

// Instance management
export interface Instance {
	id: string;
	url: string;
	name: string;
	iconUrl?: string;
	isOnline: boolean;
	lastChecked: string;
}

export interface InstanceAuth {
	instanceId: string;
	accessToken: string;
	refreshToken: string;
	expiresAt: string;
	user: FullUser;
}

// API response types
export interface ApiResponse<T> {
	data: T;
}

export interface PaginatedResponse<T> {
	data: T[];
	total: number;
	page: number;
	pageSize: number;
	totalPages: number;
}

export interface ApiError {
	error: string;
	code: string;
	details?: Record<string, string[]>;
}

// WebSocket event types
export type WebSocketEventType =
	| 'READY'
	| 'MESSAGE_CREATE'
	| 'MESSAGE_UPDATE'
	| 'MESSAGE_DELETE'
	| 'DM_MESSAGE_CREATE'
	| 'DM_MESSAGE_UPDATE'
	| 'DM_MESSAGE_DELETE'
	| 'DM_REACTION_ADD'
	| 'DM_REACTION_REMOVE'
	| 'TYPING_START'
	| 'PRESENCE_UPDATE'
	| 'CHANNEL_CREATE'
	| 'CHANNEL_UPDATE'
	| 'CHANNEL_DELETE'
	| 'COMMUNITY_UPDATE'
	| 'USER_UPDATE'
	| 'MEMBER_JOIN'
	| 'MEMBER_LEAVE'
	| 'REACTION_ADD'
	| 'REACTION_REMOVE';

export interface WebSocketEvent<T = unknown> {
	type: WebSocketEventType;
	data: T;
}

export interface ReadyEvent {
	user: FullUser;
	sessionId: string;
}

export interface TypingEvent {
	channelId: string;
	userId: string;
	user: User;
}

export interface PresenceEvent {
	userId: string;
	status: UserStatus;
	customStatus?: string;
}

// UI State types
export interface ModalState {
	isOpen: boolean;
	type: string | null;
	data?: unknown;
}

export interface ToastMessage {
	id: string;
	type: 'success' | 'error' | 'warning' | 'info';
	message: string;
	duration?: number;
}

// Direct Message types

export interface DMConversation {
	id: string;
	participants: User[];
	lastMessage?: Message;
	unreadCount: number;
	createdAt: string;
	updatedAt: string;
}
