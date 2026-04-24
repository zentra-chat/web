// Plugin SDK - the interface all plugins use to interact with Zentra.
// Built-in plugins (like the default plugin) import this directly.
// Third-party plugins receive a capability-scoped SDK as an argument to their
// register() function - they do NOT get it via window.

import {
	register,
	unregister,
	registerHeaderAction,
	unregisterHeaderAction
} from '$lib/channelTypes';
import { PluginPermission } from '$lib/types';
import type { ChannelHeaderActionContext, ChannelTypeRegistration } from '$lib/channelTypes';
import { api } from '$lib/api';
import {
	activeChannel,
	activeCommunity,
	activeCommunityMembers,
	activeChannelMessages,
	memberHasPermission,
	Permission,
	addMessage
} from '$lib/stores/community';
import { currentUserId } from '$lib/stores/instance';
import { addToast } from '$lib/stores/ui';
import type { Component } from 'svelte';

// Lucide icons - curated set of commonly needed icons for plugins.
// Plugins compiled into the main bundle can also import lucide-svelte directly.
import {
	Hash,
	Megaphone,
	Image,
	MessagesSquare,
	Volume2,
	Pin,
	Users,
	Bell,
	Settings,
	Shield,
	Star,
	Heart,
	Bookmark,
	Calendar,
	Clock,
	Code,
	FileText,
	Folder,
	Globe,
	HelpCircle,
	Home,
	Info,
	Link,
	Lock,
	Mail,
	Map,
	Mic,
	Music,
	Phone,
	Play,
	Search,
	Send,
	Tag,
	Terminal,
	Trash,
	Upload,
	Video,
	Zap,
	Eye,
	EyeOff,
	Plus,
	Minus,
	X,
	Check,
	ChevronLeft,
	ChevronRight,
	ChevronUp,
	ChevronDown,
	ArrowUp,
	ArrowDown,
	ArrowLeft,
	ArrowRight,
	ExternalLink,
	AlertTriangle,
	AlertCircle,
	RefreshCw,
	Download,
	Edit,
	Copy,
	Clipboard,
	LayoutGrid,
	LayoutList,
	MessageCircle,
	MessageSquare,
	Smile,
	ThumbsUp,
	Reply,
	AtSign,
	Paperclip,
	Camera,
	Headphones,
	Wifi,
	WifiOff,
	Activity
} from 'lucide-svelte';

type IconComponent = typeof Hash;

// Map of icon names to their components. Plugins can reference icons by
// kebab-case name (e.g. 'hash', 'messages-square') or pass components directly.
const icons: Record<string, IconComponent> = {
	hash: Hash,
	megaphone: Megaphone,
	image: Image,
	'messages-square': MessagesSquare,
	'volume-2': Volume2,
	pin: Pin,
	users: Users,
	bell: Bell,
	settings: Settings,
	shield: Shield,
	star: Star,
	heart: Heart,
	bookmark: Bookmark,
	calendar: Calendar,
	clock: Clock,
	code: Code,
	'file-text': FileText,
	folder: Folder,
	globe: Globe,
	'help-circle': HelpCircle,
	home: Home,
	info: Info,
	link: Link,
	lock: Lock,
	mail: Mail,
	map: Map,
	mic: Mic,
	music: Music,
	phone: Phone,
	play: Play,
	search: Search,
	send: Send,
	tag: Tag,
	terminal: Terminal,
	trash: Trash,
	upload: Upload,
	video: Video,
	zap: Zap,
	eye: Eye,
	'eye-off': EyeOff,
	plus: Plus,
	minus: Minus,
	x: X,
	check: Check,
	'chevron-left': ChevronLeft,
	'chevron-right': ChevronRight,
	'chevron-up': ChevronUp,
	'chevron-down': ChevronDown,
	'arrow-up': ArrowUp,
	'arrow-down': ArrowDown,
	'arrow-left': ArrowLeft,
	'arrow-right': ArrowRight,
	'external-link': ExternalLink,
	'alert-triangle': AlertTriangle,
	'alert-circle': AlertCircle,
	'refresh-cw': RefreshCw,
	download: Download,
	edit: Edit,
	copy: Copy,
	clipboard: Clipboard,
	'layout-grid': LayoutGrid,
	'layout-list': LayoutList,
	'message-circle': MessageCircle,
	'message-square': MessageSquare,
	smile: Smile,
	'thumbs-up': ThumbsUp,
	reply: Reply,
	'at-sign': AtSign,
	paperclip: Paperclip,
	camera: Camera,
	headphones: Headphones,
	wifi: Wifi,
	'wifi-off': WifiOff,
	activity: Activity
};

// Resolve an icon from either a string name or a component reference
function resolveIcon(icon: IconComponent | string): IconComponent | undefined {
	if (typeof icon === 'string') {
		return icons[icon];
	}
	return icon;
}

