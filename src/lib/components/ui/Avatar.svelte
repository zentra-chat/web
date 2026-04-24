<script lang="ts">
	import type { User } from '$lib/types';

	interface Props {
		user?: User | null;
		src?: string | null;
		alt?: string;
		size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
		status?: 'online' | 'away' | 'busy' | 'offline' | 'invisible' | null;
		class?: string;
	}

	let { user, src, alt = 'Avatar', size = 'md', status, class: className = '' }: Props = $props();

	const sizeClasses = {
		xs: 'w-6 h-6 text-xs',
		sm: 'w-8 h-8 text-sm',
		md: 'w-10 h-10 text-base',
		lg: 'w-12 h-12 text-lg',
		xl: 'w-16 h-16 text-xl'
	};

	const statusSizeClasses = {
		xs: 'w-2 h-2 border',
		sm: 'w-2.5 h-2.5 border',
		md: 'w-3 h-3 border-2',
		lg: 'w-3.5 h-3.5 border-2',
		xl: 'w-4 h-4 border-2'
	};

	const statusColors = {
		online: 'bg-success',
		away: 'bg-warning',
		busy: 'bg-danger',
		offline: 'bg-text-muted',
		invisible: 'bg-text-muted'
	};

	const avatarUrl = $derived(user?.avatarUrl || src);
	const displayName = $derived(user?.displayName || user?.username || alt);
	const initials = $derived(
		displayName
			.split(' ')
			.map((n) => n[0])
			.join('')
			.slice(0, 2)
			.toUpperCase()
	);
	const statusValue = $derived(status ?? user?.status ?? null);
</script>

<div class="relative flex shrink-0 leading-none {className}">
	{#if avatarUrl}
		<img
			src={avatarUrl}
			alt={displayName}
			class="{sizeClasses[size]} block rounded-full object-cover bg-surface"
		/>
	{:else}
		<div
			class="{sizeClasses[size]} rounded-full bg-linear-to-br from-primary/20 to-secondary/20 flex items-center justify-center font-medium text-primary"
		>
			{initials}
		</div>
	{/if}

	{#if statusValue && statusValue !== 'invisible'}
		<span
			class="absolute bottom-0 right-0 {statusSizeClasses[size]} {statusColors[statusValue]} rounded-full border-surface"
		></span>
	{/if}
</div>
