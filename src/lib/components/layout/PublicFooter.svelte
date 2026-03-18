<script lang="ts">
	export let showDocs = true;
	export let showDownload = true;
</script>

<footer class="relative z-10 border-t border-border/60 mt-auto bg-background">
	<div
		class="max-w-7xl mx-auto px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-text-muted"
	>
		<p>© 2026 Zentra / Abstractmelon</p>
		<div class="flex items-center gap-4">
			{#if showDocs}
				<a href="/docs" class="hover:text-text-secondary transition-colors">Docs</a>
			{/if}
			{#if showDownload}
				<a href="/download" class="hover:text-text-secondary transition-colors">Download</a>
			{/if}
			<a href="/privacy" class="hover:text-text-secondary transition-colors">Privacy Policy</a>
			<a href="/terms" class="hover:text-text-secondary transition-colors">Terms of Service</a>
		</div>
	</div>
</footer>
