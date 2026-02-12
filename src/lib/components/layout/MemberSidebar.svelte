<script lang="ts">
	import { onMount } from 'svelte';
	import { Avatar } from '$lib/components/ui';
	import { Crown, Search, PanelRight } from '$lib/components/icons';
	import {
		activeCommunity,
		activeCommunityMembers,
		setMembers,
		getMemberNameColor
	} from '$lib/stores/community';
	import { userPresence, toggleMemberSidebar, openProfileCard } from '$lib/stores/ui';
	import { api } from '$lib/api';
	import type { CommunityMember, UserStatus } from '$lib/types';

	let searchQuery = $state('');
	let isLoading = $state(false);

	// Group members by status
	let groupedMembers = $derived.by(() => {
		const online: CommunityMember[] = [];
		const offline: CommunityMember[] = [];

		let filtered = $activeCommunityMembers;
		if (searchQuery) {
			const q = searchQuery.toLowerCase();
			filtered = filtered.filter(
				(m) =>
					m.user?.username.toLowerCase().includes(q) ||
					m.user?.displayName?.toLowerCase().includes(q) ||
					m.nickname?.toLowerCase().includes(q)
			);
		}

		for (const member of filtered) {
			const presence = $userPresence[member.userId];
			const status = presence?.status || member.user?.status || 'offline';

			if (status === 'offline' || status === 'invisible') {
				offline.push(member);
			} else {
				online.push(member);
			}
		}

		return { online, offline };
	});

	onMount(async () => {
		if (!$activeCommunity) return;

		isLoading = true;
		try {
			const members = await api.getCommunityMembers($activeCommunity.id);
			setMembers($activeCommunity.id, members);
		} catch (err) {
			console.error('Failed to load members:', err);
		} finally {
			isLoading = false;
		}
	});

	function getDisplayName(member: CommunityMember): string {
		return member.nickname || member.user?.displayName || member.user?.username || 'Unknown';
	}

	function getMemberStatus(member: CommunityMember): UserStatus {
		return $userPresence[member.userId]?.status || member.user?.status || 'offline';
	}

	function getNameStyle(member: CommunityMember): string | undefined {
		const color = getMemberNameColor(member);
		return color ? `color: ${color}` : undefined;
	}
</script>

<aside class="w-60 bg-surface-hover hidden lg:flex flex-col border-l border-border">
	<!-- Header -->
	<div class="h-12 px-4 flex items-center justify-between border-b border-border">
		<h3 class="font-semibold text-text-secondary text-sm">Members</h3>
		<button
			onclick={toggleMemberSidebar}
			class="p-1 text-text-muted hover:text-text-primary transition-colors"
			aria-label="Hide members"
		>
			<PanelRight size={18} />
		</button>
	</div>

	<!-- Search -->
	<div class="p-2">
		<div class="relative">
			<Search size={16} class="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
			<input
				type="text"
				bind:value={searchQuery}
				placeholder="Search members"
				class="w-full pl-9 pr-3 py-1.5 bg-background border border-border rounded text-sm text-text-primary placeholder-text-muted focus:outline-none focus:ring-1 focus:ring-primary"
			/>
		</div>
	</div>

	<!-- Members list -->
	<div class="flex-1 overflow-y-auto px-2 pb-2">
		{#if isLoading}
			<div class="space-y-2">
				{#each Array(5) as _}
					<div class="flex items-center gap-2 p-1">
						<div class="w-8 h-8 rounded-full bg-surface animate-pulse"></div>
						<div class="h-4 w-24 bg-surface rounded animate-pulse"></div>
					</div>
				{/each}
			</div>
		{:else}
			<!-- Online members -->
			{#if groupedMembers.online.length > 0}
				<div class="mb-4">
					<h4 class="text-xs font-semibold text-text-muted uppercase tracking-wider px-1 mb-2">
						Online - {groupedMembers.online.length}
					</h4>
					{#each groupedMembers.online as member (member.userId)}
						<button
							class="w-full flex items-center gap-2 p-1.5 rounded hover:bg-surface transition-colors group"
							onclick={(e) => member.user && openProfileCard(member.user, e)}
						>
							<Avatar
								user={member.user}
								size="sm"
								status={getMemberStatus(member)}
							/>
							<div class="flex-1 min-w-0 text-left">
								<p class="text-sm text-text-primary truncate flex items-center gap-1" style={getNameStyle(member)}>
									{getDisplayName(member)}
									{#if member.userId === $activeCommunity?.ownerId}
										<Crown size={12} class="text-warning shrink-0" />
									{/if}
								</p>
								{#if member.user?.customStatus}
									<p class="text-xs text-text-muted truncate">{member.user.customStatus}</p>
								{/if}
							</div>
						</button>
					{/each}
				</div>
			{/if}

			<!-- Offline members -->
			{#if groupedMembers.offline.length > 0}
				<div>
					<h4 class="text-xs font-semibold text-text-muted uppercase tracking-wider px-1 mb-2">
						Offline - {groupedMembers.offline.length}
					</h4>
					{#each groupedMembers.offline as member (member.userId)}
						<button
							class="w-full flex items-center gap-2 p-1.5 rounded hover:bg-surface transition-colors group opacity-60"
							onclick={(e) => member.user && openProfileCard(member.user, e)}
						>
							<Avatar
								user={member.user}
								size="sm"
								status="offline"
							/>
							<div class="flex-1 min-w-0 text-left">
								<p class="text-sm text-text-primary truncate flex items-center gap-1" style={getNameStyle(member)}>
									{getDisplayName(member)}
									{#if member.userId === $activeCommunity?.ownerId}
										<Crown size={12} class="text-warning shrink-0" />
									{/if}
								</p>
							</div>
						</button>
					{/each}
				</div>
			{/if}

			{#if groupedMembers.online.length === 0 && groupedMembers.offline.length === 0}
				<p class="text-center text-text-muted text-sm py-4">
					{searchQuery ? 'No members found' : 'No members'}
				</p>
			{/if}
		{/if}
	</div>
</aside>
