// Plugin bridge protocol - defines the postMessage format used between the
// host app (main thread) and sandboxed plugin iframes. Every message has a
// type, a unique ID, and a direction so the host and guest can match up
// request/response pairs.

// Plugins send these to the host
export type PluginRequest =
	| { type: 'plugin:ready' }
	| { type: 'sdk:call'; id: string; method: string; args: unknown[] }
	| {
			type: 'plugin:register-channel-type';
			id: string;
			def: {
				typeId: string;
				icon: string;
				label: string;
				description: string;
				showHash: boolean;
				headerActionIds?: string[];
			};
	  }
	| { type: 'plugin:unregister-channel-type'; id: string; typeId: string }
	| {
			type: 'plugin:register-header-action';
			id: string;
			def: { actionId: string; title: string; icon: string };
	  }
	| { type: 'plugin:unregister-header-action'; id: string; actionId: string };

// Host sends these back to the plugin
export type HostResponse =
	| { type: 'sdk:response'; id: string; result: unknown; error?: undefined }
	| { type: 'sdk:response'; id: string; result?: undefined; error: string }
	| { type: 'host:channel-changed'; channelId: string | null; channelType: string | null }
	| { type: 'host:messages-updated'; messages: unknown[] }
	| { type: 'host:community-changed'; communityId: string | null }
	| { type: 'host:header-action-clicked'; actionId: string; context: unknown }
	| { type: 'host:init'; grantedPermissions: number; pluginId: string };

// Every message going across postMessage is wrapped in this envelope
// so we can ignore random messages from other sources
export interface PluginMessageEnvelope {
	__zentra_plugin: true;
	pluginId: string;
	payload: PluginRequest | HostResponse;
}

// Scoped API methods allowed per permission bit. This is the authoritative
// list of what method names map to which permission. The host uses this to
// validate every sdk:call before executing it.
export const PERMISSION_METHOD_MAP: Record<string, number> = {
	// ReadMessages = 1 << 0
	getMessages: 1 << 0,
	getPinnedMessages: 1 << 0,

	// SendMessages = 1 << 1
	sendMessage: 1 << 1,
	sendTypingIndicator: 1 << 1,

	// ManageMessages = 1 << 2
	editMessage: 1 << 2,
	deleteMessage: 1 << 2,
	pinMessage: 1 << 2,
	unpinMessage: 1 << 2,

	// ReadMembers = 1 << 3
	getCommunityMembers: 1 << 3,
	getUser: 1 << 3,

	// ManageMembers = 1 << 4
	kickMember: 1 << 4,
	banMember: 1 << 4,
	unbanMember: 1 << 4,

	// ReadChannels = 1 << 5
	getChannels: 1 << 5,
	getChannel: 1 << 5,

	// ManageChannels = 1 << 6
	createChannel: 1 << 6,
	updateChannel: 1 << 6,
	deleteChannel: 1 << 6,

	// ServerInfo = 1 << 9
	getCommunity: 1 << 9,

	// ReactToMessages = 1 << 11
	addReaction: 1 << 11,
	removeReaction: 1 << 11
};

// Methods that are NEVER allowed through the bridge regardless of permissions.
// Auth, account management, and admin operations have no place in a plugin.
export const BLOCKED_METHODS = new Set([
	'login',
	'logout',
	'register',
	'portableAuth',
	'deleteAccount',
	'changePassword',
	'enable2FA',
	'verify2FA',
	'disable2FA',
	'refreshSessionIfNeeded',
	'getCurrentUser',
	'updateProfile',
	'updateAvatar',
	'removeAvatar',
	'updateStatus',
	'getUserSettings',
	'updateUserSettings'
]);

// UI methods that are always safe (no permission required)
export const SAFE_UI_METHODS = new Set(['addToast']);
