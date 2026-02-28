<script lang="ts">
	import { onMount } from 'svelte';
	import { Image, Upload, Maximize2, Send, X } from 'lucide-svelte';
	import { Spinner } from '$lib/components/ui';
	import { activeChannel, activeChannelMessages, addMessage } from '$lib/stores/community';
	import { addToast } from '$lib/stores/ui';
	import { api } from '$lib/api';
	import type { Message } from '$lib/types';

	// Pull layout preference from the channel's metadata
	let layout = $derived(
		($activeChannel?.metadata as Record<string, unknown>)?.layout === 'masonry' ? 'masonry' : 'grid'
	);

	let isLoading = $state(true);
	let selectedImage = $state<string | null>(null);
	let imageFiles = $state<File[]>([]);
	let description = $state('');
	let isSubmitting = $state(false);
	let imageInputRef: HTMLInputElement | null = $state(null);

	// Filter messages to only ones with image attachments
	let mediaMessages = $derived(
		($activeChannelMessages || []).filter(
			(msg: Message) =>
				msg.attachments?.some((a) => a.contentType?.startsWith('image/'))
		)
	);

	// Flatten into a simple list of images with their message context
	let images = $derived(
		mediaMessages.flatMap((msg: Message) =>
			(msg.attachments || [])
				.filter((a) => a.contentType?.startsWith('image/'))
				.map((a) => ({
					id: a.id,
					url: a.url,
					thumbnailUrl: a.thumbnailUrl || a.url,
					filename: a.filename,
					width: a.width,
					height: a.height,
					author: msg.author,
					createdAt: msg.createdAt
				}))
		)
	);

	onMount(() => {
		// Messages are already loaded by the store subscription
		isLoading = false;
	});

	function openImage(url: string) {
		selectedImage = url;
	}

	function closeImage() {
		selectedImage = null;
	}

	function openImagePicker() {
		imageInputRef?.click();
	}

	function removeImage(index: number) {
		imageFiles = imageFiles.filter((_, currentIndex) => currentIndex !== index);
	}

	function handleImageSelect(event: Event) {
		const input = event.target as HTMLInputElement;
		if (!input.files) return;

		const files = Array.from(input.files);
		const validImages = files.filter((file) => file.type.startsWith('image/'));

		if (validImages.length !== files.length) {
			addToast({
				type: 'warning',
				message: 'Only image files are allowed in gallery channels.'
			});
		}

		const remainingSlots = Math.max(0, 10 - imageFiles.length);
		imageFiles = [...imageFiles, ...validImages.slice(0, remainingSlots)];

		if (validImages.length > remainingSlots) {
			addToast({
				type: 'warning',
				message: 'Gallery posts are limited to 10 images at a time.'
			});
		}

		input.value = '';
	}

	async function submitGalleryPost() {
		if (isSubmitting || !$activeChannel?.id) return;
		if (imageFiles.length === 0) {
			addToast({
				type: 'warning',
				message: 'Add at least one image before posting.'
			});
			return;
		}

		isSubmitting = true;
		try {
			const attachments = [] as string[];
			for (const file of imageFiles) {
				const uploaded = await api.uploadAttachment(file, $activeChannel.id);
				attachments.push(uploaded.id);
			}

			const message = await api.sendMessage($activeChannel.id, {
				content: description.trim(),
				attachments
			});

			addMessage($activeChannel.id, message);
			description = '';
			imageFiles = [];
		} catch (error) {
			console.error('Failed to post gallery message:', error);
			addToast({
				type: 'error',
				message: 'Failed to post to gallery channel.'
			});
		} finally {
			isSubmitting = false;
		}
	}

	function handleDescriptionKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault();
			void submitGalleryPost();
		}
	}
</script>

