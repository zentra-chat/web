<script lang="ts">
	import type { Snippet } from 'svelte';
	import { X } from '$lib/components/icons';

	interface Props {
		isOpen: boolean;
		title?: string;
		size?: 'sm' | 'md' | 'lg' | 'xl';
		onclose: () => void;
		children: Snippet;
		footer?: Snippet;
	}

	let { isOpen, title = '', size = 'md', onclose, children, footer }: Props = $props();

	const sizeClasses = {
		sm: 'max-w-lg',
		md: 'max-w-4xl',
		lg: 'max-w-5xl',
		xl: 'max-w-6xl'
	};

	function handleBackdropClick(e: MouseEvent) {
		if (e.target === e.currentTarget) {
			onclose();
		}
	}

	function handleBackdropKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' || e.key === ' ') {
			if (e.target === e.currentTarget) {
				onclose();
				e.preventDefault();
			}
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			onclose();
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if isOpen}
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<div
		class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
		onclick={handleBackdropClick}
		onkeydown={handleBackdropKeydown}
		role="presentation"
	>
		<div
			class="w-full {sizeClasses[size]} bg-surface border border-border rounded-xl shadow-2xl animate-in zoom-in-95 duration-200 focus:outline-hidden"
			role="dialog"
			aria-modal="true"
			aria-labelledby={title ? 'modal-title' : undefined}
			tabindex="-1"
		>
			{#if title}
				<div class="flex items-center justify-between px-6 py-4 border-b border-border">
					<h2 id="modal-title" class="text-lg font-semibold text-text-primary">{title}</h2>
					<button
						onclick={onclose}
						class="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-hover transition-colors"
						aria-label="Close modal"
					>
						<X size={20} />
					</button>
				</div>
			{/if}

			<div class="p-6">
				{@render children()}
			</div>

			{#if footer}
				<div class="px-6 py-4 border-t border-border bg-background/50 rounded-b-xl">
					{@render footer()}
				</div>
			{/if}
		</div>
	</div>
{/if}

<style>
	@keyframes fade-in {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}

	@keyframes zoom-in-95 {
		from {
			opacity: 0;
			transform: scale(0.95);
		}
		to {
			opacity: 1;
			transform: scale(1);
		}
	}

	.animate-in {
		animation-fill-mode: both;
	}

	.fade-in {
		animation-name: fade-in;
	}

	.zoom-in-95 {
		animation-name: zoom-in-95;
	}
</style>
