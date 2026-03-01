<script lang="ts">
	import { activeChannel } from '$lib/stores/community';
	import { channelRegistryEpoch, getChannelTypeRegistration } from '$lib/channelTypes';
	import { devTextChannelOverrides, userSettings } from '$lib/stores/ui';
	import { Spinner } from '$lib/components/ui';
	import type { Component } from 'svelte';

	const TEXT_VIEW_DISABLED_TYPES = new Set(['text', 'voice']);

	// Resolve the right view component for whatever channel type is active.
	// Uses dynamic imports so we only load the component code we actually need.
	let viewComponent = $state<Component | null>(null);
	let viewElementTag = $state<string | null>(null);
	let loadingType = $state<string | null>(null);
	let loadError = $state(false);
	let developerModeEnabled = $derived(Boolean($userSettings?.settings?.developerMode));

	$effect(() => {
		$channelRegistryEpoch;

		const channelType = $activeChannel?.type;
		const channelId = $activeChannel?.id;
		if (!channelType || !channelId) {
			viewComponent = null;
			return;
		}

		const canForceTextView = developerModeEnabled && !TEXT_VIEW_DISABLED_TYPES.has(channelType);
		const forcedTextView = canForceTextView && Boolean($devTextChannelOverrides[channelId]);
		const renderType = forcedTextView ? 'text' : channelType;

		// Don't re-import if we're already showing this type
		if (loadingType === renderType && (viewComponent || viewElementTag)) return;

		loadingType = renderType;
		loadError = false;
		viewComponent = null;
		viewElementTag = null;

		const reg = getChannelTypeRegistration(renderType);

		if (reg.viewElement) {
			const tagName = reg.viewElement.tagName;
			reg.viewElement.module()
				.then(() => {
					if (!customElements.get(tagName)) {
						throw new Error(`Custom element \"${tagName}\" was not defined by plugin module`);
					}
					if (loadingType === renderType) {
						viewElementTag = tagName;
					}
				})
				.catch((err) => {
					console.error(`Failed to load custom element view for channel type "${renderType}":`, err);
					if (loadingType === renderType) {
						loadError = true;
					}
				});
			return;
		}

		if (!reg.viewComponent) {
			console.error(`Channel type "${renderType}" does not have a valid view renderer`);
			loadError = true;
			return;
		}

		reg.viewComponent()
			.then((mod) => {
				if (loadingType === renderType) {
					viewComponent = mod.default;
				}
			})
			.catch((err) => {
				console.error(`Failed to load view for channel type "${renderType}":`, err);
				if (loadingType === renderType) {
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
{:else if viewElementTag}
	{#key `${$activeChannel?.id || ''}:${viewElementTag}`}
		<svelte:element this={viewElementTag} class="flex-1 flex flex-col min-h-0" />
	{/key}
{:else if viewComponent}
	{@const ActiveView = viewComponent}
	<ActiveView />
{:else}
	<div class="flex-1 flex items-center justify-center">
		<Spinner size="lg" />
	</div>
{/if}
