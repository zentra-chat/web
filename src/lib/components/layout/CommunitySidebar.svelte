<script lang="ts">
	import { onMount } from 'svelte';
	import { Plus, Settings, Users, Home, Search, ChevronDown } from 'lucide-svelte';
	import { Avatar, Button, Tooltip } from '$lib/components/ui';
	import {
		activeInstance,
		currentUser,
		clearInstanceAuth
	} from '$lib/stores/instance';
	import {
		communitiesCache,
		activeCommunityId,
		selectCommunity,
		isLoadingCommunities
	} from '$lib/stores/community';
	import {
		isMobileMenuOpen,
		openModal,
		openCreateCommunityModal,
		openDiscoverCommunitiesModal,
		openSettingsModal
	} from '$lib/stores/ui';
	import { api } from '$lib/api';
	import type { Community } from '$lib/types';
	import { goto } from '$app/navigation';

	let communities = $derived($communitiesCache[$activeInstance?.id || ''] || []);

	onMount(async () => {
		if (!$activeInstance) return;

		isLoadingCommunities.set(true);
		try {
			const list = (await api.getMyCommunities()) || [];
			communitiesCache.update((cache) => ({
				...cache,
				[$activeInstance!.id]: list
			}));
		} catch (err) {
			console.error('Failed to load communities:', err);
		} finally {
			isLoadingCommunities.set(false);
		}
	});

	function handleCommunityClick(community: Community) {
		selectCommunity(community.id);
	}

	function handleHomeClick() {
		selectCommunity(null);
	}

	function handleLogout() {
		if ($activeInstance) {
			clearInstanceAuth($activeInstance.id);
		}
		goto('/login');
	}
</script>

<aside
	class="w-18 bg-surface flex flex-col items-center py-3 gap-2 border-r border-border z-20
	{$isMobileMenuOpen ? 'fixed left-18 top-0 bottom-0 z-50' : 'hidden md:flex'}"
>
	<!-- Home / DMs button -->
	<div class="relative group">
		<div
			class="absolute -left-3 top-1/2 -translate-y-1/2 w-1.5 bg-text-primary rounded-r-full transition-all duration-200
			{$activeCommunityId === null ? 'h-10' : 'h-0 group-hover:h-5'}"
		></div>
		<Tooltip text="Home" position="right">
			<button
				onclick={handleHomeClick}
				class="w-12 h-12 flex items-center justify-center transition-all duration-200
				{$activeCommunityId === null
					? 'bg-primary text-background rounded-xl'
					: 'bg-surface-hover hover:bg-primary hover:text-background rounded-2xl hover:rounded-xl text-text-secondary'}"
			>
				<Home size={24} />
			</button>
		</Tooltip>
	</div>

	<div class="w-8 h-0.5 bg-border rounded-full my-1"></div>

	<!-- Communities list -->
	<div class="flex-1 w-full overflow-y-auto overflow-x-hidden flex flex-col items-center gap-2 px-3 scrollbar-hide">
		{#if $isLoadingCommunities}
			{#each Array(3) as _}
				<div class="w-12 h-12 rounded-2xl bg-surface-hover animate-pulse"></div>
			{/each}
		{:else}
			{#each communities as community (community.id)}
				<div class="relative group">
					<div
						class="absolute -left-3 top-1/2 -translate-y-1/2 w-1.5 bg-text-primary rounded-r-full transition-all duration-200
						{$activeCommunityId === community.id ? 'h-10' : 'h-0 group-hover:h-5'}"
					></div>
					<Tooltip text={community.name} position="right">
						<button
							onclick={() => handleCommunityClick(community)}
							class="w-12 h-12 transition-all duration-200 flex items-center justify-center overflow-hidden
							{$activeCommunityId === community.id
								? 'rounded-xl'
								: 'rounded-2xl hover:rounded-xl bg-surface-hover hover:bg-primary'}"
						>
							{#if community.iconUrl}
								<img
									src={community.iconUrl}
									alt={community.name}
									class="w-full h-full object-cover"
								/>
							{:else}
								<div
									class="w-full h-full flex items-center justify-center font-bold text-lg
									{$activeCommunityId === community.id ? 'text-white' : 'text-text-secondary group-hover:text-white'}"
								>
									{community.name.substring(0, 1).toUpperCase()}
								</div>
							{/if}
						</button>
					</Tooltip>
				</div>
			{/each}
		{/if}

		<!-- Add community button -->
		<div class="relative group">
			<div
				class="absolute -left-3 top-1/2 -translate-y-1/2 w-1.5 bg-success rounded-r-full transition-all duration-200 h-0 group-hover:h-5"
			></div>
			<Tooltip text="Create Community" position="right">
				<button
					onclick={openCreateCommunityModal}
					class="w-12 h-12 rounded-2xl hover:rounded-xl bg-surface-hover hover:bg-success text-success hover:text-white transition-all duration-200 flex items-center justify-center"
				>
					<Plus size={24} />
				</button>
			</Tooltip>
		</div>

		<!-- Discover button -->
		<div class="relative group">
			<div
				class="absolute -left-3 top-1/2 -translate-y-1/2 w-1.5 bg-success rounded-r-full transition-all duration-200 h-0 group-hover:h-5"
			></div>
			<Tooltip text="Discover Communities" position="right">
				<button
					onclick={openDiscoverCommunitiesModal}
					class="w-12 h-12 rounded-2xl hover:rounded-xl bg-surface-hover hover:bg-success text-success hover:text-white transition-all duration-200 flex items-center justify-center"
				>
					<Search size={20} />
				</button>
			</Tooltip>
		</div>
	</div>

	<div class="w-8 h-0.5 bg-border rounded-full my-1"></div>

	<!-- User section -->
	<div class="flex flex-col items-center gap-2 mt-auto">
		<Tooltip text="Settings" position="right">
			<button
				onclick={openSettingsModal}
				class="w-12 h-12 rounded-2xl hover:rounded-xl bg-surface-hover hover:bg-surface-active text-text-secondary hover:text-text-primary transition-all duration-200 flex items-center justify-center"
			>
				<Settings size={20} />
			</button>
		</Tooltip>

		<Tooltip text={$currentUser?.username || 'Profile'} position="right">
			<button
				onclick={() => openModal('profile')}
				class="w-12 h-12 rounded-full overflow-hidden hover:opacity-80 transition-opacity flex items-center justify-center"
			>
				<Avatar user={$currentUser} size="lg" />
			</button>
		</Tooltip>
	</div>
</aside>

<style>
	.scrollbar-hide::-webkit-scrollbar {
		display: none;
	}
	.scrollbar-hide {
		-ms-overflow-style: none;
		scrollbar-width: none;
	}
</style>
