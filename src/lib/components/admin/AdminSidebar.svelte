<script lang="ts">
	import { page } from '$app/stores';
	import {
		LayoutDashboard,
		Users,
		Server,
		Shield,
		Puzzle,
		FileText,
		Settings,
		BarChart3
	} from 'lucide-svelte';

	interface NavItem {
		label: string;
		href: string;
		icon: typeof LayoutDashboard;
		badge?: string;
	}

	const navItems: NavItem[] = [
		{ label: 'Overview', href: '/admin', icon: LayoutDashboard },
		{ label: 'Analytics', href: '/admin/analytics', icon: BarChart3 },
		{ label: 'Users', href: '/admin/users', icon: Users },
		{ label: 'Server Management', href: '/admin/servers', icon: Server },
		{ label: 'Plugins', href: '/admin/plugins', icon: Puzzle },
		{ label: 'Audit Log', href: '/admin/logs', icon: FileText },
		{ label: 'Settings', href: '/admin/settings', icon: Settings }
	];

	let currentPath = $derived($page.url.pathname);
</script>

<aside
	class="w-64 min-h-full bg-background-secondary border-r border-border flex flex-col shrink-0"
>
	<div class="px-6 py-5 border-b border-border">
		<div class="flex items-center gap-3">
			<div>
				<h1 class="text-sm font-semibold text-text-primary">Admin Panel</h1>
				<p class="text-xs text-text-muted">Instance Management</p>
			</div>
		</div>
	</div>

	<nav class="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
		{#each navItems as item}
			<a
				href={item.href}
				class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200
					{currentPath === item.href
						? 'bg-primary/10 text-primary'
						: 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'}"
			>
				<svelte:component this={item.icon} size={18} />
				<span>{item.label}</span>
				{#if item.badge}
					<span
						class="ml-auto px-2 py-0.5 text-xs rounded-full bg-primary/20 text-primary font-medium"
					>
						{item.badge}
					</span>
				{/if}
			</a>
		{/each}
	</nav>

	<div class="px-6 py-4 border-t border-border space-y-1">
		<a
			href="/"
			class="flex items-center gap-2 text-xs text-text-muted hover:text-text-secondary transition-colors"
		>
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
			><path d="m15 18-6-6 6-6" /></svg>
			Back to App
		</a>
		<p class="text-xs text-text-muted px-0.5">v{__APP_VERSION__}</p>
	</div>
</aside>

<style>
	aside {
		height: 100%;
	}
</style>
