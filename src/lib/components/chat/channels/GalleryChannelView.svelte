<script lang="ts">
	import { onMount } from 'svelte';
	import { Image, Upload, Grid3x3, LayoutGrid, Maximize2 } from 'lucide-svelte';
	import { MessageInput } from '$lib/components/chat';
	import { Spinner } from '$lib/components/ui';
	import { activeChannel, activeChannelMessages } from '$lib/stores/community';
	import { api } from '$lib/api';
	import type { Message } from '$lib/types';

	// Pull layout preference from the channel's metadata
	let layout = $derived(
		($activeChannel?.metadata as Record<string, unknown>)?.layout === 'masonry' ? 'masonry' : 'grid'
	);

	let isLoading = $state(true);
	let selectedImage = $state<string | null>(null);

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

	<!-- Upload area -->
	<MessageInput channelId={$activeChannel?.id ?? ''} />
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
