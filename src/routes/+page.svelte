<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { goto } from '$app/navigation';
	import { Button } from '$lib/components/ui';
	import AnimatedBackground from '$lib/components/layout/AnimatedBackground.svelte';
	import {
		Github,
		ArrowRight,
		Lock,
		Users,
		Globe,
		Server,
		Code2,
		Package,
		Volume2,
		Eye,
		Star,
		GitFork,
		ChevronDown,
		Zap,
		Shield,
		ExternalLink,
		GitPullRequest
	} from 'lucide-svelte';
	import { isLoggedIn, instances } from '$lib/stores/instance';
	import { isDesktop, logTauriGlobals } from '$lib/utils/platform';

	type Contributor = {
		login: string;
		avatar_url: string;
		html_url: string;
		contributions: number;
	};

	let githubStats: {
		stars: number;
		forks: number;
		contributors: Contributor[];
		updatedAt?: string;
	} | null = $state(null);
	let githubLoading = $state(true);
	let revealObserver: IntersectionObserver | null = null;

	type GithubStatsApiResponse = {
		data?: {
			stars?: number;
			forks?: number;
			contributors?: Contributor[];
			updatedAt?: string;
		};
	};

	onMount(() => {
		// Desktop app skips the homepage entirely
		if (isDesktop()) {
			if ($isLoggedIn) {
				goto('/app', { replaceState: true });
			} else {
				goto('/login', { replaceState: true });
			}
			return;
		} else {
			logTauriGlobals();
		}

		// Pull GitHub stats for the community section
		fetchGithubStats();

		// Fade elements in as they scroll into view
		revealObserver = new IntersectionObserver(
			(entries) => {
				entries.forEach((entry) => {
					if (entry.isIntersecting) {
						entry.target.classList.add('visible');
						revealObserver?.unobserve(entry.target);
					}
				});
			},
			{ threshold: 0.1 }
		);

		observeScrollRevealElements();
		return () => revealObserver?.disconnect();
	});

	function observeScrollRevealElements() {
		if (!revealObserver) return;
		document.querySelectorAll('.scroll-reveal:not(.visible)').forEach((el) => revealObserver?.observe(el));
	}

	async function fetchGithubStats() {
		try {
			const configuredInstanceUrl = $instances[0]?.url;
			const backendBase = configuredInstanceUrl
				? configuredInstanceUrl.replace(/\/+$/, '')
				: window.location.origin;

			const response = await fetch(`${backendBase}/api/v1/public/github/stats`);
			if (!response.ok) {
				throw new Error(`Failed to fetch GitHub stats: ${response.status}`);
			}

			const payload: GithubStatsApiResponse = await response.json();
			const stats = payload?.data;

			githubStats = {
				stars: stats?.stars ?? 0,
				forks: stats?.forks ?? 0,
				contributors: Array.isArray(stats?.contributors) ? stats.contributors : [],
				updatedAt: stats?.updatedAt
			};
		} catch {
			githubStats = { stars: 0, forks: 0, contributors: [] };
		} finally {
			githubLoading = false;
			await tick();
			observeScrollRevealElements();
		}
	}

	function formatNumber(n: number): string {
		if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
		return n.toString();
	}

	// Each entry drives one card in the features grid
	const features = [
		{
			icon: Lock,
			title: 'End-to-End Encrypted',
			description:
				'Every message is encrypted in transit and at rest. Only you and your intended recipients can read your conversations.',
			iconClass: 'text-primary',
			bgClass: 'bg-primary/10'
		},
		{
			icon: Server,
			title: 'Self-Hostable',
			description:
				'Deploy Zentra on your own infrastructure. Docker-ready, one command to get started. You own your data, period.',
			iconClass: 'text-blue-400',
			bgClass: 'bg-blue-400/10'
		},
		{
			icon: Users,
			title: 'Rich Communities',
			description:
				'Servers with text channels, voice channels, roles, and permissions. Everything you need to build and manage a community.',
			iconClass: 'text-purple-400',
			bgClass: 'bg-purple-400/10'
		},
		{
			icon: Package,
			title: 'Plugin Ecosystem',
			description:
				'Extend Zentra with plugins. A first-party SDK lets developers build powerful integrations and custom features.',
			iconClass: 'text-orange-400',
			bgClass: 'bg-orange-400/10'
		},
		{
			icon: Volume2,
			title: 'Voice Channels',
			description:
				'Crystal-clear voice chat built right in. No external tools needed, spin up a voice channel in seconds.',
			iconClass: 'text-green-400',
			bgClass: 'bg-green-400/10'
		},
		{
			icon: Globe,
			title: 'Cross-Platform',
			description:
				'Web, desktop (Windows, macOS, Linux), and mobile (iOS & Android). Zentra goes wherever you are.',
			iconClass: 'text-cyan-400',
			bgClass: 'bg-cyan-400/10'
		},
		{
			icon: Eye,
			title: 'No Tracking',
			description:
				"We don't harvest your data or sell it to advertisers. Open source means you can verify every claim yourself.",
			iconClass: 'text-rose-400',
			bgClass: 'bg-rose-400/10'
		},
		{
			icon: Code2,
			title: 'Open Source',
			description:
				'Every line of code is public. Audit it, contribute to it, fork it. Built by the community, for the community.',
			iconClass: 'text-yellow-400',
			bgClass: 'bg-yellow-400/10'
		}
	] as const;
