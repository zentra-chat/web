<script lang="ts">
	import type { Snippet } from 'svelte';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import {
		isLoggedIn,
		activeInstance,
		activeAuth,
		instances,
		setActiveInstance
	} from '$lib/stores/instance';
	import { websocket } from '$lib/api';
	import { ToastContainer } from '$lib/components/ui';
	import CommunitySidebar from './CommunitySidebar.svelte';
	import ChannelSidebar from './ChannelSidebar.svelte';
	import MemberSidebar from './MemberSidebar.svelte';
	import { activeCommunityId, activeChannelId } from '$lib/stores/community';
	import { showMemberSidebar, isMobileMenuOpen, closeMobileMenu } from '$lib/stores/ui';

	let { children }: { children: Snippet } = $props();

	onMount(() => {
		// Redirect if not logged in
		if (!$isLoggedIn || !$activeInstance) {
			goto('/login');
			return;
		}

		// Connect to WebSocket
		websocket.connect();

		return () => {
			websocket.disconnect();
		};
	});

	// Handle instance switching
	function handleInstanceClick(instanceId: string) {
		if (instanceId !== $activeInstance?.id) {
			websocket.disconnect();
			setActiveInstance(instanceId);
			// Reconnect will happen automatically due to reactive auth
			setTimeout(() => websocket.connect(), 100);
		}
	}
</script>

<div class="h-screen flex bg-background overflow-hidden">
	<!-- Instance selector (leftmost bar) -->
	<div
		class="hidden md:flex flex-col w-18 bg-background-secondary border-r border-border py-3 items-center gap-2 z-30"
	>
		{#each $instances as instance (instance.id)}
			{@const isActive = instance.id === $activeInstance?.id}
			<button
				onclick={() => handleInstanceClick(instance.id)}
				class="relative w-12 h-12 rounded-2xl {isActive
					? 'rounded-xl bg-primary text-background'
					: 'bg-surface hover:bg-surface-hover text-text-secondary hover:text-text-primary'} transition-all duration-200 flex items-center justify-center font-bold text-lg group"
				title={instance.name}
			>
				{#if instance.iconUrl}
					<img
						src={instance.iconUrl}
						alt={instance.name}
						class="w-full h-full rounded-[inherit] object-cover"
					/>
				{:else}
					{instance.name.charAt(0).toUpperCase()}
				{/if}
				{#if isActive}
					<div
						class="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1.5 w-1.5 h-8 bg-primary rounded-full"
					></div>
				{:else}
					<div
						class="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1.5 w-1.5 h-2 bg-primary rounded-full opacity-0 group-hover:opacity-100 transition-all duration-200"
					></div>
				{/if}
				<span
					class="absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-background-secondary {instance.isOnline
						? 'bg-success'
						: 'bg-text-muted'}"
				></span>
			</button>
		{/each}

		<a
			href="/"
			class="w-12 h-12 rounded-2xl border-2 border-dashed border-border hover:border-primary text-text-muted hover:text-primary transition-all duration-200 flex items-center justify-center text-2xl"
			title="Add Instance"
		>
			+
		</a>
	</div>

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
