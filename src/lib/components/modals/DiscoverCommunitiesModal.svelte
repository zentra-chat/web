<script lang="ts">
	import { Modal, Input, Button, Spinner, Avatar } from '$lib/components/ui';
	import { Search, Users, Lock, Globe } from '$lib/components/icons';
	import { discoverCommunitiesModalOpen, closeDiscoverCommunitiesModal, addToast } from '$lib/stores/ui';
	import { addCommunity } from '$lib/stores/community';
	import { api } from '$lib/api';
	import type { Community } from '$lib/types';

	let searchQuery = $state('');
	let communities = $state<Community[]>([]);
	let isSearching = $state(false);
	let isJoining = $state<string | null>(null);
	let hasSearched = $state(false);

	async function handleSearch() {
		if (!searchQuery.trim()) return;

		isSearching = true;
		hasSearched = true;

		try {
			communities = (await api.discoverCommunities(searchQuery.trim(), 1, 20)) || [];
		} catch (err) {
			console.error('Failed to search communities:', err);
			addToast({
				type: 'error',
				message: 'Failed to search communities'
			});
		} finally {
			isSearching = false;
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			handleSearch();
		}
	}

	async function handleJoin(community: Community) {
		if (isJoining) return;

		isJoining = community.id;

		try {
			await api.joinCommunity(community.id);
			addCommunity(community);
			addToast({
				type: 'success',
				message: `Joined ${community.name}!`
			});
			// Remove from discover list
			communities = communities.filter(c => c.id !== community.id);
		} catch (err: any) {
			console.error('Failed to join community:', err);
			addToast({
				type: 'error',
				message: err.response?.data?.message || 'Failed to join community'
			});
		} finally {
			isJoining = null;
		}
	}

	function handleClose() {
		closeDiscoverCommunitiesModal();
		searchQuery = '';
		communities = [];
		hasSearched = false;
	}

	function formatMemberCount(count: number): string {
		if (count >= 1000000) {
			return `${(count / 1000000).toFixed(1)}M`;
		}
		if (count >= 1000) {
			return `${(count / 1000).toFixed(1)}K`;
		}
		return count.toString();
	}
</script>

<Modal isOpen={$discoverCommunitiesModalOpen} onclose={handleClose} title="Discover Communities" size="lg">
	<!-- Search -->
	<div class="relative mb-6">
		<Search size={18} class="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
		<input
			type="text"
			bind:value={searchQuery}
			onkeydown={handleKeydown}
			placeholder="Search for communities..."
			class="w-full pl-10 pr-20 py-3 bg-surface border border-border rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-primary"
		/>
		<Button
			size="sm"
			class="absolute right-2 top-1/2 -translate-y-1/2"
			onclick={handleSearch}
			disabled={isSearching || !searchQuery.trim()}
		>
			{#if isSearching}
				<Spinner size="sm" />
			{:else}
				Search
			{/if}
		</Button>
	</div>

	<!-- Results -->
	<div class="min-h-75 max-h-100 overflow-y-auto">
		{#if isSearching}
			<div class="flex items-center justify-center h-64">
				<Spinner size="lg" />
			</div>
		{:else if communities.length > 0}
			<div class="space-y-2">
				{#each communities as community (community.id)}
					<div class="flex items-center gap-4 p-4 bg-surface rounded-lg hover:bg-surface-hover transition-colors">
						<Avatar
								src={community.iconUrl}
							alt={community.name}
							size="lg"
						/>
						<div class="flex-1 min-w-0">
							<div class="flex items-center gap-2">
								<h3 class="font-semibold text-text-primary truncate">{community.name}</h3>
									{#if !community.isPublic}
									<Lock size={14} class="text-text-muted shrink-0" />
								{:else}
									<Globe size={14} class="text-text-muted shrink-0" />
								{/if}
							</div>
							{#if community.description}
								<p class="text-sm text-text-muted line-clamp-2">{community.description}</p>
							{/if}
							<div class="flex items-center gap-1 mt-1 text-xs text-text-muted">
								<Users size={12} />
								<span>{formatMemberCount(community.memberCount || 0)} members</span>
							</div>
						</div>
						<Button
							size="sm"
								variant={!community.isPublic ? 'secondary' : 'primary'}
							onclick={() => handleJoin(community)}
							loading={isJoining === community.id}
						>
								{#if !community.isPublic}
								Request Join
							{:else}
								Join
							{/if}
						</Button>
					</div>
				{/each}
			</div>
		{:else if hasSearched}
			<div class="flex flex-col items-center justify-center h-64 text-center">
				<Search size={48} class="text-text-muted mb-4" />
				<h3 class="text-lg font-semibold text-text-primary mb-2">No communities found</h3>
				<p class="text-text-muted">Try a different search term or create your own community!</p>
			</div>
		{:else}
			<div class="flex flex-col items-center justify-center h-64 text-center">
				<Users size={48} class="text-text-muted mb-4" />
				<h3 class="text-lg font-semibold text-text-primary mb-2">Find your community</h3>
				<p class="text-text-muted">Search for communities by name or topic</p>
			</div>
		{/if}
	</div>
</Modal>
