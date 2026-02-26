<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { Button } from '$lib/components/ui';
	import AnimatedBackground from '$lib/components/layout/AnimatedBackground.svelte';
	import { Github, ArrowRight, MessageSquare, Lock, Users, Globe, Server } from 'lucide-svelte';
	import { isLoggedIn, instances } from '$lib/stores/instance';
	import { isDesktop, logTauriGlobals } from '$lib/utils/platform';

	onMount(() => {
		// For Tauri desktop app, skip homepage and go directly to app or login
		if (isDesktop()) {
			if ($isLoggedIn) {
				goto('/app', { replaceState: true });
			} else {
				goto('/login', { replaceState: true });
			}
			return;
		} else {
			// Helpful debug output when running in an environment that does not have Tauri injected
			logTauriGlobals();
		}

		return;
	});

	const features = [
		{
			icon: MessageSquare,
			title: 'Real-time Messaging',
			description: 'Instant communication with WebSocket-powered real-time updates'
		},
		{
			icon: Lock,
			title: 'End-to-End Encryption',
			description: 'Your private conversations stay private with robust encryption'
		},
		{
			icon: Users,
			title: 'Communities',
			description: 'Create and join communities with channels, roles, and permissions'
		},
		{
			icon: Server,
			title: 'Self-Hostable',
			description: 'Run your own instance with full control over your data'
		},
		{
			icon: Globe,
			title: 'Multi-Instance',
			description: 'Connect to multiple servers from a single app interface'
		}
	];
</script>

<svelte:head>
	<title>Zentra - Encrypted Community Chat</title>
	<meta name="description" content="Open-source, encrypted, community-hostable chat platform" />
</svelte:head>

<div class="min-h-screen bg-background relative overflow-hidden flex flex-col">
	<AnimatedBackground />

	<!-- Navigation -->
	<nav class="relative z-10 flex items-center justify-between px-6 py-4 max-w-7xl mx-auto w-full">
		<h1 class="text-2xl font-bold text-gradient">Zentra</h1>
		<div class="flex items-center gap-4">
			<a href="/docs" class="text-text-secondary hover:text-text-primary transition-colors text-sm font-medium">
				Docs
			</a>
			<a href="/download" class="text-text-secondary hover:text-text-primary transition-colors text-sm font-medium">
				Download
			</a>
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
				<Button onclick={() => window.location.href = '/app'}>
					Open App
					<ArrowRight size={18} />
				</Button>
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

	<!-- Hero -->
	<main class="relative z-10 flex-1 flex flex-col items-center justify-center text-center px-6 py-48">
		<h2 class="text-5xl md:text-7xl font-bold text-gradient glow-text mb-4">Zentra</h2>
		<p class="text-xl md:text-2xl text-text-secondary mb-8 max-w-2xl">
			Open-source, encrypted, community-hostable chat platform.
			<br class="hidden md:block" />
			Your conversations, your control.
		</p>

		<div class="flex flex-col sm:flex-row gap-4">
			{#if $isLoggedIn}
				<a href="/app">
					<Button size="lg" class="glow-primary">
						Open App
						<ArrowRight size={20} />
					</Button>
				</a>
			{:else if $instances.length > 0}
				<a href="/login">
					<Button size="lg" class="glow-primary">
						Continue to Login
						<ArrowRight size={20} />
					</Button>
				</a>
			{:else}
				<a href="/register">
					<Button size="lg" class="glow-primary">
						Get Started
						<ArrowRight size={20} />
					</Button>
				</a>
			{/if}
			<a
				href="https://github.com/zentra-chat"
				target="_blank"
				rel="noopener noreferrer"
			>
				<Button variant="secondary" size="lg">
					<Github size={20} />
					View on GitHub
				</Button>
			</a>
		</div>

		<!-- Features -->
		<!-- <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl">
			{#each features as feature}
				<div class="p-6 bg-surface/50 backdrop-blur-sm border border-border rounded-xl hover:border-primary/30 transition-colors">
					<div class="w-12 h-12 mb-4 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
						<feature.icon size={24} />
					</div>
					<h3 class="text-lg font-semibold text-text-primary mb-2">{feature.title}</h3>
					<p class="text-text-secondary">{feature.description}</p>
				</div>
			{/each}
		</div> -->
	</main>

	<footer class="relative z-10 border-t border-border/60 mt-auto">
		<div class="max-w-7xl mx-auto px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-text-muted">
			<p>© 2026 Zentra / Abstractmelon</p>
			<div class="flex items-center gap-4">
				<a href="/docs" class="hover:text-text-secondary">Docs</a>
				<a href="/download" class="hover:text-text-secondary">Download</a>
				<a href="/privacy" class="hover:text-text-secondary">Privacy Policy</a>
				<a href="/terms" class="hover:text-text-secondary">Terms of Service</a>
			</div>
		</div>
	</footer>
</div>
