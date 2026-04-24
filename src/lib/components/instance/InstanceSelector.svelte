<script lang="ts">
	import {
		activeInstance,
		instances,
		setActiveInstance
	} from '$lib/stores/instance';
	import { websocket } from '$lib/api';
    import { instanceSelectorMode } from '$lib/stores/ui';

	let isHovered = $state(false);

    let isAutoHide = $derived($instanceSelectorMode === 'auto');
    let isDisabled = $derived($instanceSelectorMode === 'disabled');

	// Handle instance switching
	function handleInstanceClick(instanceId: string) {
		if (instanceId !== $activeInstance?.id) {
			websocket.disconnect();
			setActiveInstance(instanceId);
			// Reconnect will happen automatically due to reactive auth
			setTimeout(() => websocket.connect(), 100);
		}
	}
</script>

{#if isAutoHide}
	<!-- Trigger zone for auto-hide -->
	<div 
		role="presentation"
		class="fixed left-0 top-0 bottom-0 w-2 z-40" 
		onmouseenter={() => isHovered = true}
	></div>
{/if}

{#if !isDisabled}
    <div
        role="complementary"
        onmouseenter={() => isHovered = true}
        onmouseleave={() => isHovered = false}
        class="hidden md:flex flex-col w-18 bg-background-secondary border-r border-border py-3 items-center gap-2 z-30 transition-all duration-300 ease-in-out
        {isAutoHide ? 'fixed left-0 top-0 bottom-0' : 'relative'}
        {isAutoHide && !isHovered ? '-translate-x-full opacity-0 shadow-none' : 'translate-x-0 opacity-100' + (isAutoHide ? ' shadow-xl' : '')}"
    >
        {#each $instances as instance (instance.id)}
            {@const isActive = instance.id === $activeInstance?.id}
            <button
                onclick={() => handleInstanceClick(instance.id)}
                class="relative w-12 h-12 rounded-2xl {isActive
                    ? 'rounded-xl bg-primary text-background'
                    : 'bg-surface hover:bg-surface-hover text-text-secondary hover:text-text-primary'} transition-all duration-200 flex items-center justify-center font-bold text-lg group"
                title={instance.name}
            >
                {#if instance.iconUrl}
                    <img
                        src={instance.iconUrl}
                        alt={instance.name}
                        class="w-full h-full rounded-[inherit] object-cover"
                    />
                {:else}
                    {instance.name.charAt(0).toUpperCase()}
                {/if}
                {#if isActive}
                    <div
                        class="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-5.5 w-4 h-12 rounded-r-full bg-white rounded-full"
                    ></div>
                {:else}
                    <div
                        class="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-3.25 w-1.5 h-2 bg-primary rounded-full opacity-0 group-hover:opacity-100 transition-all duration-200"
                    ></div>
                {/if}
                <span
                    class="absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-background-secondary {instance.isOnline
                        ? 'bg-success'
                        : 'bg-text-muted'}"
                ></span>
            </button>
        {/each}

        <a
            href="/"
            class="w-12 h-12 rounded-2xl border-2 border-dashed border-border hover:border-primary text-text-muted hover:text-primary transition-all duration-200 flex items-center justify-center text-2xl"
            title="Add Instance"
        >
            +
        </a>
    </div>
{/if}