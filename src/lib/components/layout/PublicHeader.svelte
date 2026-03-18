<script lang="ts">
	import { Button } from '$lib/components/ui';
	import { ArrowRight, Github } from 'lucide-svelte';
	import { isLoggedIn } from '$lib/stores/instance';

	export let currentPath = '/';
	export let showDocs = true;
	export let showDownload = true;

	function isLinkActive(path: string): boolean {
		if (path === '/docs') {
			return currentPath === '/docs' || currentPath.startsWith('/docs/');
		}
		return currentPath === path;
	}
</script>

<nav class="relative z-10 flex items-center justify-between px-6 py-4 max-w-7xl mx-auto w-full">
	<a href="/" class="text-2xl font-bold text-gradient">Zentra</a>
	<div class="flex items-center gap-4">
		{#if showDocs}
			<a
				href="/docs"
				class={`text-sm font-medium transition-colors ${isLinkActive('/docs') ? 'text-text-primary' : 'text-text-secondary hover:text-text-primary'}`}
			>
				Docs
			</a>
		{/if}

		{#if showDownload}
			<a
				href="/download"
				class={`text-sm font-medium transition-colors ${isLinkActive('/download') ? 'text-text-primary' : 'text-text-secondary hover:text-text-primary'}`}
			>
				Download
			</a>
		{/if}

		<a
			href="https://github.com/zentra-chat"
			target="_blank"
			rel="noopener noreferrer"
			class="p-2 text-text-secondary hover:text-text-primary transition-colors"
			aria-label="GitHub"
		>
			<Github size={24} />
		</a>

		{#if $isLoggedIn}
			<a href="/app">
				<Button>
					Open App
					<ArrowRight size={18} />
				</Button>
			</a>
		{:else}
			<a href="/login">
				<Button variant="secondary">Login</Button>
			</a>
			<a href="/register">
				<Button>
					Get Started
					<ArrowRight size={18} />
				</Button>
			</a>
		{/if}
	</div>
</nav>
