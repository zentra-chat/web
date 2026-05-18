<script lang="ts">
	import { getPluginIframe, stagePluginIframe } from '$lib/pluginSandbox';
	import { Spinner } from '$lib/components/ui';

	let { pluginId }: { pluginId: string } = $props();

	let loaded = $state(false);

	function mountIframe(node: HTMLDivElement) {
		const iframe = getPluginIframe(pluginId);
		if (!iframe) return;
		node.appendChild(iframe);
		loaded = true;

		return {
			destroy() {
				stagePluginIframe(pluginId);
			}
		};
	}
</script>

<div use:mountIframe class="flex-1 flex flex-col min-h-0 w-full h-full relative">
	{#if !loaded}
		<div class="flex-1 flex items-center justify-center">
			<Spinner size="lg" />
		</div>
	{/if}
</div>
