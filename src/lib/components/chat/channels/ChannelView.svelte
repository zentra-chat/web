<script lang="ts">
	import { activeChannel } from '$lib/stores/community';
	import { getChannelTypeRegistration } from '$lib/channelTypes';
	import { Spinner } from '$lib/components/ui';
	import type { Component } from 'svelte';

	// Resolve the right view component for whatever channel type is active.
	// Uses dynamic imports so we only load the component code we actually need.
	let viewComponent = $state<Component | null>(null);
	let loadingType = $state<string | null>(null);
	let loadError = $state(false);

	$effect(() => {
		const channelType = $activeChannel?.type;
		if (!channelType) {
			viewComponent = null;
			return;
		}

		// Don't re-import if we're already showing this type
		if (loadingType === channelType && viewComponent) return;

		loadingType = channelType;
		loadError = false;
		viewComponent = null;

		const reg = getChannelTypeRegistration(channelType);
		reg.viewComponent()
			.then((mod) => {
				// Only apply if the channel type hasn't changed while we were loading
				if (loadingType === channelType) {
					viewComponent = mod.default;
				}
			})
			.catch((err) => {
				console.error(`Failed to load view for channel type "${channelType}":`, err);
				if (loadingType === channelType) {
					loadError = true;
				}
			});
	});
</script>

{#if !$activeChannel}
	<!-- Nothing selected - shouldn't really get here -->
{:else if loadError}
	<div class="flex-1 flex flex-col items-center justify-center text-center p-8">
		<p class="text-text-muted">Failed to load the view for this channel type.</p>
		<p class="text-xs text-text-muted mt-1">Type: {$activeChannel.type}</p>
	</div>
{:else if viewComponent}
	<svelte:component this={viewComponent} />
{:else}
	<div class="flex-1 flex items-center justify-center">
		<Spinner size="lg" />
	</div>
{/if}