<div class="flex-1 flex flex-col min-h-0">
	<!-- Channel header -->
	<div class="h-12 px-4 flex items-center gap-2 border-b border-border shrink-0">
		<Image size={20} class="text-text-muted" />
		<h2 class="font-semibold text-text-primary">{$activeChannel?.name || 'Gallery'}</h2>
		{#if $activeChannel?.topic}
			<span class="text-xs text-text-muted ml-2 truncate">{$activeChannel.topic}</span>
		{/if}
	</div>

	<!-- Gallery grid -->
	<div class="flex-1 overflow-y-auto p-4">
		{#if isLoading}
			<div class="flex items-center justify-center h-full">
				<Spinner size="lg" />
			</div>
		{:else if images.length === 0}
			<div class="flex flex-col items-center justify-center h-full text-center">
				<div class="w-20 h-20 rounded-full bg-surface flex items-center justify-center mb-4">
					<Image size={40} class="text-text-muted" />
				</div>
				<h3 class="text-lg font-semibold text-text-primary mb-2">No images yet</h3>
				<p class="text-text-muted max-w-sm">
					Share images in this channel and they'll appear here in a gallery view.
				</p>
			</div>
		{:else}
			<div
				class="grid gap-2"
				style="grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));"
			>
				{#each images as image (image.id)}
					<button
						onclick={() => openImage(image.url)}
						class="group relative aspect-square rounded-lg overflow-hidden bg-surface hover:ring-2 hover:ring-primary transition-all"
					>
						<img
							src={image.thumbnailUrl}
							alt={image.filename}
							class="w-full h-full object-cover"
							loading="lazy"
						/>
						<div class="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-end">
							<div class="w-full p-2 opacity-0 group-hover:opacity-100 transition-opacity">
								<p class="text-xs text-white truncate">{image.author?.displayName || image.author?.username}</p>
							</div>
						</div>
						<div class="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
							<Maximize2 size={16} class="text-white drop-shadow-md" />
						</div>
					</button>
				{/each}
			</div>
		{/if}
	</div>

	<!-- Gallery composer -->
	<div class="px-4 pb-4 pt-3 border-t border-border bg-background space-y-3">
		<input
			bind:this={imageInputRef}
			type="file"
			accept="image/*"
			multiple
			onchange={handleImageSelect}
			class="hidden"
		/>

		{#if imageFiles.length > 0}
			<div class="flex gap-2 overflow-x-auto pb-1">
				{#each imageFiles as file, index (`${file.name}-${index}`)}
					<div class="relative shrink-0 w-20 h-20 rounded-lg overflow-hidden border border-border bg-surface">
						<img src={URL.createObjectURL(file)} alt={file.name} class="w-full h-full object-cover" />
						<button
							onclick={() => removeImage(index)}
							class="absolute top-1 right-1 h-5 w-5 rounded-full bg-black/70 text-white flex items-center justify-center"
							aria-label="Remove image"
						>
							<X size={12} />
						</button>
					</div>
				{/each}
			</div>
		{/if}

		<div class="flex items-center gap-2 bg-surface border border-border rounded-lg px-2 py-2">
			<button
				onclick={openImagePicker}
				class="p-2 text-text-muted hover:text-text-primary transition-colors"
				title="Add images"
				disabled={isSubmitting}
			>
				<Upload size={18} />
			</button>

			<textarea
				bind:value={description}
				onkeydown={handleDescriptionKeydown}
                rows={1}
				placeholder="Add a description for this image post..."
				class="flex-1 bg-transparent text-text-primary placeholder-text-muted resize-none focus:outline-none"
				disabled={isSubmitting}
			></textarea>

			<button
				onclick={submitGalleryPost}
				class="p-2 text-primary hover:text-secondary disabled:text-text-muted disabled:cursor-not-allowed transition-colors"
				disabled={isSubmitting || imageFiles.length === 0}
				title="Post to gallery"
			>
				{#if isSubmitting}
					<Spinner size="sm" />
				{:else}
					<Send size={18} />
				{/if}
			</button>
		</div>
	</div>
</div>

<!-- Lightbox -->
{#if selectedImage}
	<button
		onclick={closeImage}
		class="fixed inset-0 z-50 bg-black/80 flex items-center justify-center cursor-zoom-out"
	>
		<img
			src={selectedImage}
			alt="Full size"
			class="max-w-[90vw] max-h-[90vh] object-contain rounded-lg"
		/>
	</button>
{/if}