function isValidPluginElementTag(tagName: string): boolean {
	return /^zentra-plugin-[a-z0-9-]+$/.test(tagName) || /^zentra-[a-z0-9-]+$/.test(tagName);
}


// The SDK object passed to plugins. Every plugin gets the same interface
// regardless of whether it's built-in or loaded at runtime.
export const ZentraSDK = {
	// -- Channel Types -------------------------------------------------------

	// Register a new channel type. The plugin provides its own view component
	// and icon - nothing is hardcoded on the Zentra side.
	registerChannelType(def: {
		id: string;
		icon: IconComponent | string;
		viewComponent?: () => Promise<{ default: Component }>;
		viewElement?: {
			tagName: string;
			module: () => Promise<unknown>;
		};
		label: string;
		description: string;
		showHash: boolean;
		headerActionIds?: string[];
	}) {
		const icon = resolveIcon(def.icon);
		if (!icon) {
			console.warn(`[Zentra SDK] Unknown icon "${def.icon}" for channel type "${def.id}"`);
			return;
		}

		if (!def.viewComponent && !def.viewElement) {
			console.warn(`[Zentra SDK] Channel type "${def.id}" must provide viewComponent or viewElement`);
			return;
		}

		if (def.viewElement && !isValidPluginElementTag(def.viewElement.tagName)) {
			console.warn(
				`[Zentra SDK] Invalid viewElement tag "${def.viewElement.tagName}" for "${def.id}". Expected format: zentra-plugin-... (or legacy zentra-...)`
			);
			return;
		}

		register(def.id, {
			icon,
			viewComponent: def.viewComponent as ChannelTypeRegistration['viewComponent'],
			viewElement: def.viewElement,
			label: def.label,
			description: def.description,
			showHash: def.showHash,
			headerActionIds: def.headerActionIds
		});
	},

	unregisterChannelType: unregister,

	// -- Header Actions ------------------------------------------------------

	// Register a toolbar action that appears in channel headers.
	// Plugins provide the handler directly - no indirection through string keys.
	registerHeaderAction(def: {
		id: string;
		title: string;
		icon: IconComponent | string;
		onClick: (context: ChannelHeaderActionContext) => void | Promise<void>;
	}) {
		const icon = resolveIcon(def.icon);
		if (!icon) {
			console.warn(`[Zentra SDK] Unknown icon "${def.icon}" for header action "${def.id}"`);
			return;
		}

		registerHeaderAction({
			id: def.id,
			title: def.title,
			icon,
			onClick: def.onClick
		});
	},

	unregisterHeaderAction,

	// -- Icons ---------------------------------------------------------------

	// Get an icon component by its kebab-case name (e.g. 'hash', 'volume-2')
	getIcon(name: string): IconComponent | undefined {
		return icons[name];
	},

	// Full icon map for plugins that want to iterate or do dynamic lookups
	icons,

	// -- API Client ----------------------------------------------------------

	// Full access to the Zentra API client. Plugins can make any API call
	// the frontend can make.
	api,

	// -- Reactive Stores -----------------------------------------------------

	// Access to the app's reactive state. These are Svelte stores -
	// use $store syntax in Svelte files or store.subscribe() in plain JS.
	stores: {
		activeChannel,
		activeCommunity,
		activeCommunityMembers,
		activeChannelMessages,
		currentUserId
	},

	// -- Permissions ---------------------------------------------------------

	permissions: {
		memberHasPermission,
		Permission
	},

	// -- UI Utilities --------------------------------------------------------

	ui: {
		addToast,
		addMessage
	},

	// -- Components ----------------------------------------------------------

	// Lazy-loadable shared components. Plugins can use these to build
	// consistent UIs without reimplementing common patterns.
	components: {
		MessageList: () => import('$lib/components/chat/MessageList.svelte'),
		MessageInput: () => import('$lib/components/chat/MessageInput.svelte'),
		MessageItem: () => import('$lib/components/chat/MessageItem.svelte'),
		Avatar: () => import('$lib/components/ui/Avatar.svelte'),
		Spinner: () => import('$lib/components/ui/Spinner.svelte'),
		Button: () => import('$lib/components/ui/Button.svelte'),
		Input: () => import('$lib/components/ui/Input.svelte'),
		Textarea: () => import('$lib/components/ui/Textarea.svelte'),
		VoiceChannelView: () => import('$lib/components/chat/VoiceChannelView.svelte')
	}
};

export type ZentraPluginSDK = typeof ZentraSDK;

