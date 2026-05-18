<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		title: string;
		value: string | number;
		subtitle?: string;
		icon: Snippet;
		trend?: { value: string; positive: boolean };
	}

	let { title, value, subtitle = '', icon, trend }: Props = $props();
</script>

<div
	class="bg-surface border border-border rounded-xl p-6 hover:border-border-light transition-colors duration-200"
>
	<div class="flex items-start justify-between mb-4">
		<div class="p-2.5 rounded-lg bg-primary/10">
			{@render icon()}
		</div>
	</div>
	<div class="space-y-1">
		<p class="text-sm text-text-muted font-medium">{title}</p>
		<p class="text-2xl font-bold text-text-primary tabular-nums">{value}</p>
		{#if subtitle}
			<p class="text-xs text-text-muted">{subtitle}</p>
		{/if}
	</div>
	{#if trend}
		<div class="mt-3 flex items-center gap-1.5">
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="14"
				height="14"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
				class={trend.positive ? 'text-success' : 'text-danger'}
			>
				{#if trend.positive}
					<path d="m18 15-6-6-6 6" />
				{:else}
					<path d="m6 9 6 6 6-6" />
				{/if}
			</svg>
			<span class="text-xs font-medium {trend.positive ? 'text-success' : 'text-danger'}">
				{trend.value}
			</span>
		</div>
	{/if}
</div>
