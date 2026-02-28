// Plugin SDK - the interface all plugins use to interact with Zentra.
// Built-in plugins (like the default plugin) import this directly.
// Third-party plugins receive it as an argument to their register() function
// and can also access it via window.ZentraSDK.

import {
	register,
	unregister,
	registerHeaderAction,
	unregisterHeaderAction
} from '$lib/channelTypes';
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

// The SDK object passed to plugins. Every plugin gets the same interface
// regardless of whether it's built-in or loaded at runtime.
export const ZentraSDK = {
	// -- Channel Types -------------------------------------------------------

	// Register a new channel type. The plugin provides its own view component
	// and icon - nothing is hardcoded on the Zentra side.
	registerChannelType(def: {
		id: string;
		icon: IconComponent | string;
		viewComponent: () => Promise<{ default: Component }>;
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

		register(def.id, {
			icon,
			viewComponent: def.viewComponent as ChannelTypeRegistration['viewComponent'],
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
		Avatar: () => import('$lib/components/ui/Avatar.svelte'),
		Spinner: () => import('$lib/components/ui/Spinner.svelte'),
		Button: () => import('$lib/components/ui/Button.svelte'),
		Input: () => import('$lib/components/ui/Input.svelte'),
		Textarea: () => import('$lib/components/ui/Textarea.svelte'),
		VoiceChannelView: () => import('$lib/components/chat/VoiceChannelView.svelte')
	}
};

export type ZentraPluginSDK = typeof ZentraSDK;
