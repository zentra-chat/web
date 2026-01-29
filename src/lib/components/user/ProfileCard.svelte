<script lang="ts">
	import { fade, scale } from 'svelte/transition';
	import { clickOutside } from '$lib/utils/clickOutside';
	import { Button } from '$lib/components/ui';
	import { MessageSquare, User, MoreHorizontal, Settings, Edit, Clock } from '$lib/components/icons';
	import { profileCardOpen, profileCardUser, profileCardPosition, closeProfileCard, openModal } from '$lib/stores/ui';
	import { currentUserId } from '$lib/stores/instance';
	import { format } from 'date-fns';

	let user = $derived($profileCardUser);
	let position = $derived($profileCardPosition);
	let isOwnProfile = $derived(user?.id === $currentUserId);

	function handleMessage() {
		// DM: Once DM's have been implmented, this needs to be updated
		alert('Direct messages not yet implemented');
		closeProfileCard();
	}

	function handleEditProfile() {
		closeProfileCard();
		openModal('settings');
	}
</script>

{#if $profileCardOpen && user}
	<div
		class="fixed z-50 pointer-events-none"
		style="left: {position.x}px; top: {position.y}px;"
		transition:fade={{ duration: 150 }}
	>
		<div
			class="pointer-events-auto w-[300px] bg-bg-secondary rounded-xl shadow-2xl border border-border overflow-visible bg-background"
			use:clickOutside={closeProfileCard}
			transition:scale={{ duration: 150, start: 0.95 }}
		>
			<!-- Header/Banner -->
			<div class="h-20 bg-primary/20 relative overflow-visible">
				<div class="absolute -bottom-10 left-4 profile-avatar-wrapper border-4 border-bg-secondary rounded-full bg-bg-secondary overflow-hidden flex items-center justify-center">
					{#if user.avatarUrl}
						<img src={user.avatarUrl} alt={user.displayName || user.username} class="w-[64px] h-[64px] object-cover block" />
					{:else}
						<div class="w-[64px] h-[64px] flex items-center justify-center font-medium text-primary bg-linear-to-br from-primary/20 to-secondary/20">
							{(user.displayName || user.username).split(' ').map((n) => n[0]).join('').slice(0,2).toUpperCase()}
						</div>
					{/if}
				</div>
			</div>

			<!-- Actions -->
			<div class="flex justify-end p-2 min-h-[40px]">
				{#if isOwnProfile}
					<button
						class="p-1.5 hover:bg-bg-tertiary rounded-full transition-colors text-text-muted hover:text-text-primary"
						onclick={handleEditProfile}
						title="Edit Profile"
					>
						<Edit size={18} />
					</button>
				{:else}
					<button
						class="p-1.5 hover:bg-bg-tertiary rounded-full transition-colors text-text-muted hover:text-text-primary"
					>
						<MoreHorizontal size={18} />
					</button>
				{/if}
			</div>

			<!-- Content -->
			<div class="px-4 pb-4 mt-2">
				<div class="mb-4">
					<h2 class="text-xl font-bold text-text-primary truncate">
						{user.displayName || user.username}
					</h2>
					<p class="text-sm text-text-muted">@{user.username}</p>
				</div>

				{#if user.customStatus}
					<div class="mb-4 p-2 bg-bg-tertiary rounded-lg text-sm text-text-secondary italic">
						{user.customStatus}
					</div>
				{/if}

				{#if user.bio}
					<div class="mb-4">
						<h3 class="text-xs font-bold uppercase text-text-muted mb-1">About Me</h3>
						<p class="text-sm text-text-secondary whitespace-pre-wrap">{user.bio}</p>
					</div>
				{/if}

				<div class="space-y-3 pt-2 border-t border-border">
					{#if !isOwnProfile}
						<Button variant="primary" class="w-full gap-2" onclick={handleMessage}>
							<MessageSquare size={16} />
							Message
						</Button>
					{/if}
					
					<div class="flex items-center gap-2 text-xs text-text-muted">
						<Clock size={12} />
						<span>Member since {format(new Date(user.createdAt || new Date()), 'MMM d, yyyy')}</span>
					</div>
				</div>
			</div>
		</div>
	</div>
{/if}

<style>
	/* Background styling for the profile card */
</style>