</script>

<svelte:head>
	<title>Zentra - Encrypted Community Chat</title>
	<meta name="description" content="Open-source, encrypted, community-hostable chat platform" />
</svelte:head>

<!-- ===================== HERO ===================== -->
<div class="min-h-screen bg-background relative overflow-hidden flex flex-col">
	<AnimatedBackground />

	<!-- Navigation -->
	<nav class="relative z-10 flex items-center justify-between px-6 py-4 max-w-7xl mx-auto w-full">
		<h1 class="text-2xl font-bold text-gradient">Zentra</h1>
		<div class="flex items-center gap-4">
			<a
				href="/docs"
				class="text-text-secondary hover:text-text-primary transition-colors text-sm font-medium"
			>
				Docs
			</a>
			<a
				href="/download"
				class="text-text-secondary hover:text-text-primary transition-colors text-sm font-medium"
			>
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
				<Button onclick={() => (window.location.href = '/app')}>
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

	<!-- Hero content -->
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
			<a href="https://github.com/zentra-chat" target="_blank" rel="noopener noreferrer">
				<Button variant="secondary" size="lg">
					<Github size={20} />
					View on GitHub
				</Button>
			</a>
		</div>
	</main>

	<!-- Subtle scroll hint at the bottom of the hero -->
	<div class="relative z-10 flex flex-col items-center pb-8 gap-1 text-text-muted animate-bounce">
		<span class="text-xs tracking-widest uppercase">Scroll</span>
		<ChevronDown size={18} />
	</div>
</div>

