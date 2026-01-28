<script lang="ts">
	import { X, Check, AlertCircle, AlertTriangle, Info } from '$lib/components/icons';
	import type { ToastMessage } from '$lib/types';

	interface Props {
		toast: ToastMessage;
		ondismiss: () => void;
	}

	let { toast, ondismiss }: Props = $props();

	const icons = {
		success: Check,
		error: AlertCircle,
		warning: AlertTriangle,
		info: Info
	};

	const bgColors = {
		success: 'bg-success/10 border-success/30',
		error: 'bg-danger/10 border-danger/30',
		warning: 'bg-warning/10 border-warning/30',
		info: 'bg-info/10 border-info/30'
	};

	const iconColors = {
		success: 'text-success',
		error: 'text-danger',
		warning: 'text-warning',
		info: 'text-info'
	};

	const Icon = $derived(icons[toast.type]);
</script>

<div
	class="flex items-start gap-3 p-4 border rounded-lg shadow-lg backdrop-blur-sm animate-slide-in {bgColors[toast.type]}"
	role="alert"
>
	<div class={iconColors[toast.type]}>
		<Icon size={20} />
	</div>
	<p class="flex-1 text-sm text-text-primary">{toast.message}</p>
	<button
		onclick={ondismiss}
		class="p-1 rounded text-text-muted hover:text-text-primary hover:bg-surface-hover transition-colors"
		aria-label="Dismiss"
	>
		<X size={16} />
	</button>
</div>

<style>
	@keyframes slide-in {
		from {
			opacity: 0;
			transform: translateX(100%);
		}
		to {
			opacity: 1;
			transform: translateX(0);
		}
	}

	.animate-slide-in {
		animation: slide-in 0.3s ease-out;
	}
</style>