// Creates a capability-limited SDK for a third-party plugin.
// Only the methods matching grantedPermissions (the bitmask stored on CommunityPlugin)
// are handed to the plugin. Dangerous account/auth methods are never included.
// Methods outside the granted permissions throw with a clear message so plugin
// developers know exactly what they need to declare.
export function createScopedSDK(grantedPermissions: number): ZentraPluginSDK {
	const has = (perm: number) => (grantedPermissions & perm) !== 0;

	function deny(capability: string, requiredPerm: string): never {
		throw new Error(
			`[Zentra Plugin] "${capability}" is not available. ` +
				`The plugin was not granted the "${requiredPerm}" permission. ` +
				`Check the plugin manifest's requestedPermissions value.`
		);
	}

	// Build a permission-scoped API object. Only specific, safe methods are
	// included per permission - nothing from the auth/account surface.
	const scopedApi = {
		...(has(PluginPermission.ReadMessages) && {
			getMessages: api.getMessages.bind(api),
			getPinnedMessages: api.getPinnedMessages.bind(api)
		}),
		...(has(PluginPermission.SendMessages) && {
			sendMessage: api.sendMessage.bind(api),
			sendTypingIndicator: api.sendTypingIndicator.bind(api)
		}),
		...(has(PluginPermission.ManageMessages) && {
			editMessage: api.editMessage.bind(api),
			deleteMessage: api.deleteMessage.bind(api),
			pinMessage: api.pinMessage.bind(api),
			unpinMessage: api.unpinMessage.bind(api)
		}),
		...(has(PluginPermission.ReadMembers) && {
			getCommunityMembers: api.getCommunityMembers.bind(api),
			getUser: api.getUser.bind(api)
		}),
		...(has(PluginPermission.ManageMembers) && {
			kickMember: api.kickMember.bind(api),
			banMember: api.banMember.bind(api),
			unbanMember: api.unbanMember.bind(api)
		}),
		...(has(PluginPermission.ReadChannels) && {
			getChannels: api.getChannels.bind(api),
			getChannel: api.getChannel.bind(api)
		}),
		...(has(PluginPermission.ManageChannels) && {
			createChannel: api.createChannel.bind(api),
			updateChannel: api.updateChannel.bind(api),
			deleteChannel: api.deleteChannel.bind(api)
		}),
		...(has(PluginPermission.ServerInfo) && {
			getCommunity: api.getCommunity.bind(api)
		}),
		...(has(PluginPermission.ReactToMessages) && {
			addReaction: api.addReaction.bind(api),
			removeReaction: api.removeReaction.bind(api)
		})
	};

	return {
		// Channel type registration - requires AddChannelTypes permission
		registerChannelType: has(PluginPermission.AddChannelTypes)
			? ZentraSDK.registerChannelType
			: () => deny('registerChannelType', 'AddChannelTypes'),
		unregisterChannelType: has(PluginPermission.AddChannelTypes)
			? ZentraSDK.unregisterChannelType
			: () => deny('unregisterChannelType', 'AddChannelTypes'),

		// Header actions - requires AddCommands permission
		registerHeaderAction: has(PluginPermission.AddCommands)
			? ZentraSDK.registerHeaderAction
			: () => deny('registerHeaderAction', 'AddCommands'),
		unregisterHeaderAction: has(PluginPermission.AddCommands)
			? ZentraSDK.unregisterHeaderAction
			: () => deny('unregisterHeaderAction', 'AddCommands'),

		// Icons are static data - always safe to expose
		getIcon: ZentraSDK.getIcon,
		icons: ZentraSDK.icons,

		// Scoped API - only the methods that match granted permissions.
		// Auth, account management, and admin methods are never included.
		api: scopedApi as typeof api,

		// Svelte stores - gated by read permissions
		stores: {
			activeChannel: has(PluginPermission.ReadChannels)
				? ZentraSDK.stores.activeChannel
				: (undefined as never),
			activeCommunity: has(PluginPermission.ServerInfo)
				? ZentraSDK.stores.activeCommunity
				: (undefined as never),
			activeCommunityMembers: has(PluginPermission.ReadMembers)
				? ZentraSDK.stores.activeCommunityMembers
				: (undefined as never),
			activeChannelMessages: has(PluginPermission.ReadMessages)
				? ZentraSDK.stores.activeChannelMessages
				: (undefined as never),
			// Always expose your own user ID - it's not sensitive
			currentUserId: ZentraSDK.stores.currentUserId
		},

		// Permission helpers - always allowed
		permissions: ZentraSDK.permissions,

		ui: {
			// Toasts are always safe
			addToast: ZentraSDK.ui.addToast,
			// Injecting messages requires SendMessages
			addMessage: has(PluginPermission.SendMessages)
				? ZentraSDK.ui.addMessage
				: () => deny('ui.addMessage', 'SendMessages')
		},

		// Shared components - always allowed
		components: ZentraSDK.components
	} as ZentraPluginSDK;
}
