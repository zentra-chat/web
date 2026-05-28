<script lang="ts">
	import { onMount } from 'svelte';
	import type { Component } from 'svelte';
	import { getSDK } from '@zentra/plugin-sdk/runtime';

	const sdk = getSDK();
	let VoiceComponent: Component | null = null;

	onMount(() => {
		sdk.components.VoiceChannelView?.().then((mod) => {
			VoiceComponent = mod.default;
		});

		return () => {
			VoiceComponent = null;
		};
	});
</script>

{#if VoiceComponent}
	{@const VoiceView = VoiceComponent}
	<VoiceView />
{:else}
	<div class="flex-1 flex items-center justify-center text-sm text-text-muted">
		Voice channel view is not available in this client build.
	</div>
{/if}
