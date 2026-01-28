<script lang="ts">
	import { onMount } from 'svelte';
	import { Modal, Spinner } from '$lib/components/ui';
	import { X, Download, File } from '$lib/components/icons';
	import { filePreviewOpen, filePreviewData } from '$lib/stores/ui';
	import type { Attachment } from '$lib/types';

	const isOpen = $derived($filePreviewOpen);
	const data = $derived($filePreviewData);
	const attachment = $derived(data);

	let content = $state<string | null>(null);
	let isLoading = $state(false);
	let error = $state<string | null>(null);

	$effect(() => {
		if (isOpen && data && attachment) {
			const mime = attachment.mimeType || attachment.contentType;
			const isText = mime?.startsWith('text/') || 
						 mime === 'application/json' || 
						 mime === 'application/javascript' ||
						 mime === 'application/typescript' ||
						 attachment.filename.endsWith('.md') ||
						 attachment.filename.endsWith('.go') ||
						 attachment.filename.endsWith('.ts') ||
						 attachment.filename.endsWith('.js') ||
						 attachment.filename.endsWith('.py');

			if (isText) {
				loadFileContent();
			} else {
				content = null;
			}
		}
	});

	async function loadFileContent() {
		if (!attachment) return;
		isLoading = true;
		error = null;
		try {
			const response = await fetch(attachment.url);
			if (!response.ok) throw new Error('Failed to fetch file content');
			content = await response.text();
		} catch (err) {
			console.error(err);
			error = 'Could not load file preview';
		} finally {
			isLoading = false;
		}
	}

	function handleDownload() {
		if (attachment) {
			window.open(attachment.url, '_blank');
		}
	}

	function handleClose() {
		filePreviewOpen.set(false);
		filePreviewData.set(null);
		content = null;
	}
</script>

<Modal isOpen={isOpen} onclose={handleClose} size="xl">
	{#if attachment}
		<div class="flex flex-col h-[80vh]">
			<!-- Header -->
			<div class="flex items-center justify-between p-4 border-b border-border">
				<div class="flex items-center gap-3">
					<div class="w-10 h-10 bg-surface border border-border rounded flex items-center justify-center">
						<File size={24} class="text-primary" />
					</div>
					<div>
						<h2 class="font-bold text-text-primary">{attachment.filename}</h2>
						<p class="text-xs text-text-muted">
							{(attachment.mimeType || attachment.contentType || 'unknown')} • 
							{attachment.size < 1024 
								? attachment.size + ' B' 
								: attachment.size < 1024 * 1024 
									? (attachment.size / 1024).toFixed(1) + ' KB' 
									: (attachment.size / (1024 * 1024)).toFixed(1) + ' MB'}
						</p>
					</div>
				</div>
				<div class="flex items-center gap-2">
					<button
						onclick={handleDownload}
						class="p-2 hover:bg-surface-hover rounded-md text-text-muted hover:text-text-primary transition-colors"
						title="Download"
					>
						<Download size={20} />
					</button>
					<button
						onclick={handleClose}
						class="p-2 hover:bg-surface-hover rounded-md text-text-muted hover:text-text-primary transition-colors"
					>
						<X size={20} />
					</button>
				</div>
			</div>

			<!-- Content -->
			<div class="flex-1 overflow-auto bg-background p-4 relative">
				{#if isLoading}
					<div class="absolute inset-0 flex items-center justify-center">
						<Spinner size="lg" />
					</div>
				{:else if error}
					<div class="absolute inset-0 flex flex-col items-center justify-center text-text-muted">
						<File size={48} class="mb-4 opacity-20" />
						<p>{error}</p>
						<button onclick={handleDownload} class="mt-4 text-primary hover:underline">
							Download instead
						</button>
					</div>
				{:else if content !== null}
					<pre class="font-mono text-sm text-text-secondary whitespace-pre overflow-x-auto tab-4"><code>{content}</code></pre>
				{:else}
					<div class="absolute inset-0 flex flex-col items-center justify-center text-text-muted">
						<File size={48} class="mb-4 opacity-20" />
						<p>No preview available for this file type</p>
						<button onclick={handleDownload} class="mt-4 text-primary hover:underline">
							Download file
						</button>
					</div>
				{/if}
			</div>
		</div>
	{/if}
</Modal>

<style>
	.tab-4 {
		tab-size: 4;
	}
</style>
