<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { ToastContainer } from '$lib/components/ui';
	import { InstanceModal } from '$lib/components/instance';
	import {
		CreateCommunityModal,
		DiscoverCommunitiesModal,
		CreateChannelModal,
		SettingsModal,
		CommunitySettingsModal
	} from '$lib/components/modals';
	import { instanceModalOpen } from '$lib/stores/ui';
	import {
		currentInstance,
		instances,
		isAuthenticated,
		loadInstances
	} from '$lib/stores/instance';

	let { children } = $props();

	let isLoading = $state(true);

	onMount(() => {
		loadInstances();
		isLoading = false;

		// Redirect to login if not authenticated
		if (!$isAuthenticated && !$currentInstance) {
			goto('/');
		}
	});

	// Watch for authentication changes
	$effect(() => {
		if (!isLoading && !$isAuthenticated) {
			goto('/');
		}
	});
</script>

{#if isLoading}
	<div class="h-screen w-screen bg-background flex items-center justify-center">
		<div class="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
	</div>
{:else}
	{@render children()}
{/if}

<!-- Global modals -->
<InstanceModal isOpen={$instanceModalOpen} onclose={() => instanceModalOpen.set(false)} />
<CreateCommunityModal />
<DiscoverCommunitiesModal />
<CreateChannelModal />
<SettingsModal />
<CommunitySettingsModal />
<ToastContainer />
