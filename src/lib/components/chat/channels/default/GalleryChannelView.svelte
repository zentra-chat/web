<script lang="ts">
	import { X, Plus, Send } from 'lucide-svelte';
	import { Spinner } from '$lib/components/ui';
	import { api } from '$lib/api';
	import { activeChannel, activeChannelMessages, addMessage, setMessages } from '$lib/stores/community';
	import { addToast } from '$lib/stores/ui';

	let imageInput: HTMLInputElement | null = $state(null);
	let uploading = $state(false);
	let selectedFiles = $state<File[]>([]);
	let caption = $state('');
	let viewerUrl: string | null = $state(null);
	let loadedChannelId = $state<string | null>(null);

	$effect(() => {
		const channelId = $activeChannel?.id;
		if (channelId && channelId !== loadedChannelId) {
			loadedChannelId = channelId;
			loadMessages(channelId);
		}
	});

	async function loadMessages(channelId: string) {
		try {
			const messages = await api.getMessages(channelId, { limit: 100 });
			setMessages(channelId, messages);
		} catch (error) {
			console.error('Failed to load gallery messages:', error);
		}
	}

	let images = $derived(
		($activeChannelMessages || []).flatMap((msg) =>
			(msg.attachments || [])
				.filter((attachment) => attachment.contentType?.startsWith('image/'))
				.map((attachment) => ({
					id: attachment.id,
					url: attachment.thumbnailUrl || attachment.url,
					fullUrl: attachment.url,
					author: msg.author,
					createdAt: msg.createdAt,
					caption: msg.content
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
				const uploaded = await api.uploadAttachment(file, $activeChannel.id);
				attachmentIds.push(uploaded.id);
			}

			const message = await api.sendMessage($activeChannel.id, {
				content: caption.trim(),
				attachments: attachmentIds
			});

			addMessage($activeChannel.id, message);
			selectedFiles = [];
			caption = '';
		} catch (error) {
			console.error('Failed to send gallery post:', error);
			addToast({ type: 'error', message: 'Failed to send gallery post' });
		} finally {
			uploading = false;
		}
	}

	function openViewer(url: string) {
		viewerUrl = url;
	}

	function closeViewer() {
		viewerUrl = null;
	}
</script>

<svelte:window onkeydown={(e) => { if (e.key === 'Escape') closeViewer(); }} />

{#if viewerUrl}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
		onclick={closeViewer}
		onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') closeViewer(); }}
		role="presentation"
	>
		<div class="max-h-[90vh] max-w-[90vw]" role="presentation" onclick={(e) => e.stopPropagation()}>
			<img src={viewerUrl} alt="" class="max-h-[90vh] max-w-[90vw] object-contain" />
		</div>
		<button
			onclick={closeViewer}
			class="absolute top-4 right-4 p-2 text-white/80 hover:text-white rounded-full hover:bg-white/10 transition-colors"
			aria-label="Close viewer"
		>
			<X size={24} />
		</button>
	</div>
{/if}

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
			<div class="flex flex-wrap gap-3">
				{#each images as image (image.id)}
					<button
						onclick={() => openViewer(image.fullUrl)}
						class="inline-flex flex-col rounded-lg overflow-hidden bg-surface border border-border hover:border-border-hover transition-colors text-left cursor-pointer"
					>
						<img
							src={image.url}
							alt=""
							class="h-48 w-auto block"
							loading="lazy"
						/>
						<div class="px-2 py-1.5 space-y-0.5 max-w-72">
							<p class="text-xs text-text-primary truncate">
								{image.caption || 'No caption'}
							</p>
							<p class="text-xs text-text-muted line-clamp-2">{image.author?.displayName || image.author?.username || 'Unknown'}</p>
						</div>
					</button>
				{/each}
			</div>
		{/if}
	</div>

	<div class="border-t border-border bg-background p-3">
		<input
			bind:this={imageInput}
			type="file"
			accept="image/*"
			multiple
			onchange={handlePick}
			class="hidden"
		/>

		{#if selectedFiles.length > 0}
			<div class="flex flex-wrap gap-2 mb-3">
				{#each selectedFiles as file, index (file.name + ':' + file.size + ':' + file.lastModified)}
					<div class="relative group">
						<div class="w-20 h-20 rounded overflow-hidden border border-border bg-surface-hover">
							<img
								src={URL.createObjectURL(file)}
								alt={file.name}
								class="w-full h-full object-cover"
							/>
						</div>
						<button
							onclick={() => removeFile(index)}
							class="absolute -top-1.5 -right-1.5 w-5 h-5 bg-error text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
							aria-label="Remove file"
						>
							<X size={10} />
						</button>
					</div>
				{/each}
			</div>
		{/if}

		<div class="flex items-center gap-2 bg-surface rounded-lg border border-border">
			<button
				onclick={openPicker}
				class="p-3 text-text-muted hover:text-text-primary transition-colors shrink-0 flex items-center justify-center h-12"
				aria-label="Add images"
				disabled={uploading}
			>
				<Plus size={20} />
			</button>

			<input
				bind:value={caption}
				placeholder="Add a caption (optional)"
				class="flex-1 py-3 bg-transparent text-text-primary placeholder-text-muted focus:outline-none focus-visible:outline-none min-h-12"
				disabled={uploading}
				onkeydown={(e) => {
					if (e.key === 'Enter' && !e.shiftKey) {
						e.preventDefault();
						sendGalleryPost();
					}
				}}
			/>

			<button
				onclick={sendGalleryPost}
				disabled={uploading || selectedFiles.length === 0}
				class="p-3 text-primary hover:text-secondary disabled:text-text-muted disabled:cursor-not-allowed transition-colors flex items-center justify-center h-full"
				aria-label="Post to gallery"
			>
				{#if uploading}
					<Spinner size="sm" />
				{:else}
					<Send size={20} />
				{/if}
			</button>
		</div>
	</div>
</div>
