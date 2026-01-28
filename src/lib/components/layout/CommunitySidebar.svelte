<script lang="ts">
	import { onMount } from 'svelte';
	import { Plus, Settings, Users, Home, Search, ChevronDown } from '$lib/components/icons';
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
	<Tooltip text="Home" position="right">
		<button
			onclick={handleHomeClick}
			class="w-12 h-12 rounded-2xl {$activeCommunityId === null
				? 'rounded-xl bg-primary text-background'
				: 'bg-surface-hover hover:bg-surface-active text-text-secondary hover:text-text-primary'} transition-all duration-200 flex items-center justify-center"
		>
			<Home size={24} />
		</button>
	</Tooltip>

	<div class="w-8 h-0.5 bg-border rounded-full my-1"></div>

	<!-- Communities list -->
	<div class="flex-1 w-full overflow-y-auto overflow-x-hidden flex flex-col items-center gap-2 px-3 scrollbar-hide">
		{#if $isLoadingCommunities}
			<div class="w-12 h-12 rounded-2xl bg-surface-hover animate-pulse"></div>
			<div class="w-12 h-12 rounded-2xl bg-surface-hover animate-pulse"></div>
		{:else}
			{#each communities as community (community.id)}
				<Tooltip text={community.name} position="right">
					<button
						onclick={() => handleCommunityClick(community)}
						class="relative w-12 h-12 rounded-2xl {$activeCommunityId === community.id
							? 'rounded-xl'
							: 'hover:rounded-xl'} bg-surface-hover hover:bg-surface-active transition-all duration-200 flex items-center justify-center group"
					>
						{#if community.iconUrl}
							<img
								src={community.iconUrl}
								alt={community.name}
								class="w-full h-full object-cover rounded-[inherit]"
							/>
						{:else}
							<span class="text-lg font-bold text-primary">
								{community.name.charAt(0).toUpperCase()}
							</span>
						{/if}
						{#if $activeCommunityId === community.id}
							<div
								class="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1.5 w-1.5 h-8 bg-text-primary rounded-full transition-all duration-200"
							></div>
						{:else}
							<div
								class="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1.5 w-1.5 h-2 bg-text-primary rounded-full opacity-0 group-hover:opacity-100 transition-all duration-200"
							></div>
						{/if}
					</button>
				</Tooltip>
			{/each}
		{/if}

		<!-- Add community button -->
		<Tooltip text="Create Community" position="right">
			<button
				onclick={openCreateCommunityModal}
				class="w-12 h-12 rounded-2xl hover:rounded-xl border-2 border-dashed border-border hover:border-primary text-text-muted hover:text-primary transition-all duration-200 flex items-center justify-center"
			>
				<Plus size={24} />
			</button>
		</Tooltip>

		<!-- Discover button -->
		<Tooltip text="Discover Communities" position="right">
			<button
				onclick={openDiscoverCommunitiesModal}
				class="w-12 h-12 rounded-2xl hover:rounded-xl bg-surface-hover hover:bg-success/20 text-text-muted hover:text-success transition-all duration-200 flex items-center justify-center"
			>
				<Search size={20} />
			</button>
		</Tooltip>
	</div>

	<div class="w-8 h-0.5 bg-border rounded-full my-1"></div>

	<!-- User section -->
	<div class="flex flex-col items-center gap-2">
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
				class="w-12 h-12 rounded-full overflow-hidden hover:opacity-80 transition-opacity"
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
