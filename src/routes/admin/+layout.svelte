<script lang="ts">
	import { get } from 'svelte/store';
	import AdminSidebar from '$lib/components/admin/AdminSidebar.svelte';
	import { activeAuth, activeInstance, loadInstances } from '$lib/stores/instance';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';

	let { children }: { children: import('svelte').Snippet } = $props();

	onMount(() => {
		loadInstances();
		if (!get(activeAuth) || !get(activeInstance)) {
			goto('/login');
		}
	});
</script>

{#if $activeAuth && $activeInstance}
	<div class="flex h-screen w-full bg-background">
		<AdminSidebar />
		<main class="flex-1 overflow-y-auto">
			{@render children()}
		</main>
	</div>
{:else}
	<div class="flex items-center justify-center h-screen text-text-muted bg-background">
		Loading...
	</div>
{/if}
