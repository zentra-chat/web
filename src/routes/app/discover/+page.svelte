<script lang="ts">
	import { goto } from '$app/navigation';
	import { Search, Users, Globe, Lock } from 'lucide-svelte';
	import { Avatar, Button, Spinner } from '$lib/components/ui';
	import { api } from '$lib/api';
	import { addCommunity, selectCommunity } from '$lib/stores/community';
	import { addToast } from '$lib/stores/ui';
	import type { Community } from '$lib/types';

	type ApiErrorLike = { error?: string; message?: string; response?: { data?: { message?: string } } };

	let searchQuery = $state('');
	let communities = $state<Community[]>([]);
	let isLoading = $state(true);
	let isSearching = $state(false);
	let isJoining = $state<string | null>(null);
	let hasSearched = $state(false);

	const title = $derived(searchQuery.trim() ? 'Search Results' : 'Top Public Servers');

	$effect(() => {
		void loadTopPublicServers();
	});

	async function loadTopPublicServers() {
		isLoading = true;
		try {
			communities = (await api.discoverCommunities(undefined, 1, 24)) || [];
			hasSearched = false;
		} catch (err) {
			console.error('Failed to load public servers:', err);
			addToast({ type: 'error', message: 'Failed to load public servers' });
		} finally {
			isLoading = false;
		}
	}

	async function handleSearch() {
		const query = searchQuery.trim();
		if (!query) {
			await loadTopPublicServers();
			return;
		}

		isSearching = true;
		hasSearched = true;
		try {
			communities = (await api.discoverCommunities(query, 1, 24)) || [];
		} catch (err) {
			console.error('Failed to search communities:', err);
			addToast({ type: 'error', message: 'Failed to search communities' });
		} finally {
			isSearching = false;
		}
	}

	function handleSearchKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			void handleSearch();
		}
	}

	async function handleJoin(community: Community) {
		if (isJoining) return;
		isJoining = community.id;

		try {
			await api.joinCommunity(community.id);
			addCommunity(community);
			addToast({ type: 'success', message: `Joined ${community.name}!` });
			selectCommunity(community.id);
			goto('/app');
		} catch (err: unknown) {
			const apiError = err as ApiErrorLike;
			console.error('Failed to join community:', err);
			addToast({
				type: 'error',
				message:
					apiError.response?.data?.message || apiError.error || apiError.message || 'Failed to join community'
			});
		} finally {
			isJoining = null;
		}
	}

	function formatMemberCount(count: number): string {
		if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
		if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
		return count.toString();
	}
</script>

<div class="flex-1 min-h-0 overflow-y-auto bg-background">
	<div class="max-w-7xl mx-auto px-6 py-6 md:px-8 md:py-8">
		<div class="mb-6">
			<h1 class="text-2xl font-bold text-text-primary">Discover Communities</h1>
			<p class="text-sm text-text-muted mt-1">Find public servers and join with one click.</p>
		</div>

		<div class="relative mb-6">
			<Search size={18} class="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
			<input
				type="text"
				bind:value={searchQuery}
				onkeydown={handleSearchKeydown}
				placeholder="Search public servers..."
				class="w-full pl-10 pr-24 py-3 bg-surface border border-border rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-primary"
			/>
			<Button
				size="sm"
				class="absolute right-2 top-1/2 -translate-y-1/2"
				onclick={handleSearch}
				disabled={isSearching}
			>
				{#if isSearching}
					<Spinner size="sm" />
				{:else}
					Search
				{/if}
			</Button>
		</div>

		<div class="mb-4 flex items-center justify-between">
			<h2 class="text-lg font-semibold text-text-primary">{title}</h2>
			{#if searchQuery.trim()}
				<Button variant="ghost" size="sm" onclick={() => { searchQuery = ''; void loadTopPublicServers(); }}>
					Clear
				</Button>
			{/if}
		</div>

		{#if isLoading}
			<div class="flex items-center justify-center py-20">
				<Spinner size="lg" />
			</div>
		{:else if communities.length === 0}
			<div class="bg-surface border border-border rounded-xl p-10 text-center">
				<Users size={42} class="mx-auto text-text-muted mb-3" />
				<h3 class="text-lg font-semibold text-text-primary mb-1">
					{hasSearched ? 'No servers found' : 'No public servers available'}
				</h3>
				<p class="text-sm text-text-muted">
					{hasSearched ? 'Try a different search term.' : 'Check back soon for community listings.'}
				</p>
			</div>
		{:else}
			<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
				{#each communities as community (community.id)}
					<div class="bg-surface border border-border rounded-xl p-4 flex flex-col">
						<div class="flex items-center gap-3 mb-3 min-w-0">
							<Avatar src={community.iconUrl} alt={community.name} size="lg" />
							<div class="min-w-0 flex-1">
								<p class="font-semibold text-text-primary truncate">{community.name}</p>
								<div class="flex items-center gap-1 text-xs text-text-muted">
									{#if community.isPublic}
										<Globe size={12} />
									{:else}
										<Lock size={12} />
									{/if}
									<span>{formatMemberCount(community.memberCount || 0)} members</span>
								</div>
							</div>
						</div>

						<p class="text-sm text-text-muted line-clamp-3 flex-1">
							{community.description || 'No description provided.'}
						</p>

						<Button
							class="mt-4"
							onclick={() => handleJoin(community)}
							loading={isJoining === community.id}
							variant={community.isPublic ? 'primary' : 'secondary'}
						>
							{community.isPublic ? 'Join' : 'Request Join'}
						</Button>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>
