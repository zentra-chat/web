<script lang="ts">
	import { format, isToday, isYesterday, isSameDay } from 'date-fns';
	import { Avatar, Spinner } from '$lib/components/ui';
	import { Edit, Trash, Reply, Pin, Paperclip, Image, File, Smile } from '$lib/components/icons';
	import type { Message } from '$lib/types';
	import { currentUserId } from '$lib/stores/instance';
	import {
		setEditingMessage,
		setReplyingTo,
		filePreviewOpen,
		filePreviewData,
		openProfileCard
	} from '$lib/stores/ui';
	import { api } from '$lib/api';
	import EmojiPicker from './EmojiPicker.svelte';

	interface Props {
		message: Message;
		previousMessage?: Message;
		onDelete?: (messageId: string) => void;
		onDeleteRequest?: (messageId: string) => Promise<void>;
		enableReactions?: boolean;
		enableReply?: boolean;
	}

	let {
		message,
		previousMessage,
		onDelete,
		onDeleteRequest,
		enableReactions = true,
		enableReply = true
	}: Props = $props();

	let isHovered = $state(false);
	let isDeleting = $state(false);
	let showActionBarPicker = $state(false);
	let showReactionsPicker = $state(false);

	let isOwnMessage = $derived(message.authorId === $currentUserId);

	// Check if we should show the header (avatar + name)
	let showHeader = $derived.by(() => {
		if (!previousMessage) return true;
		if (previousMessage.authorId !== message.authorId) return true;

		// Show header if messages are more than 5 minutes apart
		const prevTime = new Date(previousMessage.createdAt).getTime();
		const currTime = new Date(message.createdAt).getTime();
		return currTime - prevTime > 5 * 60 * 1000;
	});

	// Check if we should show date divider
	let showDateDivider = $derived.by(() => {
		if (!previousMessage) return true;
		return !isSameDay(new Date(previousMessage.createdAt), new Date(message.createdAt));
	});

	function formatTimestamp(date: Date): string {
		if (isToday(date)) {
			return `Today at ${format(date, 'h:mm a')}`;
		}
		if (isYesterday(date)) {
			return `Yesterday at ${format(date, 'h:mm a')}`;
		}
		return format(date, 'MM/dd/yyyy h:mm a');
	}

	function formatDateDivider(date: Date): string {
		if (isToday(date)) return 'Today';
		if (isYesterday(date)) return 'Yesterday';
		return format(date, 'MMMM d, yyyy');
	}

	async function handleDelete() {
		if (!confirm('Are you sure you want to delete this message?')) return;

		isDeleting = true;
		try {
			if (onDeleteRequest) {
				await onDeleteRequest(message.id);
			} else {
				await api.deleteMessage(message.id);
			}
			onDelete?.(message.id);
		} catch (err) {
			console.error('Failed to delete message:', err);
		} finally {
			isDeleting = false;
		}
	}

	function handleEdit() {
		setEditingMessage(message.id);
	}

	function handleReply() {
		if (!enableReply) return;
		setReplyingTo(message);
	}

	async function handleReactionSelect(emoji: string) {
		showActionBarPicker = false;
		showReactionsPicker = false;
		const existingReaction = message.reactions?.find((r) => r.emoji === emoji);
		handleToggleReaction(emoji, !!existingReaction?.reacted);
	}

	async function handleToggleReaction(emoji: string, reacted: boolean) {
		if (!enableReactions) return;
		try {
			if (reacted) {
				await api.removeReaction(message.id, emoji);
			} else {
				await api.addReaction(message.id, emoji);
			}
		} catch (err) {
			console.error('Failed to toggle reaction:', err);
		}
	}

	function handleFileClick(event: MouseEvent, attachment: any) {
		const previewableTypes = ['text/', 'application/json', 'application/javascript', 'application/x-typescript'];
		const contentType = attachment.contentType || attachment.mimeType || '';
		const isPreviewable = previewableTypes.some(type => contentType.startsWith(type));

		if (isPreviewable) {
			event.preventDefault();
			filePreviewData.set(attachment);
			filePreviewOpen.set(true);
		}
	}

	function getFileIcon(mimeType: string) {
		if (mimeType.startsWith('image/')) return Image;
		return File;
	}

	function formatFileSize(bytes: number): string {
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
		return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	}
</script>

