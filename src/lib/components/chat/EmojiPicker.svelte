<script lang="ts">
	import { onMount } from 'svelte';
	import { Smile, Search, ImageIcon } from 'lucide-svelte';
	import {
		EMOJI_CATEGORIES,
		searchEmojis,
		getEmojiById,
		type EmojiCategory,
		type EmojiEntry
	} from '$lib/utils/emoji';
	import { customEmojisByCommunity, customEmojis } from '$lib/stores/emoji';
	import type { CustomEmojiWithCommunity } from '$lib/types';

	interface Props {
		onSelect: (emoji: string) => void;
		onClose?: () => void;
		align?: 'left' | 'right';
	}

	let { onSelect, onClose, align = 'right' }: Props = $props();

	let searchQuery = $state('');
	let containerRef: HTMLDivElement | null = $state(null);
	let scrollRef: HTMLDivElement | null = $state(null);
	let selectedCategoryId = $state<string>('people');
	let sectionRefs = $state<Record<string, HTMLDivElement | null>>({});
	let recentEmojiIds = $state<string[]>([]);

	const RECENT_KEY = 'zentra.recent-emojis';
	const RECENT_LIMIT = 24;

	let recentCategory = $derived.by((): EmojiCategory => {
		const emojis = recentEmojiIds
			.map((emojiId) => getEmojiById(emojiId))
			.filter((emoji): emoji is EmojiEntry => Boolean(emoji));

		return {
			id: 'recent',
			label: 'Recent',
			emojis
		};
	});

	// Build the combined list: custom emoji groups first, then standard categories
	let allSections = $derived.by(() => {
		const sections: Array<{
			id: string;
			label: string;
			type: 'native' | 'custom';
			nativeEmojis?: EmojiEntry[];
			customEmojis?: CustomEmojiWithCommunity[];
		}> = [];

		// Recent native emojis
		if (recentCategory.emojis.length > 0) {
			sections.push({
				id: 'recent',
				label: 'Recent',
				type: 'native',
				nativeEmojis: recentCategory.emojis
			});
		}

		// Custom emojis grouped by community
		for (const group of $customEmojisByCommunity) {
			sections.push({
				id: `custom-${group.communityId}`,
				label: group.communityName,
				type: 'custom',
				customEmojis: group.emojis
			});
		}

		// Standard unicode categories
		for (const category of EMOJI_CATEGORIES) {
			sections.push({
				id: category.id,
				label: category.label,
				type: 'native',
				nativeEmojis: category.emojis
			});
		}

		return sections;
	});

	// Search results for custom emojis
	let filteredCustomEmojis = $derived.by(() => {
		if (!searchQuery.trim()) return [];
		const q = searchQuery.trim().toLowerCase();
		return $customEmojis.filter(
			(e) => e.name.toLowerCase().includes(q) || e.communityName.toLowerCase().includes(q)
		);
	});

	let filteredNativeEmojis = $derived.by(() => {
		if (!searchQuery.trim()) return [];
		return searchEmojis(searchQuery);
	});

	let hasSearchResults = $derived(filteredCustomEmojis.length > 0 || filteredNativeEmojis.length > 0);

	function saveRecents() {
		if (typeof localStorage === 'undefined') return;
		localStorage.setItem(RECENT_KEY, JSON.stringify(recentEmojiIds));
	}

	function loadRecents() {
		if (typeof localStorage === 'undefined') return;
		const raw = localStorage.getItem(RECENT_KEY);
		if (!raw) return;

		try {
			const parsed = JSON.parse(raw);
			if (!Array.isArray(parsed)) return;
			recentEmojiIds = parsed.filter((item): item is string => typeof item === 'string').slice(0, RECENT_LIMIT);
		} catch {
			recentEmojiIds = [];
		}
	}

	function registerRecent(emoji: EmojiEntry) {
		recentEmojiIds = [emoji.id, ...recentEmojiIds.filter((id) => id !== emoji.id)].slice(0, RECENT_LIMIT);
		saveRecents();
	}

	function handleNativeEmojiClick(emoji: EmojiEntry) {
		registerRecent(emoji);
		onSelect(emoji.native);
	}

	function handleCustomEmojiClick(emoji: CustomEmojiWithCommunity) {
		// Insert custom emoji token that the renderer will pick up: <:name:id>
		onSelect(`<:${emoji.name}:${emoji.id}>`);
	}

	function jumpToCategory(categoryId: string) {
		selectedCategoryId = categoryId;
		const section = sectionRefs[categoryId];
		if (section) {
			section.scrollIntoView({ block: 'start', behavior: 'smooth' });
		}
	}

	function handleScroll() {
		if (!scrollRef) return;
		if (searchQuery.trim()) return;

		const scrollTop = scrollRef.scrollTop;
		let bestId = selectedCategoryId;
		let bestDistance = Number.POSITIVE_INFINITY;

		for (const section of allSections) {
			const ref = sectionRefs[section.id];
			if (!ref) continue;
			const distance = Math.abs(ref.offsetTop - scrollTop - 4);
			if (distance < bestDistance) {
				bestDistance = distance;
				bestId = section.id;
			}
		}

		selectedCategoryId = bestId;
	}

	function handleOutsideClick(e: MouseEvent) {
		if (containerRef && !containerRef.contains(e.target as Node)) {
			onClose?.();
		}
	}

	onMount(() => {
		loadRecents();
		document.addEventListener('mousedown', handleOutsideClick);
		return () => document.removeEventListener('mousedown', handleOutsideClick);
	});
