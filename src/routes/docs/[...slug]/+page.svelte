<script lang="ts">
	import { page } from '$app/stores';
	import { Button } from '$lib/components/ui';
	import AnimatedBackground from '$lib/components/layout/AnimatedBackground.svelte';
	import { docsSections, getDocBySlug } from '$lib/docs/content';
	import { Github, ArrowRight } from 'lucide-svelte';
	import { isLoggedIn } from '$lib/stores/instance';

	$: slug = $page.params.slug;
	$: currentDoc = getDocBySlug(slug);
	$: pageTitle = currentDoc ? `${currentDoc.title} · Zentra Docs` : 'Docs Not Found · Zentra';
</script>

<svelte:head>
	<title>{pageTitle}</title>
	{#if currentDoc}
		<meta name="description" content={currentDoc.description} />
	{:else}
		<meta name="description" content="Zentra documentation page not found." />
	{/if}
</svelte:head>

<div class="min-h-screen bg-background relative overflow-hidden flex flex-col">
	<AnimatedBackground particleCountDesktop={180} />

	<nav class="relative z-10 flex items-center justify-between px-6 py-4 max-w-7xl mx-auto w-full">
		<a href="/" class="text-2xl font-bold text-gradient">Zentra</a>
		<div class="flex items-center gap-4">
			<a href="/docs" class="text-text-primary transition-colors text-sm font-medium">Docs</a>
			<a href="/download" class="text-text-secondary hover:text-text-primary transition-colors text-sm font-medium">Download</a>
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

	<main class="relative z-10 flex-1 px-6 pb-12">
		<div class="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)_220px] gap-6">
			<aside class="rounded-xl border border-border bg-surface/50 backdrop-blur-sm p-4 h-fit lg:sticky lg:top-6">
				{#each docsSections as section}
					<h2 class="text-xs uppercase tracking-wide text-text-muted mb-2 mt-1">{section.title}</h2>
					<nav class="space-y-1 mb-4">
						{#each section.items as item}
							<a
								href={item.href}
								class={`block px-3 py-2 rounded-md text-sm transition-colors ${currentDoc?.slug === item.slug ? 'bg-primary/15 text-text-primary border border-primary/25' : 'text-text-secondary hover:text-text-primary hover:bg-surface-hover'}`}
							>
								{item.title}
							</a>
						{/each}
					</nav>
				{/each}
			</aside>

			<section class="rounded-xl border border-border bg-surface/55 backdrop-blur-md p-6 md:p-8 min-h-[60vh]">
				{#if currentDoc}
					<p class="text-xs text-text-muted mb-4">Docs / {currentDoc.slug}</p>
					<article class="docs-markdown" aria-label={currentDoc.title}>
						{@html currentDoc.html}
					</article>
				{:else}
					<div class="text-center py-16">
						<h1 class="text-3xl font-bold text-text-primary mb-3">Page not found</h1>
						<p class="text-text-secondary mb-6">This documentation page does not exist.</p>
						<a href="/docs">
							<Button>Back to Docs Home</Button>
						</a>
					</div>
				{/if}
			</section>

			<aside class="hidden lg:block rounded-xl border border-border bg-surface/40 backdrop-blur-sm p-4 h-fit lg:sticky lg:top-6">
				<h2 class="text-sm uppercase tracking-wide text-text-muted mb-3">On this page</h2>
				{#if currentDoc && currentDoc.headings.length > 0}
					<nav class="space-y-2">
						{#each currentDoc.headings as heading}
							<a
								href={`#${heading.anchor}`}
								class={`block text-sm ${heading.level === 3 ? 'pl-3' : ''} text-text-secondary hover:text-text-primary transition-colors`}
							>
								{heading.text}
							</a>
						{/each}
					</nav>
				{:else}
					<p class="text-sm text-text-muted">No section headings</p>
				{/if}
			</aside>
		</div>
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

<style>
	.docs-markdown :global(h1),
	.docs-markdown :global(h2),
	.docs-markdown :global(h3),
	.docs-markdown :global(h4) {
		color: var(--color-text-primary);
		line-height: 1.25;
		scroll-margin-top: 1.5rem;
	}

	.docs-markdown :global(h1) {
		font-size: 2rem;
		font-weight: 700;
		margin-bottom: 1rem;
	}

	.docs-markdown :global(h2) {
		font-size: 1.4rem;
		font-weight: 650;
		margin: 2rem 0 0.75rem;
	}

	.docs-markdown :global(h3) {
		font-size: 1.1rem;
		font-weight: 600;
		margin: 1.3rem 0 0.5rem;
	}

	.docs-markdown :global(p),
	.docs-markdown :global(li) {
		color: var(--color-text-secondary);
		line-height: 1.7;
	}

	.docs-markdown :global(ul),
	.docs-markdown :global(ol) {
		padding-left: 1.25rem;
		margin: 0.65rem 0 1rem;
	}

	.docs-markdown :global(ul) {
		list-style: disc;
	}

	.docs-markdown :global(ol) {
		list-style: decimal;
	}

	.docs-markdown :global(code) {
		background: var(--color-background-secondary);
		border: 1px solid var(--color-border);
		padding: 0.1rem 0.35rem;
		border-radius: 0.3rem;
		font-size: 0.88em;
	}

	.docs-markdown :global(pre) {
		background: var(--color-background-secondary);
		border: 1px solid var(--color-border);
		border-radius: 0.6rem;
		padding: 0.95rem;
		overflow-x: auto;
		margin: 0.8rem 0 1.1rem;
	}

	.docs-markdown :global(pre code) {
		padding: 0;
		border: 0;
		background: transparent;
	}

	.docs-markdown :global(a) {
		color: var(--color-primary);
		text-decoration: underline;
		text-underline-offset: 2px;
	}

	.docs-markdown :global(a:hover) {
		color: var(--color-primary-hover);
	}

	.docs-markdown :global(blockquote) {
		border-left: 3px solid var(--color-border-light);
		padding: 0.4rem 0.85rem;
		margin: 0.8rem 0;
		background: var(--color-background-secondary);
		border-radius: 0.35rem;
	}

	.docs-markdown :global(hr) {
		border: 0;
		border-top: 1px solid var(--color-border);
		margin: 1.5rem 0;
	}
</style>