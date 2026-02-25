<script lang="ts">
	import { fly, fade } from 'svelte/transition';
	import { notificationPreviews, dismissNotificationPreview } from '$lib/stores/ui';
	import Avatar from './Avatar.svelte';
	import type { User } from '$lib/types';

	// Build a minimal synthetic User-shaped object for Avatar
	function syntheticUser(name: string, avatarUrl: string | null): User {
		return {
			id: '',
			username: name,
			displayName: name,
			avatarUrl,
			status: 'online',
			customStatus: null,
			bio: null,
			createdAt: ''
		};
	}
</script>

<!-- Positioned top-right, stacked cards -->
<div class="fixed top-4 right-4 z-200 flex flex-col gap-2 pointer-events-none" aria-live="polite">
	{#each $notificationPreviews as preview (preview.id)}
		<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
		<div
			role="button"
			tabindex="0"
			class="pointer-events-auto w-80 bg-surface border border-border/60 rounded-xl shadow-2xl overflow-hidden cursor-pointer select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
			in:fly={{ x: 60, duration: 250 }}
			out:fade={{ duration: 180 }}
			onclick={() => {
				preview.onClick?.();
				dismissNotificationPreview(preview.id);
			}}
			onkeydown={(e) => {
				if (e.key === 'Enter' || e.key === ' ') {
					e.preventDefault();
					preview.onClick?.();
					dismissNotificationPreview(preview.id);
				}
			}}
			aria-label="{preview.actorName}: {preview.body ?? preview.title}"
		>
			<!-- Thin accent bar on top -->
			<div class="h-0.5 w-full bg-primary/70"></div>

			<div class="flex items-start gap-3 px-4 py-3">
				<!-- Avatar -->
				<div class="shrink-0 mt-0.5">
					<Avatar user={syntheticUser(preview.actorName, preview.actorAvatarUrl)} size="md" />
				</div>

				<!-- Text -->
				<div class="flex-1 min-w-0">
					<p class="text-xs font-semibold text-text-muted uppercase tracking-wide leading-none mb-1">
						{preview.title}
					</p>
					{#if preview.body}
						<p class="text-sm text-text-primary leading-snug line-clamp-2">
							<span class="font-semibold text-text-primary">{preview.actorName}</span>
							<span class="text-text-secondary"> {preview.body}</span>
						</p>
					{:else}
						<p class="text-sm font-semibold text-text-primary">{preview.actorName}</p>
					{/if}
				</div>

				<!-- Dismiss button -->
				<button
					class="shrink-0 p-0.5 text-text-muted hover:text-text-primary transition-colors"
					aria-label="Dismiss notification"
					onclick={(e) => { e.stopPropagation(); dismissNotificationPreview(preview.id); }}
				>
					<svg width="14" height="14" viewBox="0 0 14 14" fill="none">
						<path d="M1 1l12 12M13 1L1 13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
					</svg>
				</button>
			</div>
		</div>
	{/each}
</div>
