<script lang="ts">
	import { toasts, dismissToast } from '$lib/stores/ui';
	import Toast from './Toast.svelte';
</script>

<div class="fixed bottom-4 right-4 z-100 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
	{#each $toasts as toast (toast.id)}
		<div class="pointer-events-auto">
			<Toast {toast} ondismiss={() => dismissToast(toast.id)} />
		</div>
	{/each}
</div>
