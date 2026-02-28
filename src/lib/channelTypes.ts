// Channel type registry - maps type IDs to their frontend components and display info.
// Plugins can register new types by calling registerChannelType() and they'll
// show up everywhere: sidebar icons, create modal, and the main content area.

import type { ChannelTypeDefinition } from '$lib/types';
import {
	Hash,
	Megaphone,
	Image,
	MessagesSquare,
	Volume2,
	HelpCircle
} from 'lucide-svelte';

// Use the lucide icon type as the baseline for icon components -
// works with both Svelte 4 class components and Svelte 5 function components
type IconComponent = typeof Hash;

export interface ChannelTypeRegistration {
	// Lucide icon component for the sidebar
	icon: IconComponent;
	// The view component rendered in the main content area (lazy loaded)
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	viewComponent: () => Promise<{ default: any }>;
	// Nice display name (fallback if server definition isn't loaded yet)
	label: string;
	// Short description for the create modal
	description: string;
	// Whether this type gets a "#" prefix in display
	showHash: boolean;
}

// Private map of registered types
const registry = new Map<string, ChannelTypeRegistration>();

// Built-in types registered at module load
function registerDefaults() {
	register('text', {
		icon: Hash,
		viewComponent: () => import('$lib/components/chat/channels/TextChannelView.svelte'),
		label: 'Text',
		description: 'Send messages, images, and files',
		showHash: true
	});

	register('announcement', {
		icon: Megaphone,
		viewComponent: () => import('$lib/components/chat/channels/AnnouncementChannelView.svelte'),
		label: 'Announcement',
		description: 'Important updates - only moderators can post',
		showHash: true
	});

	register('gallery', {
		icon: Image,
		viewComponent: () => import('$lib/components/chat/channels/GalleryChannelView.svelte'),
		label: 'Gallery',
		description: 'Share and browse images and media',
		showHash: false
	});

	register('forum', {
		icon: MessagesSquare,
		viewComponent: () => import('$lib/components/chat/channels/ForumChannelView.svelte'),
		label: 'Forum',
		description: 'Organized discussions with topics and threads',
		showHash: true
	});

	register('voice', {
		icon: Volume2,
		viewComponent: () => import('$lib/components/chat/channels/VoiceChannelViewWrapper.svelte'),
		label: 'Voice',
		description: 'Hang out with real-time voice chat',
		showHash: false
	});
}

// Register a channel type. Plugins call this to add their own types.
export function register(typeId: string, registration: ChannelTypeRegistration): void {
	registry.set(typeId, registration);
}

// Unregister a channel type (for plugin cleanup)
export function unregister(typeId: string): void {
	registry.delete(typeId);
}

// Get a specific type's registration. Returns a fallback for unknown types
// so the UI never breaks even if a plugin type hasn't been loaded yet.
export function getChannelTypeRegistration(typeId: string): ChannelTypeRegistration {
	return registry.get(typeId) ?? fallbackRegistration;
}

// Get all registered types as an array (for the create channel modal)
export function getAllRegisteredTypes(): { id: string; registration: ChannelTypeRegistration }[] {
	return Array.from(registry.entries()).map(([id, registration]) => ({
		id,
		registration
	}));
}

// Check if a type is registered on the frontend
export function isTypeRegistered(typeId: string): boolean {
	return registry.has(typeId);
}

// Get the icon component for a channel type
export function getChannelIcon(typeId: string): IconComponent {
	return (registry.get(typeId) ?? fallbackRegistration).icon;
}

// Merge server-side type definitions with frontend registrations.
// This lets plugin types that only exist on the server show up with
// a generic fallback view until the plugin's frontend code loads.
export function mergeServerDefinitions(definitions: ChannelTypeDefinition[]): void {
	for (const def of definitions) {
		if (registry.has(def.id)) continue;
		// Server knows about a type we don't have a component for yet -
		// register it with the fallback so it at least appears in the UI
		register(def.id, {
			icon: HelpCircle,
			viewComponent: () => import('$lib/components/chat/channels/FallbackChannelView.svelte'),
			label: def.name,
			description: def.description || 'Custom channel type',
			showHash: false
		});
	}
}

// Fallback for completely unknown types
const fallbackRegistration: ChannelTypeRegistration = {
	icon: HelpCircle,
	viewComponent: () => import('$lib/components/chat/channels/FallbackChannelView.svelte'),
	label: 'Unknown',
	description: 'Unknown channel type',
	showHash: false
};

// Run on import
registerDefaults();
