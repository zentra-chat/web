<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Option {
		value: string;
		label: string;
		disabled?: boolean;
	}

	interface Props {
		value?: string;
		options?: Option[];
		disabled?: boolean;
		error?: string;
		label?: string;
		id?: string;
		name?: string;
		required?: boolean;
		class?: string;
		onchange?: (e: Event) => void;
		children?: Snippet;
	}

	let {
		value = $bindable(''),
		options = [],
		disabled = false,
		error = '',
		label = '',
		id = '',
		name = '',
		required = false,
		class: className = '',
		onchange,
		children
	}: Props = $props();

	const selectId = $derived(id || `select-${Math.random().toString(36).substring(2, 9)}`);
</script>

<div class="flex flex-col gap-1.5 {className}">
	{#if label}
		<label for={selectId} class="text-sm font-medium text-text-secondary">
			{label}
			{#if required}
				<span class="text-danger">*</span>
			{/if}
		</label>
	{/if}

	<select
		id={selectId}
		{name}
		bind:value
		{disabled}
		{required}
		{onchange}
		class="w-full px-4 py-2.5 bg-background border rounded-lg text-text-primary transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed {error ? 'border-danger' : 'border-border hover:border-border-light'}"
	>
		{#if options.length > 0}
			{#each options as option (option.value)}
				<option value={option.value} disabled={option.disabled}>{option.label}</option>
			{/each}
		{:else if children}
			{@render children()}
		{/if}
	</select>

	{#if error}
		<p class="text-sm text-danger">{error}</p>
	{/if}
</div>