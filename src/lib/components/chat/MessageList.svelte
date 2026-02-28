<script lang="ts">
	import { onMount } from 'svelte';
	import { tick } from 'svelte';
	import { Spinner, Avatar } from '$lib/components/ui';
	import { Hash, Megaphone, Lock, Users, Pin } from 'lucide-svelte';
	import MessageItem from './MessageItem.svelte';
	import {
		activeChannel,
		messages,
		setMessages,
		removeMessage
	} from '$lib/stores/community';
	import { showMemberSidebar, toggleMemberSidebar, addToast } from '$lib/stores/ui';
	import {
		activeDmConversation,
		dmMessagesCache,
		setDmMessages,
		removeDmMessage,
		clearDmUnread
	} from '$lib/stores/dm';
	import { currentUserId } from '$lib/stores/instance';
	import { api, websocket } from '$lib/api';
	import type { Message, Channel } from '$lib/types';

	interface Props {
		channelId?: string;
		dmConversationId?: string;
	}

	let { channelId, dmConversationId }: Props = $props();

	let containerRef: HTMLDivElement | null = $state(null);
	let isLoading = $state(false);
	let isLoadingMore = $state(false);
	let hasMore = $state(true);
	let error = $state<string | null>(null);
	let isFirstLoad = $state(true);
	let stickToBottomUntil = $state(0);
	let showPinnedDropdown = $state(false);
	let pinnedMessages = $state<Message[]>([]);
	let isLoadingPinned = $state(false);
	let pinnedError = $state<string | null>(null);
	let pinnedPanelRef: HTMLDivElement | null = $state(null);

	let isDm = $derived(!!dmConversationId);
	let channelMessages = $derived(
		dmConversationId
			? $dmMessagesCache[dmConversationId] || []
			: channelId
				? $messages[channelId] || []
				: []
	);

	onMount(() => {
		function handleOutsideClick(event: MouseEvent) {
			if (!showPinnedDropdown || !pinnedPanelRef) return;
			if (!pinnedPanelRef.contains(event.target as Node)) {
				showPinnedDropdown = false;
			}
		}

		document.addEventListener('mousedown', handleOutsideClick);
		return () => document.removeEventListener('mousedown', handleOutsideClick);
	});

	$effect(() => {
		const streamId = dmConversationId || channelId;
		if (streamId) {
			isFirstLoad = true;
			stickToBottomUntil = Date.now() + 1500;
			loadMessages();

			// Subscribe to channel events
			websocket.subscribe(streamId);

			return () => {
				websocket.unsubscribe(streamId);
			};
		}
	});

	// Auto-scroll to bottom when new messages arrive
	$effect(() => {
		if (channelMessages.length && containerRef) {
			// If it's the first load, scroll to bottom immediately
			if (isFirstLoad) {
				void forceScrollToBottom();
				isFirstLoad = false;
				return;
			}

			// Check if user is near the bottom
			const isNearBottom =
				containerRef.scrollHeight - containerRef.scrollTop - containerRef.clientHeight < 150;

			if (isNearBottom) {
				void scrollToBottom('smooth');
			}
		}
	});

	$effect(() => {
		if (!containerRef) return;

		const observer = new ResizeObserver(() => {
			if (!containerRef) return;
			if (Date.now() <= stickToBottomUntil) {
				containerRef.scrollTop = containerRef.scrollHeight;
			}
		});

		observer.observe(containerRef);

		return () => observer.disconnect();
	});

	async function scrollToBottom(behavior: ScrollBehavior = 'auto') {
		await tick();
		if (!containerRef) return;
		containerRef.scrollTo({
			top: containerRef.scrollHeight,
			behavior
		});
	}

	async function forceScrollToBottom() {
		await scrollToBottom('auto');
		setTimeout(() => {
			if (!containerRef) return;
			containerRef.scrollTop = containerRef.scrollHeight;
		}, 120);
		setTimeout(() => {
			if (!containerRef) return;
			containerRef.scrollTop = containerRef.scrollHeight;
		}, 320);
	}

	async function loadMessages() {
		const streamId = dmConversationId || channelId;
		if (!streamId) return;

		isLoading = true;
		error = null;

		try {
			const msgs = dmConversationId
				? await api.getDmMessages(dmConversationId)
				: await api.getMessages(channelId as string);
			const reversedMsgs = msgs ? [...msgs].reverse() : [];
			if (dmConversationId) {
				setDmMessages(dmConversationId, reversedMsgs);
				clearDmUnread(dmConversationId);
				await api.markDmRead(dmConversationId);
			} else if (channelId) {
				setMessages(channelId, reversedMsgs);
			}
			hasMore = reversedMsgs.length >= 50;

			// Scroll to bottom after initial load
			await forceScrollToBottom();
		} catch (err) {
			error = 'Failed to load messages';
			console.error('Failed to load messages:', err);
		} finally {
			isLoading = false;
		}
	}

	async function loadMoreMessages() {
		if (!hasMore || isLoadingMore || channelMessages.length === 0) return;
		const streamId = dmConversationId || channelId;
		if (!streamId) return;

		isLoadingMore = true;
		const oldestMessage = channelMessages[0];
		const prevScrollHeight = containerRef?.scrollHeight || 0;

		try {
			const msgs = dmConversationId
				? await api.getDmMessages(dmConversationId, {
					before: oldestMessage.id,
					limit: 50
				})
				: await api.getMessages(channelId as string, {
					before: oldestMessage.id,
					limit: 50
				});

			if (msgs && msgs.length > 0) {
				const reversedMsgs = [...msgs].reverse();
				if (dmConversationId) {
					setDmMessages(dmConversationId, [...reversedMsgs, ...channelMessages]);
				} else if (channelId) {
					setMessages(channelId, [...reversedMsgs, ...channelMessages]);
				}
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
		if (dmConversationId) {
			removeDmMessage(dmConversationId, messageId);
			return;
		}
		if (channelId) {
			removeMessage(channelId, messageId);
		}
	}

	async function handleDeleteRequest(messageId: string) {
		if (dmConversationId) {
			await api.deleteDmMessage(messageId);
			return;
		}
		await api.deleteMessage(messageId);
	}

	async function handleReactionToggle(messageId: string, emoji: string, reacted: boolean) {
		if (!dmConversationId) return;
		if (reacted) {
			await api.removeDmReaction(messageId, emoji);
			return;
		}
		await api.addDmReaction(messageId, emoji);
	}

	async function togglePinnedDropdown() {
		if (!channelId || isDm) return;

		if (showPinnedDropdown) {
			showPinnedDropdown = false;
			return;
		}

		showPinnedDropdown = true;
		isLoadingPinned = true;
		pinnedError = null;

		try {
			pinnedMessages = await api.getPinnedMessages(channelId) || [];
		} catch (err) {
			console.error('Failed to load pinned messages:', err);
			pinnedError = 'Failed to load pinned messages';
		} finally {
			isLoadingPinned = false;
		}
	}

	function previewMessage(message: Message): string {
		const content = message.content?.trim();
		if (content) return content;
		if (message.attachments?.length) return '[Attachment message]';
		return '[No text content]';
	}

	async function jumpToMessage(messageId: string) {
		await tick();
		const target = document.getElementById(`message-container-${messageId}`);
		if (!target) {
			addToast({
				type: 'warning',
				message: 'Message is not in the currently loaded history yet. Load older messages first.'
			});
			return;
		}

		showPinnedDropdown = false;
		target.scrollIntoView({ behavior: 'smooth', block: 'center' });
		
		target.classList.add('bg-surface/90', 'ring-1', 'ring-primary/30');
		setTimeout(() => {
			target.classList.remove('bg-surface/90', 'ring-1', 'ring-primary/30');
		}, 1600);
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

	function getDmHeaderName(): string {
		if (!$activeDmConversation) return 'Direct Messages';
		const otherUser = $activeDmConversation.participants.find((p) => p.id !== $currentUserId);
		return otherUser?.displayName || otherUser?.username || 'Direct Messages';
	}
</script>

<div class="flex-1 flex flex-col min-h-0">
	<!-- Channel header -->
	{#if isDm}
		<div class="h-12 px-4 flex items-center gap-2 border-b border-border shrink-0">
			<h2 class="font-semibold text-text-primary">{getDmHeaderName()}</h2>
		</div>
	{:else if $activeChannel}
		{@const Icon = getChannelIcon($activeChannel.type)}
		<div class="h-12 px-4 flex items-center gap-2 border-b border-border shrink-0">
			<Icon size={20} class="text-text-muted" />
			<h2 class="font-semibold text-text-primary">{$activeChannel.name}</h2>
			{#if $activeChannel.topic}
				<span class="text-text-muted mx-2">|</span>
				<p class="text-sm text-text-muted truncate">{$activeChannel.topic}</p>
			{/if}

			<div class="ml-auto flex items-center gap-2">
				<div class="relative" bind:this={pinnedPanelRef}>
					<button
						onclick={togglePinnedDropdown}
						class="p-2 text-text-muted hover:text-text-primary transition-colors"
						title="Pinned Messages"
					>
						<Pin size={20} />
					</button>

					{#if showPinnedDropdown}
						<div
							class="absolute right-0 top-full mt-2 w-96 max-h-104 flex flex-col bg-surface border border-border rounded-xl shadow-2xl z-50 overflow-hidden"
							role="dialog"
							aria-label="Pinned messages"
						>
							<div class="px-4 py-3 border-b border-border flex items-center justify-between">
								<h3 class="text-sm font-semibold text-text-primary">Pinned Messages</h3>
								<span class="text-xs text-text-muted">{pinnedMessages.length}</span>
							</div>

							<div class="flex-1 overflow-y-auto p-2 space-y-2">
								{#if isLoadingPinned}
									<div class="flex items-center justify-center py-8">
										<Spinner size="md" />
									</div>
								{:else if pinnedError}
									<div class="p-3 text-sm text-error">{pinnedError}</div>
								{:else if pinnedMessages.length === 0}
									<div class="p-3 text-sm text-text-muted">No pinned messages in this channel.</div>
								{:else}
									{#each pinnedMessages as pinned (pinned.id)}
										<button
											onclick={() => jumpToMessage(pinned.id)}
											class="w-full text-left p-3 border border-border rounded-lg bg-surface/40 hover:bg-surface-hover transition-colors"
										>
											<div class="flex items-start gap-2">
												<Avatar user={pinned.author} size="sm" />
												<div class="min-w-0 flex-1">
													<div class="flex items-center gap-2">
														<p class="text-sm font-medium text-text-primary truncate">
															{pinned.author?.displayName || pinned.author?.username || 'Unknown user'}
														</p>
														<p class="text-[11px] text-text-muted shrink-0">
															{new Date(pinned.createdAt).toLocaleString()}
														</p>
													</div>
													<p class="text-sm text-text-secondary mt-0.5 line-clamp-3 whitespace-pre-wrap wrap-break-word">
														{previewMessage(pinned)}
													</p>
												</div>
											</div>
										</button>
									{/each}
								{/if}
							</div>
						</div>
					{/if}
				</div>
				<button
					onclick={toggleMemberSidebar}
					class="p-2 {$showMemberSidebar
						? 'text-text-primary'
						: 'text-text-muted'} hover:text-text-primary transition-colors"
					title={$showMemberSidebar ? 'Hide Member List' : 'Show Member List'}
				>
					<Users size={20} />
				</button>
			</div>
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
				{#if isDm}
					{@const otherName = getDmHeaderName()}
					<div class="w-16 h-16 rounded-full bg-surface flex items-center justify-center mb-4">
						<Users size={32} class="text-text-muted" />
					</div>
					<h3 class="text-xl font-semibold text-text-primary mb-2">
						Start a conversation with {otherName}
					</h3>
					<p class="text-text-muted max-w-md">
						Send a message to get things going.
					</p>
				{:else if $activeChannel}
					{@const Icon = getChannelIcon($activeChannel.type)}
					<div class="w-16 h-16 rounded-full bg-surface flex items-center justify-center mb-4">
						<Icon size={32} class="text-text-muted" />
					</div>
					<h3 class="text-xl font-semibold text-text-primary mb-2">
						Welcome to #{$activeChannel.name}!
					</h3>
					<p class="text-text-muted max-w-md">
						{$activeChannel.topic || 'This is the start of this channel. Send a message to get the conversation going!'}
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
					{#if isDm}
						{@const otherName = getDmHeaderName()}
						<div class="w-16 h-16 rounded-full bg-surface flex items-center justify-center mb-4">
							<Users size={32} class="text-text-muted" />
						</div>
						<h3 class="text-xl font-semibold text-text-primary mb-2">
							Start a conversation with {otherName}
						</h3>
						<p class="text-text-muted max-w-md mb-4">
							This is the beginning of your DM.
						</p>
					{:else if $activeChannel}
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
				<div id={`message-${message.id}`}>
					<MessageItem
						{message}
						previousMessage={index > 0 ? channelMessages[index - 1] : undefined}
						onDelete={handleMessageDelete}
						onDeleteRequest={isDm ? handleDeleteRequest : undefined}
						onReactionToggle={isDm ? handleReactionToggle : undefined}
						enableReactions={true}
						enableReply={true}
						isDm={isDm}
					/>
				</div>
			{/each}

			<!-- Bottom padding -->
			<div class="h-6"></div>
		{/if}
	</div>
</div>
