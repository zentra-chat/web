<script lang="ts">
	import { onMount } from 'svelte';
	import { Plus, Settings, Users, Home, Search, UserPlus, LogOut } from 'lucide-svelte';
	import { Avatar, Button, Tooltip } from '$lib/components/ui';
	import {
		activeInstance,
		currentUser,
		activeInstanceSavedAccounts,
		switchActiveAccount
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
		openSettingsModal,
		addToast,
		userSettings
	} from '$lib/stores/ui';
	import { api } from '$lib/api';
	import type { Community, User } from '$lib/types';
	import { goto } from '$app/navigation';

	let communities = $derived($communitiesCache[$activeInstance?.id || ''] || []);
	let developerModeEnabled = $derived(Boolean($userSettings?.settings?.developerMode));
	let contextMenu = $state<{ x: number; y: number; serverId: string } | null>(null);
	let switchingUserId = $state<string | null>(null);
	let isLoggingOut = $state(false);

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

	function handleCommunityContextMenu(event: MouseEvent, community: Community) {
		if (!developerModeEnabled) {
			return;
		}
		event.preventDefault();
		contextMenu = { x: event.clientX, y: event.clientY, serverId: community.id };
	}

	async function handleCopyServerId(serverId: string) {
		try {
			await navigator.clipboard.writeText(serverId);
			addToast({ type: 'success', message: 'Server ID copied' });
		} catch (err) {
			console.error('Failed to copy server ID:', err);
			addToast({ type: 'error', message: 'Failed to copy server ID' });
		}
		contextMenu = null;
	}

	function handleHomeClick() {
		selectCommunity(null);
	}

	function makeMenuAvatarUser(account: {
		userId: string;
		username: string;
		displayName: string;
		avatarUrl: string | null;
	}): User {
		return {
			id: account.userId,
			username: account.username,
			displayName: account.displayName,
			avatarUrl: account.avatarUrl,
			status: 'online',
			customStatus: null,
			bio: null,
			createdAt: new Date().toISOString()
		};
	}

	function handleAddAccount() {
		goto('/login?addAccount=1');
	}

	async function handleLogout() {
		if (isLoggingOut) return;
		isLoggingOut = true;
		try {
			await api.logout();
			addToast({ type: 'success', message: 'Logged out' });
		} catch (err) {
			console.error('Failed to log out cleanly:', err);
			addToast({ type: 'warning', message: 'Logged out locally' });
		} finally {
			isLoggingOut = false;
			goto('/login');
		}
	}

	function handleSwitchAccount(userId: string) {
		if (switchingUserId) return;
		if ($currentUser?.id === userId) return;

		switchingUserId = userId;
		try {
			const switched = switchActiveAccount(userId);
			if (!switched) {
				addToast({ type: 'error', message: 'Saved session expired. Sign in again.' });
				return;
			}

			window.location.assign('/app');
		} finally {
			switchingUserId = null;
		}
	}

	$effect(() => {
		if (!contextMenu) return;
		const close = (event: MouseEvent) => {
			if (event.button !== 0) return;
			contextMenu = null;
		};
		window.addEventListener('click', close);
		return () => {
			window.removeEventListener('click', close);
		};
	});
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
							oncontextmenu={(event) => handleCommunityContextMenu(event, community)}
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

		<div class="relative group" role="presentation">
			<button
				class="w-12 h-12 rounded-full overflow-hidden hover:opacity-80 transition-opacity flex items-center justify-center"
				aria-haspopup="menu"
				aria-label="Open profile menu"
			>
				<Avatar user={$currentUser} size="lg" />
			</button>

			<div
				class="absolute left-full bottom-0 ml-3 w-64 p-2 bg-surface border border-border rounded-xl shadow-xl z-60
				opacity-0 invisible pointer-events-none transition-all duration-150
				group-hover:opacity-100 group-hover:visible group-hover:pointer-events-auto
				group-focus-within:opacity-100 group-focus-within:visible group-focus-within:pointer-events-auto"
				role="menu"
			>
					<button
						onclick={() => {
							openModal('profile');
						}}
						class="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-sm text-text-primary hover:bg-surface-hover"
						role="menuitem"
					>
						<Avatar user={$currentUser} size="sm" />
						<span class="truncate">View Profile</span>
					</button>

					<div class="my-2 border-t border-border"></div>

					<p class="px-3 pb-1 text-xs text-text-muted">Accounts</p>
					<div class="max-h-48 overflow-y-auto space-y-1">
						{#if $activeInstanceSavedAccounts.length === 0}
							<p class="px-3 py-2 text-xs text-text-muted">No saved accounts</p>
						{:else}
							{#each $activeInstanceSavedAccounts as account (account.userId)}
								<button
									onclick={() => handleSwitchAccount(account.userId)}
									class="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left hover:bg-surface-hover disabled:opacity-60"
									disabled={account.userId === $currentUser?.id || switchingUserId !== null}
									role="menuitem"
								>
									<Avatar user={makeMenuAvatarUser(account)} size="sm" />
									<div class="min-w-0 flex-1">
										<p class="text-sm text-text-primary truncate">{account.displayName}</p>
										<p class="text-xs text-text-muted truncate">@{account.username}</p>
									</div>
									{#if account.userId === $currentUser?.id}
										<span class="text-[10px] px-2 py-0.5 rounded bg-primary/20 text-primary">Current</span>
									{:else if switchingUserId === account.userId}
										<span class="text-[10px] text-text-muted">Switching...</span>
									{/if}
								</button>
							{/each}
						{/if}
					</div>

					<div class="my-2 border-t border-border"></div>

					<button
						onclick={handleAddAccount}
						class="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-sm text-text-primary hover:bg-surface-hover"
						role="menuitem"
					>
						<UserPlus size={16} />
						<span>Add Account</span>
					</button>
					<button
						onclick={handleLogout}
						class="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-sm text-error hover:bg-surface-hover"
						disabled={isLoggingOut}
						role="menuitem"
					>
						<LogOut size={16} />
						<span>{isLoggingOut ? 'Logging out...' : 'Log Out'}</span>
					</button>
			</div>
		</div>
	</div>

	{#if contextMenu}
		<div
			class="fixed z-70 min-w-44 rounded-lg border border-border bg-surface p-1 shadow-xl"
			style="left: {contextMenu.x}px; top: {contextMenu.y}px"
		>
			<button
				onclick={() => handleCopyServerId(contextMenu!.serverId)}
				class="w-full rounded px-3 py-2 text-left text-sm text-text-primary hover:bg-surface-hover"
			>
				Copy Server ID
			</button>
		</div>
	{/if}
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