<!-- ===================== FEATURES ===================== -->
<section class="bg-background py-24 px-6">
	<div class="max-w-7xl mx-auto">
		<div class="text-center mb-16 scroll-reveal">
			<h2 class="text-4xl md:text-5xl font-bold text-gradient mb-4">Everything you need</h2>
			<p class="text-text-secondary text-lg max-w-2xl mx-auto">
				Zentra packs the features of modern chat platforms into a fully open, self-hostable package with nothing locked behind a paywall.
			</p>
		</div>

		<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
			{#each features as feature, i}
				{@const FeatureIcon = feature.icon}
				<div
					class="scroll-reveal group rounded-2xl border border-border bg-surface p-6 hover:border-border-light hover:bg-surface-hover transition-colors duration-200"
					style="transition-delay: {i * 50}ms"
				>
					<div
						class="mb-4 w-10 h-10 rounded-xl flex items-center justify-center {feature.bgClass} {feature.iconClass}"
					>
						<FeatureIcon size={22} />
					</div>
					<h3 class="text-text-primary font-semibold mb-2">{feature.title}</h3>
					<p class="text-text-muted text-sm leading-relaxed">{feature.description}</p>
				</div>
			{/each}
		</div>
	</div>
</section>

<!-- ===================== SELF-HOSTING ===================== -->
<section class="bg-background-secondary py-24 px-6">
	<div class="max-w-7xl mx-auto grid md:grid-cols-2 gap-16 items-center">
		<!-- Left: copy -->
		<div class="scroll-reveal reveal-left">
			<div
				class="inline-flex items-center gap-2 text-primary text-sm font-medium mb-6 py-1 px-3 rounded-full border border-primary/30 bg-primary/10"
			>
				<Server size={14} />
				Self-Hosting
			</div>
			<h2 class="text-4xl font-bold text-text-primary mb-4">
				Your server.<br />Your rules.
			</h2>
			<p class="text-text-secondary leading-relaxed mb-6">
				Don't trust a third-party with your community's conversations. Deploy Zentra on any server, a VPS, homelab, or your personal machine and keep full control over your data.
			</p>
			<ul class="space-y-3 text-sm text-text-secondary mb-8">
				{#each [
					'Docker-ready with a single compose file',
					'PostgreSQL backend with automatic migrations',
					'S3-compatible object storage support',
					'Detailed docs to get you running in minutes'
				] as item}
					<li class="flex items-start gap-3">
						<div
							class="w-5 h-5 rounded-full bg-primary/20 text-primary flex items-center justify-center shrink-0 mt-0.5"
						>
							<Zap size={12} />
						</div>
						{item}
					</li>
				{/each}
			</ul>
			<a href="/docs/self-hosting">
				<Button>
					Read the docs
					<ArrowRight size={18} />
				</Button>
			</a>
		</div>

		<!-- Right: terminal mockup -->
		<div class="scroll-reveal reveal-right">
			<div
				class="rounded-2xl border border-border overflow-hidden font-mono text-sm bg-background"
				style="box-shadow: 0 0 60px rgba(0,255,169,0.06)"
			>
				<!-- Fake window chrome -->
				<div class="flex items-center gap-2 px-4 py-3 bg-surface border-b border-border">
					<div class="w-3 h-3 rounded-full bg-danger/70"></div>
					<div class="w-3 h-3 rounded-full bg-warning/70"></div>
					<div class="w-3 h-3 rounded-full bg-success/70"></div>
					<span class="ml-2 text-text-muted text-xs">terminal</span>
				</div>
				<div class="p-5 space-y-2 text-text-secondary">
					<div>
						<span class="text-primary">$</span>
						<span class="ml-2">git clone https://github.com/zentra-chat/backend</span>
					</div>
					<div>
						<span class="text-primary">$</span>
						<span class="ml-2">cd backend</span>
					</div>
					<div>
						<span class="text-primary">$</span>
						<span class="ml-2">docker compose up -d</span>
					</div>
					<div class="pt-2 text-text-muted leading-6">
						<div>[+] Running 3/3</div>
						<div class="text-primary/80">&nbsp;&nbsp;&#10003; postgres &nbsp;&nbsp;&nbsp; Started</div>
						<div class="text-primary/80">&nbsp;&nbsp;&#10003; minio &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; Started</div>
						<div class="text-primary/80">&nbsp;&nbsp;&#10003; zentra &nbsp;&nbsp;&nbsp;&nbsp; Started</div>
					</div>
					<div class="pt-2">
						<span class="text-primary">$</span>
						<span class="ml-2 animate-pulse">_</span>
					</div>
				</div>
			</div>
		</div>
	</div>
</section>

