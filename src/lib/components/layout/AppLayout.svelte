<script lang="ts">
	import type { Snippet } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import {
		isLoggedIn,
		activeInstance,
		updateCurrentUser
	} from '$lib/stores/instance';
	import { api, websocket } from '$lib/api';
	import { ToastContainer, Button, Textarea, Spinner } from '$lib/components/ui';
	import CommunitySidebar from './CommunitySidebar.svelte';
	import ChannelSidebar from './ChannelSidebar.svelte';
	import MemberSidebar from './MemberSidebar.svelte';
	import UserContextMenu from '$lib/components/user/UserContextMenu.svelte';
	import { activeCommunityId, activeCommunity, activeChannelId, setMembers } from '$lib/stores/community';
	import {
		showMemberSidebar,
		isMobileMenuOpen,
		closeMobileMenu,
		applyUserSettings,
		contextMenuOpen,
		contextMenuUser,
		contextMenuPosition,
		closeContextMenu,
		banModalOpen,
		banModalTargetId,
		closeBanModal,
		addToast
	} from '$lib/stores/ui';
	import InstanceSelector from '../instance/InstanceSelector.svelte';

	let { children }: { children: Snippet } = $props();
	let isPaneRoute = $derived(
		$page.url.pathname.startsWith('/app/discover') ||
		$page.url.pathname.startsWith('/app/settings') ||
		$page.url.pathname.startsWith('/app/community-settings')
	);

	let banReason = $state('');
	let isBanning = $state(false);

	async function confirmBan() {
		if (!$activeCommunity || !$banModalTargetId || isBanning) return;
		isBanning = true;
		try {
			await api.banMember($activeCommunity.id, $banModalTargetId, banReason.trim() || undefined);
			addToast({ type: 'success', message: 'Member banned' });
			closeBanModal();
			banReason = '';
			// Refresh members list
			const members = await api.getCommunityMembers($activeCommunity.id);
			setMembers($activeCommunity.id, members);
		} catch (err: any) {
			addToast({ type: 'error', message: err?.error || err?.message || 'Failed to ban member' });
		} finally {
			isBanning = false;
		}
	}

	function handleCloseBanModal() {
		closeBanModal();
		banReason = '';
	}

	onMount(() => {
		// Redirect if not logged in
		if (!$isLoggedIn || !$activeInstance) {
			goto('/login');
			return;
		}

		api.getCurrentUser()
			.then((user) => updateCurrentUser(user))
			.catch((err) => console.error('Failed to refresh user:', err));

		api.getUserSettings()
			.then((settings) => applyUserSettings(settings))
			.catch((err) => console.error('Failed to load user settings:', err));

		// Connect to WebSocket
		websocket.connect();

		return () => {
			websocket.disconnect();
		};
	});

</script>

<div class="h-screen flex bg-background overflow-hidden">
	<!-- Instance selector (leftmost bar) -->
	<InstanceSelector />

	<!-- Community sidebar -->
	<CommunitySidebar />

	<!-- Channel sidebar -->
	{#if $activeCommunityId && !isPaneRoute}
		<ChannelSidebar />
	{/if}

	<!-- Main content -->
	<main class="flex-1 flex flex-col min-w-0">
		{@render children()}
	</main>

	<!-- Member sidebar -->
	{#if $activeChannelId && $showMemberSidebar && !isPaneRoute}
		<MemberSidebar />
	{/if}
</div>

<!-- Mobile overlay -->
{#if $isMobileMenuOpen}
	<button
		class="fixed inset-0 bg-black/50 z-40 md:hidden"
		onclick={closeMobileMenu}
		aria-label="Close menu"
	></button>
{/if}

<ToastContainer />

<!-- User context menu (right-click) -->
{#if $contextMenuOpen && $contextMenuUser}
	<UserContextMenu
		user={$contextMenuUser}
		x={$contextMenuPosition.x}
		y={$contextMenuPosition.y}
		onclose={closeContextMenu}
		onban={(userId) => {
			closeContextMenu();
			banModalTargetId.set(userId);
			banModalOpen.set(true);
		}}
	/>
{/if}

<!-- Ban confirmation modal -->
{#if $banModalOpen}
	<div class="fixed inset-0 bg-black/60 flex items-center justify-center z-[200]" role="dialog">
		<div class="bg-surface rounded-xl p-6 w-full max-w-md shadow-xl border border-border">
			<h3 class="text-lg font-semibold text-text-primary mb-2">Ban Member</h3>
			<p class="text-sm text-text-muted mb-4">This will remove the user from the community and prevent them from rejoining.</p>

			<div class="mb-4">
				<label for="global-ban-reason" class="block text-sm text-text-muted mb-1">Reason (optional)</label>
				<Textarea
					id="global-ban-reason"
					bind:value={banReason}
					placeholder="Why is this user being banned?"
					rows={3}
					maxlength={512}
				/>
			</div>

			<div class="flex justify-end gap-2">
				<Button variant="ghost" onclick={handleCloseBanModal}>Cancel</Button>
				<Button variant="danger" onclick={confirmBan} disabled={isBanning}>
					{#if isBanning}
						<Spinner size="sm" />
						Banning...
					{:else}
						Ban Member
					{/if}
				</Button>
			</div>
		</div>
	</div>
{/if}
