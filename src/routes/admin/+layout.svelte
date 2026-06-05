<script lang="ts">
	import { get } from 'svelte/store';
	import { AlertTriangle, X } from 'lucide-svelte';
	import AdminSidebar from '$lib/components/admin/AdminSidebar.svelte';
	import { activeAuth, activeInstance, loadInstances } from '$lib/stores/instance';
	import { maintenanceMode } from '$lib/stores/ui';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';

	let { children }: { children: import('svelte').Snippet } = $props();

	let dismissed = $state(false);

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
			{#if $maintenanceMode.active && !dismissed}
				<div class="bg-warning/10 border-b border-warning/30 px-6 py-3">
					<div class="flex items-center justify-between max-w-[1600px] mx-auto">
						<div class="flex items-center gap-3">
							<AlertTriangle size={18} class="text-warning shrink-0" />
							<div>
								<p class="text-sm font-medium text-text-primary">Maintenance Mode Active</p>
								<p class="text-xs text-text-muted">
									{$maintenanceMode.message || 'The server is in maintenance mode. Non-admin users cannot access the server.'}
								</p>
							</div>
						</div>
						<button
							onclick={() => { dismissed = true; }}
							aria-label="Dismiss maintenance banner"
							class="p-1 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-hover transition-colors"
						>
							<X size={16} />
						</button>
					</div>
				</div>
			{/if}
			{@render children()}
		</main>
	</div>
{:else}
	<div class="flex items-center justify-center h-screen text-text-muted bg-background">
		Loading...
	</div>
{/if}
