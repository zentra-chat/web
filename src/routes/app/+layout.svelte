<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { ToastContainer, NotificationPreviewContainer } from '$lib/components/ui';
	import { InstanceModal } from '$lib/components/instance';
	import {
		CreateCommunityModal,
		DiscoverCommunitiesModal,
		CreateChannelModal,
		SettingsModal,
		CommunitySettingsModal,
		FilePreviewModal
	} from '$lib/components/modals';
	import { ProfileCard } from '$lib/components/user';
	import { instanceModalOpen } from '$lib/stores/ui';
	import {
		currentInstance,
		instances,
		isAuthenticated,
		loadInstances,
		activeAuth
	} from '$lib/stores/instance';
	import { websocket } from '$lib/api';
	import { requestNotificationPermission } from '$lib/utils/nativeNotification';

	let { children } = $props();

	let isLoading = $state(true);

	onMount(() => {
		loadInstances();
		isLoading = false;

		// Request OS notification permission (quiet — doesn't throw if denied)
		requestNotificationPermission().catch(() => {});

		// Redirect to login if not authenticated
		if (!$isAuthenticated && !$currentInstance) {
			goto('/');
		}
	});

	// Watch for authentication changes and connect websocket
	$effect(() => {
		if ($isAuthenticated && $activeAuth) {
			websocket.connect();
		} else {
			websocket.disconnect();
		}
	});

	// Watch for authentication changes for redirect
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
<FilePreviewModal />
<ProfileCard />
<ToastContainer />
<NotificationPreviewContainer />
