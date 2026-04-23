<script lang="ts">
	import { Button, Spinner } from '$lib/components/ui';
	import { Gavel, UserX } from 'lucide-svelte';
	import { api } from '$lib/api';
	import { addToast } from '$lib/stores/ui';
	import { getErrorMessage } from '$lib/utils/apiError';
	import type { CommunityBan } from '$lib/types';

	interface Props {
		communityId: string;
	}

	let { communityId }: Props = $props();

	let bans = $state<CommunityBan[]>([]);
	let isLoadingBans = $state(false);
	let loadedForCommunityId = $state<string | null>(null);

	$effect(() => {
		if (!communityId || loadedForCommunityId === communityId) return;
		loadedForCommunityId = communityId;
		bans = [];
		void loadBans();
	});

	async function loadBans() {
		if (!communityId || isLoadingBans) return;
		isLoadingBans = true;
		try {
			bans = await api.getBans(communityId);
		} catch (err) {
			console.error('Failed to load bans:', err);
			addToast({ type: 'error', message: 'Failed to load ban list' });
		} finally {
			isLoadingBans = false;
		}
	}

	async function handleUnban(userId: string) {
		if (!communityId) return;
		try {
			await api.unbanMember(communityId, userId);
			bans = bans.filter((item) => item.userId !== userId);
			addToast({ type: 'success', message: 'User unbanned' });
		} catch (err) {
			addToast({ type: 'error', message: getErrorMessage(err, 'Failed to unban user') });
		}
	}

	function formatRelativeTime(dateStr: string): string {
		const date = new Date(dateStr);
		const now = new Date();
		const diffMs = now.getTime() - date.getTime();
		const diffSec = Math.floor(diffMs / 1000);
		const diffMin = Math.floor(diffSec / 60);
		const diffHr = Math.floor(diffMin / 60);
		const diffDay = Math.floor(diffHr / 24);

		if (diffDay > 30) return date.toLocaleDateString();
		if (diffDay > 0) return `${diffDay}d ago`;
		if (diffHr > 0) return `${diffHr}h ago`;
		if (diffMin > 0) return `${diffMin}m ago`;
		return 'just now';
	}
</script>

<div class="space-y-4">
	<div>
		<h3 class="text-lg font-semibold text-text-primary">Bans</h3>
		<p class="text-sm text-text-muted">View and manage banned users</p>
	</div>

	{#if isLoadingBans}
		<div class="flex justify-center py-8">
			<Spinner size="lg" />
		</div>
	{:else if !bans || bans.length === 0}
		<div class="text-center py-8 text-text-muted">
			<Gavel size={32} class="mx-auto mb-2 opacity-50" />
			<p>No banned users</p>
			<p class="text-sm">Banned users will appear here</p>
		</div>
	{:else}
		<div class="space-y-2">
			{#each bans as ban (ban.id)}
				<div class="flex items-center justify-between p-3 bg-surface-hover rounded-lg">
					<div class="flex items-center gap-3 min-w-0">
						{#if ban.user?.avatarUrl}
							<img src={ban.user.avatarUrl} alt="" class="w-9 h-9 rounded-full object-cover shrink-0" />
						{:else}
							<div class="w-9 h-9 rounded-full bg-surface flex items-center justify-center shrink-0">
								<UserX size={16} class="text-text-muted" />
							</div>
						{/if}
						<div class="min-w-0">
							<p class="text-sm font-medium text-text-primary truncate">
								{ban.user?.displayName || ban.user?.username || 'Unknown User'}
							</p>
							<div class="flex items-center gap-2 text-xs text-text-muted">
								{#if ban.reason}
									<span class="truncate max-w-50" title={ban.reason}>Reason: {ban.reason}</span>
									<span>&middot;</span>
								{/if}
								<span>by {ban.bannedByUser?.displayName || ban.bannedByUser?.username || 'Unknown'}</span>
								<span>&middot;</span>
								<span>{formatRelativeTime(ban.createdAt)}</span>
							</div>
						</div>
					</div>
					<Button
						variant="ghost"
						size="sm"
						onclick={() => {
							if (confirm(`Unban ${ban.user?.displayName || ban.user?.username || 'this user'}?`)) {
								handleUnban(ban.userId);
							}
						}}
					>
						Unban
					</Button>
				</div>
			{/each}
		</div>
	{/if}
</div>
