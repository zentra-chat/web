import { writable, derived } from 'svelte/store';
import type { CustomEmojiWithCommunity } from '$lib/types';
import { api } from '$lib/api';

// All custom emojis the user can access, grouped by community
export const customEmojis = writable<CustomEmojiWithCommunity[]>([]);
export const customEmojisLoaded = writable(false);

// Grouped by community for the emoji picker
export const customEmojisByCommunity = derived(customEmojis, ($emojis) => {
	const grouped = new Map<string, { communityId: string; communityName: string; emojis: CustomEmojiWithCommunity[] }>();

	for (const emoji of $emojis) {
		let group = grouped.get(emoji.communityId);
		if (!group) {
			group = { communityId: emoji.communityId, communityName: emoji.communityName, emojis: [] };
			grouped.set(emoji.communityId, group);
		}
		group.emojis.push(emoji);
	}

	return Array.from(grouped.values());
});

// Quick lookup by :name: or by ID for rendering
export const customEmojiById = derived(customEmojis, ($emojis) => {
	const map = new Map<string, CustomEmojiWithCommunity>();
	for (const emoji of $emojis) {
		map.set(emoji.id, emoji);
	}
	return map;
});

// Fetch all emojis the user has access to. Call on login / community change.
export async function loadCustomEmojis(): Promise<void> {
	try {
		const emojis = await api.getAccessibleEmojis();
		customEmojis.set(emojis);
		customEmojisLoaded.set(true);
	} catch (err) {
		console.error('Failed to load custom emojis:', err);
	}
}

// Call after creating/deleting/updating an emoji to refresh the cache
export async function refreshCustomEmojis(): Promise<void> {
	return loadCustomEmojis();
}