<!-- ===================== PLUGIN ECOSYSTEM ===================== -->
<section class="bg-background py-24 px-6">
	<div class="max-w-7xl mx-auto">
		<div class="text-center mb-16 scroll-reveal">
			<div
				class="inline-flex items-center gap-2 text-orange-400 text-sm font-medium mb-6 py-1 px-3 rounded-full border border-orange-400/30 bg-orange-400/10"
			>
				<Package size={14} />
				Plugins
			</div>
			<h2 class="text-4xl md:text-5xl font-bold text-text-primary mb-4">Extend anything</h2>
			<p class="text-text-secondary text-lg max-w-2xl mx-auto">
				Zentra's plugin system lets you add custom commands, UI panels, bots, and integrations
				without touching the core codebase.
			</p>
		</div>

		<div class="grid md:grid-cols-3 gap-6 mb-10">
			{#each [
				{
					icon: Code2,
					title: 'TypeScript SDK',
					description:
						'A first-party SDK with full type safety, hot-reloading in dev mode, and a growing API surface.',
					delay: 0
				},
				{
					icon: Globe,
					title: 'Plugin Marketplace',
					description:
						'Discover and install community-built plugins directly from within the app or your server dashboard.',
					delay: 80
				},
				{
					icon: Shield,
					title: 'Permission-Based Access',
					description:
						'Plugins declare what they need in a manifest. The SDK only grants those specific capabilities. API calls, stores, and actions outside the declared permissions are blocked.',
					delay: 160
				}
			] as card}
				{@const CardIcon = card.icon}
				<div
					class="scroll-reveal rounded-2xl border border-border bg-surface p-6"
					style="transition-delay: {card.delay}ms"
				>
					<div
						class="mb-4 w-10 h-10 rounded-xl flex items-center justify-center bg-orange-400/10 text-orange-400"
					>
						<CardIcon size={22} />
					</div>
					<h3 class="text-text-primary font-semibold mb-2">{card.title}</h3>
					<p class="text-text-muted text-sm leading-relaxed">{card.description}</p>
				</div>
			{/each}
		</div>

		<div class="text-center scroll-reveal" style="transition-delay: 200ms">
			<a
				href="https://github.com/zentra-chat/plugin-sdk"
				target="_blank"
				rel="noopener noreferrer"
			>
				<Button variant="secondary">
					<Github size={18} />
					View Plugin SDK
					<ExternalLink size={15} />
				</Button>
			</a>
		</div>
	</div>
</section>

