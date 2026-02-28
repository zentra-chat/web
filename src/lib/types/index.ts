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
	settings: Record<string, unknown> & { instanceSelectorMode?: InstanceSelectorMode; developerMode?: boolean };
}

// Authentication types
export interface AuthResponse {
	user: FullUser;
	accessToken: string;
	refreshToken: string;
	expiresAt: string;
	requires2FA?: boolean;
	profileSync?: PortableProfileSync;
}

export interface PortableProfile {
	identityId: string;
	username: string;
	displayName: string | null;
	avatarUrl: string | null;
	bio: string | null;
	customStatus: string | null;
	profileVersion: string;
}

export interface PortableProfileSync {
	profile?: PortableProfile;
	shouldStore: boolean;
	profileSource?: 'client' | 'instance';
	identityMatched: boolean;
}

export interface LoginRequest {
	login: string;
	password: string;
	totpCode?: string;
	portableProfile?: PortableProfile;
}

export interface RegisterRequest {
	username: string;
	email: string;
	password: string;
	portableProfile?: PortableProfile;
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

export interface CommunityBan {
	id: string;
	communityId: string;
	userId: string;
	bannedBy: string;
	reason: string | null;
	createdAt: string;
	user?: User;
	bannedByUser?: User;
}

export interface AuditLogEntry {
	id: string;
	communityId: string | null;
	actorId: string;
	action: string;
	targetType: string | null;
	targetId: string | null;
	details: Record<string, unknown> | null;
	createdAt: string;
	actor?: User;
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
	metadata: Record<string, unknown>;
	createdAt: string;
	updatedAt: string;
}

export type ChannelType = string;

// Capability flags - mirrors the backend bitmask
export const ChannelCapability = {
	Messages:  1,
	Threads:   2,
	Media:     4,
	Voice:     8,
	Video:     16,
	Embeds:    32,
	Pins:      64,
	Reactions: 128,
	Slowmode:  256,
	ReadOnly:  512,
	Topics:    1024,
} as const;

// A registered channel type definition from the backend
export interface ChannelTypeDefinition {
	id: string;
	name: string;
	description: string;
	icon: string;
	capabilities: number;
	defaultMetadata: Record<string, unknown>;
	builtIn: boolean;
	pluginId: string | null;
	createdAt: string;
}

export interface ChannelCategory {
	id: string;
	communityId: string;
	name: string;
	position: number;
	createdAt: string;
}

// Voice types
export interface VoiceState {
	id: string;
	channelId: string;
	userId: string;
	isMuted: boolean;
	isDeafened: boolean;
	isSelfMuted: boolean;
	isSelfDeafened: boolean;
	joinedAt: string;
	user?: User;
}

export interface VoiceJoinEvent {
	channelId: string;
	userId: string;
	state: VoiceState;
	user?: User;
	participants?: VoiceState[];
}

export interface VoiceLeaveEvent {
	channelId: string;
	userId: string;
}

export interface VoiceStateUpdateEvent {
	channelId: string;
	userId: string;
	state: VoiceState;
}

export interface VoiceSignalEvent {
	channelId: string;
	fromUserId: string;
	targetUserId: string;
	signalType: 'offer' | 'answer' | 'ice-candidate';
	signal: unknown;
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
	targetType: 'role' | 'member';
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
	| 'REACTION_REMOVE'
	| 'NOTIFICATION'
	| 'NOTIFICATION_READ'
	| 'VOICE_JOIN'
	| 'VOICE_LEAVE'
	| 'VOICE_STATE_UPDATE'
	| 'VOICE_SIGNAL'
	| 'VOICE_ERROR';

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

// Notification types

export type NotificationType =
	| 'mention_user'
	| 'mention_role'
	| 'mention_everyone'
	| 'mention_here'
	| 'reply'
	| 'dm_message';

export interface Notification {
	id: string;
	userId: string;
	type: NotificationType;
	title: string;
	body: string | null;
	communityId: string | null;
	channelId: string | null;
	messageId: string | null;
	actorId: string | null;
	metadata: Record<string, unknown>;
	isRead: boolean;
	createdAt: string;
	actor?: User | null;
}

export type MentionType = 'user' | 'role' | 'everyone' | 'here';

export interface ParsedMention {
	type: MentionType;
	userId?: string;
	roleId?: string;
}

// Custom emoji types

export interface CustomEmoji {
	id: string;
	communityId: string;
	name: string;
	imageUrl: string;
	uploaderId: string;
	animated: boolean;
	createdAt: string;
	updatedAt: string;
}

export interface CustomEmojiWithCommunity extends CustomEmoji {
	communityName: string;
}

// Plugin types

// What a plugin is allowed to do - matches backend bitmask exactly
export const PluginPermission = {
	ReadMessages: 1 << 0,
	SendMessages: 1 << 1,
	ManageMessages: 1 << 2,
	ReadMembers: 1 << 3,
	ManageMembers: 1 << 4,
	ReadChannels: 1 << 5,
	ManageChannels: 1 << 6,
	AddChannelTypes: 1 << 7,
	AddCommands: 1 << 8,
	ServerInfo: 1 << 9,
	Webhooks: 1 << 10,
	ReactToMessages: 1 << 11
} as const;

// Human-readable labels for each permission
export const PluginPermissionLabels: Record<number, { label: string; description: string; risky: boolean }> = {
	[PluginPermission.ReadMessages]: { label: 'Read Messages', description: 'Can read messages in channels', risky: false },
	[PluginPermission.SendMessages]: { label: 'Send Messages', description: 'Can send messages on behalf of the plugin', risky: false },
	[PluginPermission.ManageMessages]: { label: 'Manage Messages', description: 'Can delete or edit messages', risky: true },
	[PluginPermission.ReadMembers]: { label: 'Read Members', description: 'Can see member list and profiles', risky: false },
	[PluginPermission.ManageMembers]: { label: 'Manage Members', description: 'Can kick or ban members', risky: true },
	[PluginPermission.ReadChannels]: { label: 'Read Channels', description: 'Can see channel list and info', risky: false },
	[PluginPermission.ManageChannels]: { label: 'Manage Channels', description: 'Can create, edit, or delete channels', risky: true },
	[PluginPermission.AddChannelTypes]: { label: 'Custom Channel Types', description: 'Can register its own channel types', risky: false },
	[PluginPermission.AddCommands]: { label: 'Commands', description: 'Can register slash commands', risky: false },
	[PluginPermission.ServerInfo]: { label: 'Server Info', description: 'Can read community metadata', risky: false },
	[PluginPermission.Webhooks]: { label: 'Webhooks', description: 'Can create and use webhooks', risky: true },
	[PluginPermission.ReactToMessages]: { label: 'React to Messages', description: 'Can add emoji reactions', risky: false }
};

export interface PluginManifest {
	channelTypes?: string[];
	commands?: string[];
	triggers?: string[];
	hooks?: string[];
	frontendBundle?: string;
}

export interface Plugin {
	id: string;
	slug: string;
	name: string;
	description: string;
	author: string;
	version: string;
	homepageUrl?: string;
	sourceUrl?: string;
	iconUrl?: string;
	requestedPermissions: number;
	manifest: PluginManifest;
	builtIn: boolean;
	source: string;
	isVerified: boolean;
	createdAt: string;
	updatedAt: string;
}

export interface CommunityPlugin {
	id: string;
	communityId: string;
	pluginId: string;
	enabled: boolean;
	grantedPermissions: number;
	config: Record<string, unknown>;
	installedBy: string;
	installedAt: string;
	updatedAt: string;
	plugin?: Plugin;
}

export interface PluginSource {
	id: string;
	communityId: string;
	name: string;
	url: string;
	enabled: boolean;
	addedBy: string;
	createdAt: string;
}

export interface PluginAuditEntry {
	id: string;
	communityId: string;
	pluginId: string;
	actorId: string;
	action: string;
	details: Record<string, unknown>;
	createdAt: string;
}
