<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { getPluginIframe, stagePluginIframe } from '$lib/pluginSandbox';
	import { Spinner } from '$lib/components/ui';

	let { pluginId }: { pluginId: string } = $props();

	let container: HTMLDivElement;
	let loaded = $state(false);

	onMount(() => {
		const iframe = getPluginIframe(pluginId);
		if (!iframe || !container) return;

		// Move the already-running iframe from the hidden staging area into
		// our visible container
		container.appendChild(iframe);
		loaded = true;
	});

	onDestroy(() => {
		// Move the iframe back to the hidden staging area so its scripts
		// keep running and state is preserved across channel switches
		stagePluginIframe(pluginId);
	});
</script>

<div bind:this={container} class="flex-1 flex flex-col min-h-0 w-full h-full relative">
	{#if !loaded}
		<div class="flex-1 flex items-center justify-center">
			<Spinner size="lg" />
		</div>
	{/if}
</div>
