<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		text: string;
		position?: 'top' | 'bottom' | 'left' | 'right';
		children: Snippet;
	}

	let { text, position = 'top', children }: Props = $props();
	let wrapper: HTMLDivElement | null = $state(null);
	let isVisible = $state(false);
	let tooltipStyle = $state('');

	function updatePosition() {
		if (!wrapper) return;
		const rect = wrapper.getBoundingClientRect();
		const gap = 8;
		let left = 0;
		let top = 0;
		let transform = '';

		switch (position) {
			case 'left':
				left = rect.left - gap;
				top = rect.top + rect.height / 2;
				transform = 'translate(-100%, -50%)';
				break;
			case 'right':
				left = rect.right + gap;
				top = rect.top + rect.height / 2;
				transform = 'translate(0, -50%)';
				break;
			case 'bottom':
				left = rect.left + rect.width / 2;
				top = rect.bottom + gap;
				transform = 'translate(-50%, 0)';
				break;
			case 'top':
			default:
				left = rect.left + rect.width / 2;
				top = rect.top - gap;
				transform = 'translate(-50%, -100%)';
		}

		tooltipStyle = `left: ${left}px; top: ${top}px; transform: ${transform};`;
	}

	function handleShow() {
		updatePosition();
		isVisible = true;
	}

	function handleHide() {
		isVisible = false;
	}

	function handleWindowChange() {
		if (isVisible) updatePosition();
	}
</script>

<svelte:window on:scroll={handleWindowChange} on:resize={handleWindowChange} />

<div
	bind:this={wrapper}
	class="group relative inline-flex"
	role="presentation"
	onmouseenter={handleShow}
	onmouseleave={handleHide}
	onfocusin={handleShow}
	onfocusout={handleHide}
>
	{@render children()}
	<div
		class="fixed px-2 py-1 text-sm font-medium text-text-primary bg-surface border border-border rounded shadow-lg transition-opacity duration-200 pointer-events-none whitespace-nowrap z-9999 {isVisible ? 'opacity-100' : 'opacity-0'}"
		style={tooltipStyle}
		aria-hidden={!isVisible}
		role="tooltip"
	>
		{text}
	</div>
</div>