<!-- ===================== COMMUNITY / GITHUB ===================== -->
<section class="bg-background-secondary py-24 px-6">
	<div class="max-w-7xl mx-auto">
		<div class="text-center mb-16 scroll-reveal">
			<div
				class="inline-flex items-center gap-2 text-text-secondary text-sm font-medium mb-6 py-1 px-3 rounded-full border border-border bg-surface"
			>
				<Github size={14} />
				Open Source
			</div>
			<h2 class="text-4xl md:text-5xl font-bold text-text-primary mb-4">Built in the open</h2>
			<p class="text-text-secondary text-lg max-w-2xl mx-auto">
				Zentra is community-driven. Every feature, fix, and improvement comes from contributors who
				believe in a better, open alternative to closed chat platforms.
			</p>
		</div>

		<!-- GitHub stats row -->
		<div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-16">
			{#each [
				{
					icon: Star,
					label: 'GitHub Stars',
					iconClass: 'text-yellow-400',
					value: githubLoading ? null : formatNumber(githubStats?.stars ?? 0),
					delay: 0
				},
				{
					icon: GitFork,
					label: 'Forks',
					iconClass: 'text-blue-400',
					value: githubLoading ? null : formatNumber(githubStats?.forks ?? 0),
					delay: 60
				},
				{
					icon: Users,
					label: 'Contributors',
					iconClass: 'text-purple-400',
					value: githubLoading ? null : `${githubStats?.contributors.length ?? 0}+`,
					delay: 120
				},
				{
					icon: GitPullRequest,
					label: 'Open Source',
					iconClass: 'text-primary',
					value: '100%',
					delay: 180
				}
			] as stat}
				{@const StatIcon = stat.icon}
				<div
					class="scroll-reveal rounded-2xl border border-border bg-surface p-6 text-center"
					style="transition-delay: {stat.delay}ms"
				>
					<StatIcon size={24} class="mx-auto mb-3 {stat.iconClass}" />
					<div class="text-3xl font-bold text-text-primary mb-1">
						{#if stat.value === null}
							<span class="inline-block w-14 h-8 rounded bg-surface-hover animate-pulse"></span>
						{:else}
							{stat.value}
						{/if}
					</div>
					<div class="text-text-muted text-sm">{stat.label}</div>
				</div>
			{/each}
		</div>

		<!-- Contributors grid - only shown once the API responds -->
		{#if githubStats && githubStats.contributors.length > 0}
			<div class="scroll-reveal">
				<h3
					class="text-center text-text-muted text-xs font-medium mb-8 uppercase tracking-widest"
				>
					Contributors
				</h3>
				<div class="flex flex-wrap justify-center gap-3">
					{#each githubStats.contributors as contributor}
						<a
							href={contributor.html_url}
							target="_blank"
							rel="noopener noreferrer"
							title="{contributor.login} - {contributor.contributions} commits"
							class="group relative"
						>
							<!-- svelte-ignore a11y_missing_attribute -->
							<img
								src={contributor.avatar_url}
								alt={contributor.login}
								class="w-14 h-14 rounded-full border-2 border-border group-hover:border-primary transition-colors duration-200 object-cover"
								loading="lazy"
							/>
							<!-- Name tooltip on hover -->
							<div
								class="absolute -bottom-9 left-1/2 -translate-x-1/2 bg-surface border border-border text-text-primary text-xs py-1 px-2 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 shadow-lg"
							>
								{contributor.login}
							</div>
						</a>
					{/each}
				</div>
			</div>
		{/if}
	</div>
</section>

<!-- ===================== CTA ===================== -->
<section class="bg-background py-32 px-6 relative overflow-hidden">
	<!-- Subtle green glow coming up from the bottom -->
	<div
		class="absolute inset-0 pointer-events-none"
		style="background: radial-gradient(ellipse 80% 60% at 50% 100%, rgba(0,255,169,0.07) 0%, transparent 70%)"
	></div>

	<div class="max-w-3xl mx-auto text-center relative z-10 scroll-reveal">
		<h2 class="text-4xl md:text-5xl font-bold text-gradient glow-text mb-4">
			Ready to take control?
		</h2>
		<p class="text-text-secondary text-lg mb-10 max-w-xl mx-auto">
			Self-host for free, contribute to the project, or just start chatting. Zentra is free and
			open forever.
		</p>
		<div class="flex flex-col sm:flex-row gap-4 justify-center">
			<a href="/register">
				<Button size="lg" class="glow-primary">
					Get Started Free
					<ArrowRight size={20} />
				</Button>
			</a>
			<a href="https://github.com/zentra-chat" target="_blank" rel="noopener noreferrer">
				<Button variant="secondary" size="lg">
					<Github size={20} />
					Star on GitHub
				</Button>
			</a>
		</div>
	</div>
</section>

<!-- ===================== FOOTER ===================== -->
<footer class="border-t border-border/60 bg-background">
	<div
		class="max-w-7xl mx-auto px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-text-muted"
	>
		<p>© 2026 Zentra / Abstractmelon</p>
		<div class="flex items-center gap-4">
			<a href="/docs" class="hover:text-text-secondary transition-colors">Docs</a>
			<a href="/download" class="hover:text-text-secondary transition-colors">Download</a>
			<a href="/privacy" class="hover:text-text-secondary transition-colors">Privacy Policy</a>
			<a href="/terms" class="hover:text-text-secondary transition-colors">Terms of Service</a>
		</div>
	</div>
</footer>

<style>
	/* Base hidden state for all scroll-reveal elements */
	.scroll-reveal {
		opacity: 0;
		transform: translateY(2rem);
		transition:
			opacity 0.65s ease,
			transform 0.65s ease;
	}

	/* Directional slide variants used in the self-hosting section */
	.scroll-reveal.reveal-left {
		transform: translateX(-2rem);
	}

	.scroll-reveal.reveal-right {
		transform: translateX(2rem);
	}

	/* IntersectionObserver adds this to trigger the animation */
	.scroll-reveal.visible {
		opacity: 1;
		transform: none;
	}
</style>
