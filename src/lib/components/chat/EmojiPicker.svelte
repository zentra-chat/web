<script lang="ts">
	import { onMount } from 'svelte';
	import { Smile, Search } from 'lucide-svelte';
	import {
		EMOJI_CATEGORIES,
		searchEmojis,
		getEmojiById,
		type EmojiCategory,
		type EmojiEntry
	} from '$lib/utils/emoji';

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

	let categories = $derived.by(() => {
		if (recentCategory.emojis.length > 0) {
			return [recentCategory, ...EMOJI_CATEGORIES];
		}
		return EMOJI_CATEGORIES;
	});

	let filteredEmojis = $derived.by(() => {
		if (!searchQuery.trim()) return [];
		return searchEmojis(searchQuery);
	});

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

	function handleEmojiClick(emoji: EmojiEntry) {
		registerRecent(emoji);
		onSelect(emoji.native);
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

		for (const category of categories) {
			const section = sectionRefs[category.id];
			if (!section) continue;
			const distance = Math.abs(section.offsetTop - scrollTop - 4);
			if (distance < bestDistance) {
				bestDistance = distance;
				bestId = category.id;
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
			<div class="grid grid-cols-8 gap-1">
				{#each filteredEmojis as emoji (emoji.id)}
					<button
						onclick={() => handleEmojiClick(emoji)}
						title={emoji.name}
						class="w-8 h-8 flex items-center justify-center text-xl hover:bg-surface-hover rounded transition-colors"
					>
						{emoji.native}
					</button>
				{/each}
			</div>
			{#if filteredEmojis.length === 0}
				<p class="text-center py-4 text-sm text-text-muted">No emojis found</p>
			{/if}
		{:else}
			{#each categories as category (category.id)}
				<div bind:this={sectionRefs[category.id]} class="mb-3 scroll-mt-1">
					<h3 class="text-[10px] font-bold text-text-muted uppercase px-1 mb-1">{category.label}</h3>
					<div class="grid grid-cols-8 gap-1">
						{#each category.emojis as emoji (emoji.id)}
							<button
								onclick={() => handleEmojiClick(emoji)}
								title={emoji.name}
								class="w-8 h-8 flex items-center justify-center text-xl hover:bg-surface-hover rounded transition-colors"
							>
								{emoji.native}
							</button>
						{/each}
					</div>
				</div>
			{/each}
		{/if}
	</div>

	<!-- Bottom categories -->
	<div class="flex border-t border-border p-1 bg-surface-hover/50">
		{#each categories as category (category.id)}
			<button
				onclick={() => jumpToCategory(category.id)}
				class="flex-1 h-8 flex items-center justify-center rounded transition-all {selectedCategoryId === category.id && !searchQuery.trim()
					? 'bg-surface text-text-primary'
					: 'text-text-muted hover:text-text-primary'}"
				title={category.label}
			>
				{category.id === 'recent'
					? '🕒'
					: category.emojis[0]?.native || '🙂'}
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
