<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { Server, AlertTriangle } from 'lucide-svelte';
	import { ToastContainer, NotificationPreviewContainer } from '$lib/components/ui';
	import { AppLayout } from '$lib/components/layout';
	import { InstanceModal } from '$lib/components/instance';
	import {
		CreateCommunityModal,
		CreateChannelModal,
		FilePreviewModal
	} from '$lib/components/modals';
	import { ProfileCard } from '$lib/components/user';
	import { instanceModalOpen, maintenanceMode } from '$lib/stores/ui';
	import {
		currentInstance,
		isAuthenticated,
		loadInstances,
		activeAuth
	} from '$lib/stores/instance';
	import { websocket } from '$lib/api';
	import { requestNotificationPermission } from '$lib/utils/nativeNotification';
	import { isDesktop } from '$lib/utils/platform';

	let { children } = $props();

	let isLoading = $state(true);

	onMount(() => {
		loadInstances();
		isLoading = false;

		// Request OS notification permission (quiet, doesn't throw if denied)
		requestNotificationPermission().catch(() => {});

		// Redirect to login if not authenticated
		if (!$isAuthenticated && !$currentInstance) {
			goto(resolve('/'));
		}

		// Auto-check for updates on desktop startup
		if (isDesktop()) {
			import('$lib/utils/update').then(({ checkForUpdates }) => {
				checkForUpdates(false);

				// Listen for "Check for Updates" from tray menu
				import('@tauri-apps/api/event').then(({ listen }) => {
					listen('menu-check-update', () => {
						checkForUpdates(true);
					});
				});
			});
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
			goto(resolve('/'));
		}
	});
</script>

{#if isLoading}
	<div class="h-screen w-screen bg-background flex items-center justify-center">
		<div class="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
	</div>
{:else if $maintenanceMode.active}
	<div class="h-screen w-screen bg-background flex items-center justify-center">
		<div class="text-center max-w-md px-6">
			<div class="mx-auto w-16 h-16 rounded-full bg-warning/10 flex items-center justify-center mb-6">
				<AlertTriangle size={32} class="text-warning" />
			</div>
			<h1 class="text-2xl font-bold text-text-primary mb-2">Under Maintenance</h1>
			<p class="text-text-muted mb-8">
				{$maintenanceMode.message || 'This server is currently undergoing maintenance. Please check back shortly.'}
			</p>
			<div class="flex items-center justify-center gap-2 text-sm text-text-muted">
				<Server size={14} />
				<span>Zentra</span>
			</div>
		</div>
	</div>
{:else}
	<AppLayout>
		{@render children()}
	</AppLayout>
{/if}

<!-- Global modals -->
<InstanceModal isOpen={$instanceModalOpen} onclose={() => instanceModalOpen.set(false)} />
<CreateCommunityModal />
<CreateChannelModal />
<FilePreviewModal />
<ProfileCard />
<ToastContainer />
<NotificationPreviewContainer />
