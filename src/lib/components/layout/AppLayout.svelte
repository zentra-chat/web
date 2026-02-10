<script lang="ts">
	import type { Snippet } from 'svelte';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import {
		isLoggedIn,
		activeInstance,
		updateCurrentUser
	} from '$lib/stores/instance';
	import { api, websocket } from '$lib/api';
	import { ToastContainer } from '$lib/components/ui';
	import CommunitySidebar from './CommunitySidebar.svelte';
	import ChannelSidebar from './ChannelSidebar.svelte';
	import MemberSidebar from './MemberSidebar.svelte';
	import { activeCommunityId, activeChannelId } from '$lib/stores/community';
	import { showMemberSidebar, isMobileMenuOpen, closeMobileMenu, applyUserSettings } from '$lib/stores/ui';
	import InstanceSelector from '../instance/InstanceSelector.svelte';

	let { children }: { children: Snippet } = $props();

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
	{#if $activeCommunityId}
		<ChannelSidebar />
	{/if}

	<!-- Main content -->
	<main class="flex-1 flex flex-col min-w-0">
		{@render children()}
	</main>

	<!-- Member sidebar -->
	{#if $activeChannelId && $showMemberSidebar}
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
