<script lang="ts">
	import { onMount } from 'svelte';
	import ChannelView from '$lib/components/chat/channels/ChannelView.svelte';
	import DMHome from '$lib/components/dm/DMHome.svelte';
	import { Spinner } from '$lib/components/ui';
	import { Hash } from 'lucide-svelte';
	import {
		activeCommunity,
		activeCommunityId,
		activeChannel,
		communitiesCache,
		setCommunities,
		setActiveCommunity,
		setActiveChannel
	} from '$lib/stores/community';
	import { activeInstance } from '$lib/stores/instance';
	import { api } from '$lib/api';
	import { loadCustomEmojis } from '$lib/stores/emoji';
	import { mergeServerDefinitions } from '$lib/channelTypes';
	import { loadCommunityPluginFrontends, resetPluginRuntimeCache } from '$lib/pluginRuntime';

	let isLoadingCommunities = $state(true);
	let loadingCommunitiesForInstanceId = $state<string | null>(null);
	let communityRetryAfterByInstance = $state<Record<string, number>>({});
	let communitiesLoadedByInstance = $state<Record<string, boolean>>({});

	onMount(() => {
		isLoadingCommunities = false;
	});

	$effect(() => {
		const instance = $activeInstance;
		if (!instance) return;

		resetPluginRuntimeCache();

		if (communitiesLoadedByInstance[instance.id]) {
			isLoadingCommunities = false;
			return;
		}

		const cachedCommunities = $communitiesCache[instance.id] || [];
		if (cachedCommunities.length > 0) {
			isLoadingCommunities = false;
			return;
		}

		if (loadingCommunitiesForInstanceId === instance.id) {
			return;
		}

		const retryAfter = communityRetryAfterByInstance[instance.id] || 0;
		if (Date.now() < retryAfter) {
			isLoadingCommunities = false;
			return;
		}

		isLoadingCommunities = true;
		loadingCommunitiesForInstanceId = instance.id;
		api.getCommunities()
			.then((communities) => {
				const list = communities || [];
				setCommunities(list);
				communitiesLoadedByInstance = {
					...communitiesLoadedByInstance,
					[instance.id]: true
				};
				communityRetryAfterByInstance = {
					...communityRetryAfterByInstance,
					[instance.id]: 0
				};
				// Load custom emojis once communities are fetched
				loadCustomEmojis();

				// Fetch channel type definitions and merge with the frontend registry.
				// This picks up any plugin-registered types that only exist server-side.
				api.getChannelTypes()
					.then((defs) => mergeServerDefinitions(defs))
					.catch((err) => console.warn('Could not load channel type definitions:', err));
			})
			.catch((err) => {
				console.error('Failed to load communities:', err);
				communitiesLoadedByInstance = {
					...communitiesLoadedByInstance,
					[instance.id]: false
				};
				communityRetryAfterByInstance = {
					...communityRetryAfterByInstance,
					[instance.id]: Date.now() + 5000
				};
			})
			.finally(() => {
				loadingCommunitiesForInstanceId = null;
				isLoadingCommunities = false;
			});
	});

	$effect(() => {
		const instance = $activeInstance;
		if (!instance) return;

		const cachedCommunities = $communitiesCache[instance.id] || [];
		if (cachedCommunities.length === 0) {
			if ($activeCommunityId !== null) {
				setActiveCommunity(null);
			}
			return;
		}

		if ($activeCommunityId === undefined || ($activeCommunityId !== null && !$activeCommunity)) {
			setActiveCommunity(cachedCommunities[0] || null);
		}
	});

	// Load plugin frontends when community changes.
	// Channel/sidebar data is handled by ChannelSidebar internal.
	$effect(() => {
		if ($activeCommunity) {
			loadCommunityPluginFrontends($activeCommunity.id).catch((err) => {
				console.warn('Could not load plugin frontend bundles:', err);
			});
		} else {
			setActiveChannel(null);
		}
	});
</script>

{#if isLoadingCommunities}
	<div class="flex-1 flex items-center justify-center">
		<Spinner size="lg" />
	</div>
{:else if !$activeCommunity}
	<DMHome />
{:else if !$activeChannel}
	<div class="flex-1 flex flex-col items-center justify-center text-center p-8">
		<div class="w-20 h-20 rounded-full bg-surface flex items-center justify-center mb-4">
			<Hash size={40} class="text-text-muted" />
		</div>
		<h2 class="text-xl font-semibold text-text-primary mb-2">No channel selected</h2>
		<p class="text-text-muted max-w-md">
			Select a channel from the sidebar or create a new one to start chatting.
		</p>
	</div>
{:else}
	<ChannelView />
{/if}
