<script lang="ts">
	interface Props {
		value?: string;
		placeholder?: string;
		disabled?: boolean;
		error?: string;
		label?: string;
		id?: string;
		name?: string;
		required?: boolean;
		rows?: number;
		maxlength?: number;
		class?: string;
		oninput?: (e: Event) => void;
		onkeydown?: (e: KeyboardEvent) => void;
	}

	let {
		value = $bindable(''),
		placeholder = '',
		disabled = false,
		error = '',
		label = '',
		id = '',
		name = '',
		required = false,
		rows = 3,
		maxlength,
		class: className = '',
		oninput,
		onkeydown
	}: Props = $props();

	const inputId = $derived(id || `textarea-${Math.random().toString(36).substring(2, 9)}`);
</script>

<div class="flex flex-col gap-1.5 {className}">
	{#if label}
		<label for={inputId} class="text-sm font-medium text-text-secondary">
			{label}
			{#if required}
				<span class="text-danger">*</span>
			{/if}
		</label>
	{/if}
	<textarea
		id={inputId}
		{name}
		bind:value
		{placeholder}
		{disabled}
		{required}
		{rows}
		{maxlength}
		{oninput}
		{onkeydown}
		class="w-full px-4 py-2.5 bg-background border rounded-lg text-text-primary placeholder-text-muted transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed resize-none
		{error ? 'border-danger' : 'border-border hover:border-border-light'}"
	></textarea>
	{#if error}
		<p class="text-sm text-danger">{error}</p>
	{/if}
</div>
