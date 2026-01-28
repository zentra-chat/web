<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { Spinner } from '$lib/components/ui';
	import { Hash, Megaphone, Lock } from '$lib/components/icons';
	import MessageItem from './MessageItem.svelte';
	import { activeChannel, messages, setMessages, addMessage, removeMessage } from '$lib/stores/community';
	import { api, websocket } from '$lib/api';
	import type { Message, Channel } from '$lib/types';

	interface Props {
		channelId: string;
	}

	let { channelId }: Props = $props();

	let containerRef: HTMLDivElement | null = $state(null);
	let isLoading = $state(false);
	let isLoadingMore = $state(false);
	let hasMore = $state(true);
	let error = $state<string | null>(null);
	let isFirstLoad = $state(true);

	let channelMessages = $derived($messages[channelId] || []);

	$effect(() => {
		if (channelId) {
			isFirstLoad = true;
			loadMessages();

			// Subscribe to channel events
			websocket.subscribe(channelId);

			return () => {
				websocket.unsubscribe(channelId);
			};
		}
	});

	// Auto-scroll to bottom when new messages arrive
	$effect(() => {
		if (channelMessages.length && containerRef) {
			// If it's the first load, scroll to bottom immediately
			if (isFirstLoad) {
				tick().then(() => {
					if (containerRef) {
						containerRef.scrollTop = containerRef.scrollHeight;
						isFirstLoad = false;
					}
				});
				return;
			}

			// Check if user is near the bottom
			const isNearBottom =
				containerRef.scrollHeight - containerRef.scrollTop - containerRef.clientHeight < 150;

			if (isNearBottom) {
				tick().then(() => {
					containerRef?.scrollTo({
						top: containerRef.scrollHeight,
						behavior: 'smooth'
					});
				});
			}
		}
	});

	async function loadMessages() {
		if (!channelId) return;

		isLoading = true;
		error = null;

		try {
			const msgs = await api.getMessages(channelId);
			// API returns DESC, we want ASC for display
			const reversedMsgs = msgs ? [...msgs].reverse() : [];
			setMessages(channelId, reversedMsgs);
			hasMore = reversedMsgs.length >= 50;

			// Scroll to bottom after initial load
			await tick();
			if (containerRef) {
				containerRef.scrollTop = containerRef.scrollHeight;
			}
		} catch (err) {
			error = 'Failed to load messages';
			console.error('Failed to load messages:', err);
		} finally {
			isLoading = false;
		}
	}

	async function loadMoreMessages() {
		if (!hasMore || isLoadingMore || channelMessages.length === 0) return;

		isLoadingMore = true;
		const oldestMessage = channelMessages[0];
		const prevScrollHeight = containerRef?.scrollHeight || 0;

		try {
			const msgs = await api.getMessages(channelId, {
				before: oldestMessage.id,
				limit: 50
			});

			if (msgs && msgs.length > 0) {
				// msgs are DESC from API, we want to maintain ASC in our store
				const reversedMsgs = [...msgs].reverse();
				setMessages(channelId, [...reversedMsgs, ...channelMessages]);
				hasMore = msgs.length >= 50;

				// Maintain scroll position
				await tick();
				if (containerRef) {
					containerRef.scrollTop = containerRef.scrollHeight - prevScrollHeight;
				}
			} else {
				hasMore = false;
			}
		} catch (err) {
			console.error('Failed to load more messages:', err);
		} finally {
			isLoadingMore = false;
		}
	}

	function handleScroll() {
		if (!containerRef) return;

		// Load more when scrolled near top
		if (containerRef.scrollTop < 100 && hasMore && !isLoadingMore) {
			loadMoreMessages();
		}
	}

	function handleMessageDelete(messageId: string) {
		removeMessage(channelId, messageId);
	}

	function getChannelIcon(type: Channel['type']) {
		switch (type) {
			case 'announcement':
				return Megaphone;
			case 'private':
				return Lock;
			default:
				return Hash;
		}
	}
</script>

<div class="flex-1 flex flex-col min-h-0">
	<!-- Channel header -->
	{#if $activeChannel}
		{@const Icon = getChannelIcon($activeChannel.type)}
		<div class="h-12 px-4 flex items-center gap-2 border-b border-border shrink-0">
			<Icon size={20} class="text-text-muted" />
			<h2 class="font-semibold text-text-primary">{$activeChannel.name}</h2>
			{#if $activeChannel.description}
				<span class="text-text-muted mx-2">|</span>
				<p class="text-sm text-text-muted truncate">{$activeChannel.description}</p>
			{/if}
		</div>
	{/if}

	<!-- Messages container -->
	<div
		bind:this={containerRef}
		onscroll={handleScroll}
		class="flex-1 overflow-y-auto overflow-x-hidden"
	>
		{#if isLoading}
			<div class="flex items-center justify-center h-full">
				<Spinner size="lg" />
			</div>
		{:else if error}
			<div class="flex flex-col items-center justify-center h-full gap-4">
				<p class="text-error">{error}</p>
				<button
					onclick={loadMessages}
					class="px-4 py-2 bg-primary text-background rounded-lg hover:bg-secondary transition-colors"
				>
					Retry
				</button>
			</div>
		{:else if channelMessages.length === 0}
			<div class="flex flex-col items-center justify-center h-full text-center px-4">
				{#if $activeChannel}
					{@const Icon = getChannelIcon($activeChannel.type)}
					<div class="w-16 h-16 rounded-full bg-surface flex items-center justify-center mb-4">
						<Icon size={32} class="text-text-muted" />
					</div>
					<h3 class="text-xl font-semibold text-text-primary mb-2">
						Welcome to #{$activeChannel.name}!
					</h3>
					<p class="text-text-muted max-w-md">
						{$activeChannel.description || 'This is the start of this channel. Send a message to get the conversation going!'}
					</p>
				{/if}
			</div>
		{:else}
			<!-- Load more indicator -->
			{#if isLoadingMore}
				<div class="flex justify-center py-4">
					<Spinner size="sm" />
				</div>
			{:else if hasMore}
				<button
					onclick={loadMoreMessages}
					class="w-full py-2 text-sm text-text-muted hover:text-text-primary transition-colors"
				>
					Load more messages
				</button>
			{:else}
				<div class="flex flex-col items-center py-8 px-4 text-center">
					{#if $activeChannel}
						{@const Icon = getChannelIcon($activeChannel.type)}
						<div class="w-16 h-16 rounded-full bg-surface flex items-center justify-center mb-4">
							<Icon size={32} class="text-text-muted" />
						</div>
						<h3 class="text-xl font-semibold text-text-primary mb-2">
							Welcome to #{$activeChannel.name}!
						</h3>
						<p class="text-text-muted max-w-md mb-4">
							This is the beginning of the #{$activeChannel.name} channel.
						</p>
					{/if}
				</div>
			{/if}

			<!-- Messages -->
			{#each channelMessages as message, index (message.id)}
				<MessageItem
					{message}
					previousMessage={index > 0 ? channelMessages[index - 1] : undefined}
					onDelete={handleMessageDelete}
				/>
			{/each}

			<!-- Bottom padding -->
			<div class="h-6"></div>
		{/if}
	</div>
</div>