{#if showDateDivider}
	<div class="flex items-center gap-4 py-2 px-4">
		<div class="flex-1 h-px bg-border"></div>
		<span class="text-xs font-medium text-text-muted">
			{formatDateDivider(new Date(message.createdAt))}
		</span>
		<div class="flex-1 h-px bg-border"></div>
	</div>
{/if}

<div
	class="group relative px-4 py-0.5 hover:bg-surface/50 transition-colors {showHeader ? 'mt-4' : ''}"
	onmouseenter={() => (isHovered = true)}
	onmouseleave={() => (isHovered = false)}
	role="article"
>
	<!-- Reply reference -->
	{#if message.replyTo}
		<div class="flex items-center gap-2 ml-12 mb-1 text-xs text-text-muted">
			<Reply size={12} class="rotate-180" />
			<Avatar user={message.replyTo.author} size="xs" />
			<span class="font-medium">{message.replyTo.author?.displayName || message.replyTo.author?.username}</span>
			<span class="truncate max-w-md">{message.replyTo.content}</span>
		</div>
	{/if}

	<div class="flex gap-4">
		<!-- Avatar or timestamp -->
		<div class="w-10 shrink-0">
			{#if showHeader}
				<button 
					class="block transition-transform active:scale-95" 
					onclick={(e) => message.author && openProfileCard(message.author, e)}
				>
					<Avatar user={message.author} size="md" />
				</button>
			{:else if isHovered}
				<span class="text-[10px] text-text-muted">
					{format(new Date(message.createdAt), 'h:mm a')}
				</span>
			{/if}
		</div>

		<!-- Content -->
		<div class="flex-1 min-w-0">
			{#if showHeader}
				<div class="flex items-baseline gap-2 mb-1">
					<button 
						class="font-medium text-text-primary hover:underline cursor-pointer bg-transparent border-none p-0 text-left"
						onclick={(e) => message.author && openProfileCard(message.author, e)}
					>
						{message.author?.displayName || message.author?.username || 'Unknown'}
					</button>
					<span class="text-xs text-text-muted">
						{formatTimestamp(new Date(message.createdAt))}
					</span>
					{#if message.isPinned}
						<Pin size={12} class="text-primary" />
					{/if}
				</div>
			{/if}

			<!-- Message content -->
			<div class="text-text-secondary wrap-break-word whitespace-pre-wrap">
				{message.content}
				{#if message.isEdited}
					<span class="text-xs text-text-muted ml-1">(edited)</span>
				{/if}
			</div>

			<!-- Attachments -->
			{#if message.attachments && message.attachments.length > 0}
				<div class="mt-2 flex flex-wrap gap-2">
					{#each message.attachments as attachment}
						{#if (attachment.contentType || attachment.mimeType)?.startsWith('image/')}
							<a
								href={attachment.url}
								target="_blank"
								rel="noopener noreferrer"
								class="block max-w-md rounded-lg overflow-hidden border border-border hover:border-primary transition-colors"
							>
								<img
									src={attachment.url}
									alt={attachment.filename}
									class="max-h-80 object-contain"
								/>
							</a>
						{:else}
							<a
								href={attachment.url}
								target="_blank"
								rel="noopener noreferrer"
								class="flex items-center gap-2 p-3 bg-surface border border-border rounded-lg hover:border-primary transition-colors"
								onclick={(e) => handleFileClick(e, attachment)}
							>
								<File size={24} class="text-text-muted" />
								<div class="min-w-0">
									<p class="text-sm text-text-primary truncate">{attachment.filename}</p>
									<p class="text-xs text-text-muted">{formatFileSize(attachment.size)}</p>
								</div>
							</a>
						{/if}
					{/each}
				</div>
			{/if}

			<!-- Reactions -->
			{#if enableReactions && message.reactions && message.reactions.length > 0}
				<div class="mt-2 flex flex-wrap gap-1">
					{#each message.reactions as reaction}
						<button
							onclick={() => handleToggleReaction(reaction.emoji, reaction.reacted)}
							class="flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-xs font-medium transition-colors {reaction.reacted ? 'bg-primary/10 border-primary text-primary' : 'bg-surface border-border text-text-muted hover:border-text-muted'}"
						>
							<span>{reaction.emoji}</span>
							<span>{reaction.count}</span>
						</button>
					{/each}
					<div class="relative">
						{#if showReactionsPicker}
							<div class="absolute bottom-full left-0 mb-4 z-50">
								<EmojiPicker
									align="left"
									onSelect={handleReactionSelect}
									onClose={() => (showReactionsPicker = false)}
								/>
							</div>
						{/if}
						<button
							onclick={() => (showReactionsPicker = !showReactionsPicker)}
							class="flex items-center justify-center w-7 h-6 rounded-full border border-border bg-surface text-text-muted hover:border-text-muted transition-colors"
						>
							<Smile size={14} />
						</button>
					</div>
				</div>
			{/if}
		</div>
	</div>

	<!-- Action buttons -->
	{#if (isHovered || showActionBarPicker) && !isDeleting}
		<div
			class="absolute -top-4 right-4 flex items-center bg-surface border border-border rounded shadow-lg z-10"
		>
			{#if showActionBarPicker}
				<div class="absolute bottom-full right-0 mb-2">
					<EmojiPicker
						onSelect={handleReactionSelect}
						onClose={() => (showActionBarPicker = false)}
					/>
				</div>
			{/if}
			{#if enableReactions}
				<button
					onclick={() => (showActionBarPicker = !showActionBarPicker)}
					class="p-2 text-text-muted hover:text-text-primary hover:bg-surface-hover transition-colors"
					aria-label="Add Reaction"
				>
					<Smile size={16} />
				</button>
			{/if}
			{#if enableReply}
				<button
					onclick={handleReply}
					class="p-2 text-text-muted hover:text-text-primary hover:bg-surface-hover transition-colors"
					aria-label="Reply"
				>
					<Reply size={16} />
				</button>
			{/if}
			{#if isOwnMessage}
				<button
					onclick={handleEdit}
					class="p-2 text-text-muted hover:text-text-primary hover:bg-surface-hover transition-colors"
					aria-label="Edit"
				>
					<Edit size={16} />
				</button>
				<button
					onclick={handleDelete}
					class="p-2 text-text-muted hover:text-error hover:bg-surface-hover transition-colors"
					aria-label="Delete"
				>
					<Trash size={16} />
				</button>
			{/if}
		</div>
	{/if}

	{#if isDeleting}
		<div class="absolute inset-0 bg-background/50 flex items-center justify-center">
			<Spinner size="sm" />
		</div>
	{/if}
</div>