</script>

<div
	bind:this={containerRef}
	class="absolute bottom-full {align === 'left'
		? 'left-0'
		: 'right-0'} mb-2 w-72 bg-surface border border-border rounded-lg shadow-xl overflow-hidden flex flex-col z-50 animate-in fade-in slide-in-from-bottom-2"
>
	<!-- Search -->
	<div class="p-2 border-b border-border">
		<div class="relative">
			<Search size={14} class="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
			<input
				type="text"
				bind:value={searchQuery}
				placeholder="Search emojis..."
				class="w-full pl-9 pr-3 py-1.5 bg-background border border-border rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-primary"
			/>
		</div>
	</div>

	<!-- Content -->
	<div bind:this={scrollRef} onscroll={handleScroll} class="flex-1 overflow-y-auto max-h-72 p-2 custom-scrollbar">
		{#if searchQuery.trim()}
			<!-- Custom emoji search results -->
			{#if filteredCustomEmojis.length > 0}
				<div class="mb-3">
					<h3 class="text-[10px] font-bold text-text-muted uppercase px-1 mb-1">Custom</h3>
					<div class="grid grid-cols-8 gap-1">
						{#each filteredCustomEmojis as emoji (emoji.id)}
							<button
								onclick={() => handleCustomEmojiClick(emoji)}
								title={`:${emoji.name}: (${emoji.communityName})`}
								class="w-8 h-8 flex items-center justify-center hover:bg-surface-hover rounded transition-colors"
							>
								<img
									src={emoji.imageUrl}
									alt={emoji.name}
									class="w-6 h-6 object-contain"
									loading="lazy"
								/>
							</button>
						{/each}
					</div>
				</div>
			{/if}

			<!-- Native emoji search results -->
			{#if filteredNativeEmojis.length > 0}
				<div class="mb-3">
					{#if filteredCustomEmojis.length > 0}
						<h3 class="text-[10px] font-bold text-text-muted uppercase px-1 mb-1">Standard</h3>
					{/if}
					<div class="grid grid-cols-8 gap-1">
						{#each filteredNativeEmojis as emoji (emoji.id)}
							<button
								onclick={() => handleNativeEmojiClick(emoji)}
								title={emoji.name}
								class="w-8 h-8 flex items-center justify-center text-xl hover:bg-surface-hover rounded transition-colors"
							>
								{emoji.native}
							</button>
						{/each}
					</div>
				</div>
			{/if}

			{#if !hasSearchResults}
				<p class="text-center py-4 text-sm text-text-muted">No emojis found</p>
			{/if}
		{:else}
			{#each allSections as section (section.id)}
				<div bind:this={sectionRefs[section.id]} class="mb-3 scroll-mt-1">
					<h3 class="text-[10px] font-bold text-text-muted uppercase px-1 mb-1">{section.label}</h3>
					<div class="grid grid-cols-8 gap-1">
						{#if section.type === 'custom' && section.customEmojis}
							{#each section.customEmojis as emoji (emoji.id)}
								<button
									onclick={() => handleCustomEmojiClick(emoji)}
									title={`:${emoji.name}:`}
									class="w-8 h-8 flex items-center justify-center hover:bg-surface-hover rounded transition-colors"
								>
									<img
										src={emoji.imageUrl}
										alt={emoji.name}
										class="w-6 h-6 object-contain"
										loading="lazy"
									/>
								</button>
							{/each}
						{:else if section.nativeEmojis}
							{#each section.nativeEmojis as emoji (emoji.id)}
								<button
									onclick={() => handleNativeEmojiClick(emoji)}
									title={emoji.name}
									class="w-8 h-8 flex items-center justify-center text-xl hover:bg-surface-hover rounded transition-colors"
								>
									{emoji.native}
								</button>
							{/each}
						{/if}
					</div>
				</div>
			{/each}
		{/if}
	</div>

	<!-- Bottom category tabs -->
	<div class="flex border-t border-border p-1 bg-surface-hover/50 overflow-x-auto">
		{#each allSections as section (section.id)}
			<button
				onclick={() => jumpToCategory(section.id)}
				class="shrink-0 h-8 w-8 flex items-center justify-center rounded transition-all {selectedCategoryId === section.id && !searchQuery.trim()
					? 'bg-surface text-text-primary'
					: 'text-text-muted hover:text-text-primary'}"
				title={section.label}
			>
				{#if section.id === 'recent'}
					🕒
				{:else if section.type === 'custom' && section.customEmojis?.[0]}
					<img src={section.customEmojis[0].imageUrl} alt="" class="w-5 h-5 object-contain" />
				{:else if section.nativeEmojis?.[0]}
					{section.nativeEmojis[0].native}
				{:else}
					🙂
				{/if}
			</button>
		{/each}
	</div>
</div>

<style>
	.custom-scrollbar::-webkit-scrollbar {
		width: 4px;
	}
	.custom-scrollbar::-webkit-scrollbar-track {
		background: transparent;
	}
	.custom-scrollbar::-webkit-scrollbar-thumb {
		background: var(--border);
		border-radius: 2px;
	}
</style>
