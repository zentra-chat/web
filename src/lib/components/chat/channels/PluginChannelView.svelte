<script lang="ts">
	import { api } from '$lib/api';
	import { activeChannel } from '$lib/stores/community';
	import { getChannelTypeRegistration } from '$lib/channelTypes';
	import { Spinner } from '$lib/components/ui';

	let loading = $state(true);
	let error = $state<string | null>(null);
	let pluginId = $state<string | null>(null);
	let channelTypeName = $state<string>('');

	$effect(() => {
		const channel = $activeChannel;
		if (!channel) return;

		loading = true;
		error = null;

		const reg = getChannelTypeRegistration(channel.type);
		channelTypeName = reg.label;

		// Fetch channel type definition to get the pluginId
		api.getChannelType(channel.type)
			.then((def) => {
				if (def && def.pluginId) {
					pluginId = def.pluginId;
					loading = false;

					// Ping bridge
					const communityId = channel.communityId;
					if (communityId) {
						api.post(`/plugins/actions/${def.pluginId}/${communityId}`, {
							action: 'ping',
							data: {}
						}).catch(() => {
							// Silent - bridge may not be needed for display
						});
					}
				} else {
					pluginId = null;
					loading = false;
				}
			})
			.catch(() => {
				loading = false;
			});
	});

	function sendAction(action: string, data: Record<string, unknown>) {
		const channel = $activeChannel;
		if (!channel || !pluginId || !channel.communityId) return Promise.reject(new Error('Not ready'));
		return api.post(`/plugins/actions/${pluginId}/${channel.communityId}`, {
			action,
			data: {
				...data,
				channelId: channel.id
			}
		});
	}
</script>

<div class="flex-1 flex flex-col min-h-0 w-full h-full" role="region" aria-label="Plugin channel view">
	{#if loading}
		<div class="flex-1 flex items-center justify-center">
			<Spinner size="lg" />
		</div>
	{:else if error}
		<div class="flex-1 flex items-center justify-center text-text-muted text-sm p-8">
			<p>{error}</p>
		</div>
	{:else}
		<div class="flex-1 flex flex-col p-4 gap-4 overflow-y-auto">
			<div class="text-sm text-text-muted">
				<p>Channel type: {channelTypeName}</p>
				{#if pluginId}
					<p>Plugin: {pluginId}</p>
				{/if}
			</div>
		</div>
	{/if}
</div>
