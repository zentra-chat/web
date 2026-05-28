<script lang="ts">
	import { resolve } from '$app/paths';
	import { getSDK } from '@zentra/plugin-sdk/runtime';

	const sdk = getSDK();
	const { activeChannel, activeChannelMessages } = sdk.stores;

	let imageInput: HTMLInputElement | null = $state(null);
	let uploading = $state(false);
	let selectedFiles = $state<File[]>([]);
	let caption = $state('');

	let images = $derived(
		($activeChannelMessages || []).flatMap((msg) =>
			(msg.attachments || [])
				.filter((attachment) => attachment.contentType?.startsWith('image/'))
				.map((attachment) => ({
					id: attachment.id,
					url: attachment.thumbnailUrl || attachment.url,
					fullUrl: attachment.url,
					author: msg.author,
					createdAt: msg.createdAt
				}))
		)
	);

	function openPicker() {
		imageInput?.click();
	}

	function handlePick(event: Event) {
		const input = event.target as HTMLInputElement;
		const files = Array.from(input.files || []).filter((file) => file.type.startsWith('image/'));
		selectedFiles = [...selectedFiles, ...files].slice(0, 10);
		input.value = '';
	}

	function removeFile(index: number) {
		selectedFiles = selectedFiles.filter((_, i) => i !== index);
	}

	async function sendGalleryPost() {
		if (uploading || selectedFiles.length === 0 || !$activeChannel?.id) return;
		uploading = true;
		try {
			const attachmentIds: string[] = [];
			for (const file of selectedFiles) {
				const uploaded = await sdk.api.uploadAttachment(file, $activeChannel.id);
				attachmentIds.push(uploaded.id);
			}

			const message = await sdk.api.sendMessage($activeChannel.id, {
				content: caption.trim(),
				attachments: attachmentIds
			});

			sdk.ui.addMessage($activeChannel.id, message);
			selectedFiles = [];
			caption = '';
		} catch (error) {
			console.error('Failed to send gallery post:', error);
			sdk.ui.addToast({ type: 'error', message: 'Failed to send gallery post' });
		} finally {
			uploading = false;
		}
	}
</script>

<div class="flex-1 flex flex-col min-h-0">
	<div class="px-4 py-3 border-b border-border bg-surface">
		<p class="text-sm text-text-muted">Gallery posts are image-first messages for this channel.</p>
	</div>

	<div class="flex-1 overflow-y-auto p-4">
		{#if images.length === 0}
			<div class="h-full flex items-center justify-center text-text-muted text-sm">
				No images yet. Upload one below to start the gallery.
			</div>
		{:else}
			<div class="grid gap-3" style="grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));">
				{#each images as image (image.id)}
					<a href={resolve(image.fullUrl)} target="_blank" rel="noopener noreferrer" class="block rounded-lg overflow-hidden bg-surface border border-border hover:border-border-hover transition-colors">
						<img src={image.url} alt="Gallery image" class="w-full aspect-square object-cover" loading="lazy" />
						<div class="px-2 py-1.5 text-xs text-text-muted truncate">
							{image.author?.displayName || image.author?.username || 'Unknown'}
						</div>
					</a>
				{/each}
			</div>
		{/if}
	</div>

	<div class="border-t border-border bg-background p-3 space-y-3">
		<input bind:this={imageInput} type="file" accept="image/*" multiple onchange={handlePick} class="hidden" />

		{#if selectedFiles.length > 0}
			<div class="flex flex-wrap gap-2">
				{#each selectedFiles as file, index (`${file.name}-${index}`)}
					<button type="button" class="px-2 py-1 rounded bg-surface text-xs text-text-secondary border border-border" onclick={() => removeFile(index)}>
						{file.name}
					</button>
				{/each}
			</div>
		{/if}

		<textarea
			bind:value={caption}
			rows={2}
			placeholder="Add a caption (optional)"
			class="w-full rounded border border-border bg-surface px-3 py-2 text-sm"
		></textarea>

		<div class="flex items-center justify-between gap-2">
			<button type="button" class="px-3 py-2 rounded border border-border bg-surface text-sm" onclick={openPicker}>
				Add Images
			</button>
			<button
				type="button"
				onclick={sendGalleryPost}
				disabled={uploading || selectedFiles.length === 0}
				class="px-3 py-2 rounded bg-primary text-primary-foreground text-sm disabled:opacity-60"
			>
				{uploading ? 'Posting...' : 'Post to Gallery'}
			</button>
		</div>
	</div>
</div>
