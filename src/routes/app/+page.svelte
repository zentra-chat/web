<script lang="ts">
	import { onMount } from 'svelte';
	import { AppLayout } from '$lib/components/layout';
	import { MessageList, MessageInput } from '$lib/components/chat';
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
		setChannels,
		setActiveChannel
	} from '$lib/stores/community';
	import { activeInstance } from '$lib/stores/instance';
	import { api } from '$lib/api';

	let isLoadingCommunities = $state(true);
	let isLoadingChannels = $state(false);
	let loadingCommunitiesForInstanceId = $state<string | null>(null);
	let communityRetryAfterByInstance = $state<Record<string, number>>({});

	onMount(() => {
		isLoadingCommunities = false;
	});

	$effect(() => {
		const instance = $activeInstance;
		if (!instance) return;

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
				communityRetryAfterByInstance = {
					...communityRetryAfterByInstance,
					[instance.id]: 0
				};
			})
			.catch((err) => {
				console.error('Failed to load communities:', err);
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

	// Load channels when community changes
	$effect(() => {
		if ($activeCommunity) {
			loadChannels($activeCommunity.id);
		} else {
			setActiveChannel(null);
		}
	});

	async function loadChannels(communityId: string) {
		isLoadingChannels = true;

		try {
			const channels = (await api.getChannels(communityId)) || [];
			setChannels(communityId, channels);

			// Select first channel if available
			if (channels.length > 0 && !$activeChannel) {
				const textChannels = channels.filter((c) => c.type === 'text');
				if (textChannels.length > 0) {
					setActiveChannel(textChannels[0]);
				}
			}
		} catch (err) {
			console.error('Failed to load channels:', err);
		} finally {
			isLoadingChannels = false;
		}
	}
</script>

<AppLayout>
	{#if isLoadingCommunities || isLoadingChannels}
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
		<div class="flex-1 flex flex-col min-h-0">
			<MessageList channelId={$activeChannel.id} />
			<MessageInput channelId={$activeChannel.id} />
		</div>
	{/if}
</AppLayout>
