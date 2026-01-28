<script lang="ts">
	import { onMount } from 'svelte';
	import { Smile, Search } from '$lib/components/icons';

	interface Props {
		onSelect: (emoji: string) => void;
		onClose?: () => void;
		align?: 'left' | 'right';
	}

	let { onSelect, onClose, align = 'right' }: Props = $props();

	let searchQuery = $state('');
	let containerRef: HTMLDivElement | null = $state(null);

	const categories = [
		{ name: 'Recent', icon: '🕒', emojis: ['👍', '❤️', '🔥', '😂', '😮', '😢', '🎉', '💯'] },
		{ name: 'Smileys', icon: '😀', emojis: ['😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩', '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😮', '😯', '😲', '😳', '🥺', '😦', '😧', '😨', '😰', '😥', '😢', '😭', '😱', '😖', '😣', '😞', '😓', '😩', '😫', '🥱', '😤', '😡', '😠', '🤬', '😈', '👿', '💀', '☠️', '💩', '🤡', '👹', '👺', '👻', '👽', '👾', '🤖'] },
		{ name: 'Gestures', icon: '👋', emojis: ['👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '👍', '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝', '🙏', '✍️', '💅', '🤳', '💪', '🦾'] },
		{ name: 'Hearts', icon: '❤️', emojis: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟'] },
		{ name: 'Animals', icon: '🐶', emojis: ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐻‍❄️', '🐨', '🐯', '🦁', '🐮', '🐷', '🐽', '🐸', '🐵', '🙈', '🙉', '🙊', '🐒', '🦍', '🦧', '🐶', '🐕', '🦮', '🐕‍🦺', '🐩', '🐺', '🦊', '🦝', '🐱', '🐈', '🐈‍⬛', '🦁', '🐯', '🐅', '🐆', '🐴', '🐎', '🦄', '🦓', '🦌', '🦬', '🐮', '🐂', '🐃', '🐄', '🐷', '🐖', '🐗', '🐽', '🐏', '🐑', '🐐', '🐪', '🐫', '🦙', '🦒', '🐘', '🦣', '🦏', '🦛', '🐭', '🖱️', '🐀', '🐹', '🐰', '🐇', '🐿️', '🦫', '🦔', '🦇', '🐻', '🐻‍❄️', '🐨', '🐼', '🦥', '🦦', '🦨', '🦘', '🦡', '🐾'] }
	];

	let filteredEmojis = $derived.by(() => {
		if (!searchQuery) return null;
		const query = searchQuery.toLowerCase();
		const all = categories.flatMap(c => c.emojis);
		return [...new Set(all)].filter(e => e.includes(query)); // Basic filtering, could be improved with emoji names
	});

	function handleEmojiClick(emoji: string) {
		onSelect(emoji);
	}

	function handleOutsideClick(e: MouseEvent) {
		if (containerRef && !containerRef.contains(e.target as Node)) {
			onClose?.();
		}
	}

	onMount(() => {
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
	<div class="flex-1 overflow-y-auto max-h-64 p-2 custom-scrollbar">
		{#if filteredEmojis}
			<div class="grid grid-cols-8 gap-1">
				{#each filteredEmojis as emoji}
					<button
						onclick={() => handleEmojiClick(emoji)}
						class="w-8 h-8 flex items-center justify-center text-xl hover:bg-surface-hover rounded transition-colors"
					>
						{emoji}
					</button>
				{/each}
			</div>
			{#if filteredEmojis.length === 0}
				<p class="text-center py-4 text-sm text-text-muted">No emojis found</p>
			{/if}
		{:else}
			{#each categories as category}
				<div class="mb-3">
					<h3 class="text-[10px] font-bold text-text-muted uppercase px-1 mb-1">{category.name}</h3>
					<div class="grid grid-cols-8 gap-1">
						{#each category.emojis as emoji}
							<button
								onclick={() => handleEmojiClick(emoji)}
								class="w-8 h-8 flex items-center justify-center text-xl hover:bg-surface-hover rounded transition-colors"
							>
								{emoji}
							</button>
						{/each}
					</div>
				</div>
			{/each}
		{/if}
	</div>

	<!-- Bottom categories -->
	<div class="flex border-t border-border p-1 bg-surface-hover/50">
		{#each categories as category}
			<button
				class="flex-1 h-8 flex items-center justify-center grayscale hover:grayscale-0 transition-all opacity-60 hover:opacity-100"
				title={category.name}
			>
				{category.icon}
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
