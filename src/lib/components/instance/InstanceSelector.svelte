<script lang="ts">
	import {
		activeInstance,
		instances,
		setActiveInstance,
		reorderInstances
	} from '$lib/stores/instance';
	import { websocket } from '$lib/api';
	import { resolve } from '$app/paths';
    import { instanceSelectorMode } from '$lib/stores/ui';

	let isHovered = $state(false);

    let isAutoHide = $derived($instanceSelectorMode === 'auto');
    let isDisabled = $derived($instanceSelectorMode === 'disabled');

	let draggedInstanceId = $state<string | null>(null);
	let dragOverPosition = $state<{ instanceId: string; position: 'above' | 'below' } | null>(null);
	let isReorderingInstances = $state(false);

	// Handle instance switching
	function handleInstanceClick(instanceId: string) {
		if (isReorderingInstances) return;
		if (instanceId !== $activeInstance?.id) {
			websocket.disconnect();
			setActiveInstance(instanceId);
			// Reconnect will happen automatically due to reactive auth
			setTimeout(() => websocket.connect(), 100);
		}
	}

	function handleInstanceDragStart(event: DragEvent, instanceId: string) {
		if (isReorderingInstances) return;
		draggedInstanceId = instanceId;
		if (event.dataTransfer) {
			event.dataTransfer.effectAllowed = 'move';
			event.dataTransfer.setData('text/plain', instanceId);
		}
	}

	function handleInstanceDragOver(event: DragEvent, instanceId: string) {
		if (!draggedInstanceId || draggedInstanceId === instanceId) return;
		event.preventDefault();

		const element = event.currentTarget as HTMLElement;
		const rect = element.getBoundingClientRect();
		const midY = rect.top + rect.height / 2;
		const position = event.clientY < midY ? 'above' : 'below';
		dragOverPosition = { instanceId, position };
	}

	function handleInstanceDragLeave() {
		dragOverPosition = null;
	}

	function handleInstanceDrop(event: DragEvent, targetInstanceId: string) {
		event.preventDefault();
		const sourceInstanceId = draggedInstanceId;
		const sourcePosition = dragOverPosition?.position || 'below';
		draggedInstanceId = null;
		dragOverPosition = null;

		if (!sourceInstanceId || sourceInstanceId === targetInstanceId) return;

		const orderedIds = $instances.map((i) => i.id);
		let sourceIndex = orderedIds.indexOf(sourceInstanceId);
		let targetIndex = orderedIds.indexOf(targetInstanceId);
		if (sourceIndex < 0 || targetIndex < 0) return;

		orderedIds.splice(sourceIndex, 1);
		targetIndex = orderedIds.indexOf(targetInstanceId);
		if (sourcePosition === 'above') {
			orderedIds.splice(targetIndex, 0, sourceInstanceId);
		} else {
			orderedIds.splice(targetIndex + 1, 0, sourceInstanceId);
		}

		isReorderingInstances = true;
		reorderInstances(orderedIds);
		setTimeout(() => {
			isReorderingInstances = false;
		}, 500);
	}

	function handleInstanceDragEnd() {
		draggedInstanceId = null;
		dragOverPosition = null;
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
            {@const isDragOver = dragOverPosition?.instanceId === instance.id}
            <div
                draggable={!isReorderingInstances}
                ondragstart={(event) => handleInstanceDragStart(event, instance.id)}
                ondragover={(event) => handleInstanceDragOver(event, instance.id)}
                ondragleave={handleInstanceDragLeave}
                ondrop={(event) => handleInstanceDrop(event, instance.id)}
                ondragend={handleInstanceDragEnd}
                class="relative
                {isDragOver && dragOverPosition?.position === 'above' ? 'before:absolute before:left-0 before:right-0 before:-top-px before:h-0.5 before:bg-primary before:content-[\'\']' : ''}
                {isDragOver && dragOverPosition?.position === 'below' ? 'after:absolute after:left-0 after:right-0 after:-bottom-px after:h-0.5 after:bg-primary after:content-[\'\']' : ''}"
            >
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
            </div>
        {/each}

        <a
            href={resolve('/')}
            class="w-12 h-12 rounded-2xl border-2 border-dashed border-border hover:border-primary text-text-muted hover:text-primary transition-all duration-200 flex items-center justify-center text-2xl"
            title="Add Instance"
        >
            +
        </a>
    </div>
{/if}