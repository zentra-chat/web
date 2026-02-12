<script lang="ts">
	import { format, isToday, isYesterday, isSameDay } from 'date-fns';
	import { Avatar, Spinner, Modal, Button } from '$lib/components/ui';
	import { Edit, Trash, Reply, Pin, Paperclip, Image, File, Smile } from 'lucide-svelte';
	import type { Message } from '$lib/types';
	import { currentUserId } from '$lib/stores/instance';
	import { activeCommunityMembers, getMemberNameColor, memberHasPermission, Permission } from '$lib/stores/community';
	import {
		setEditingMessage,
		setReplyingTo,
		filePreviewOpen,
		filePreviewData,
		openProfileCard
	} from '$lib/stores/ui';
	import { api } from '$lib/api';
	import EmojiPicker from './EmojiPicker.svelte';
	import { renderMarkdown } from '$lib/utils/markdown';

	interface Props {
		message: Message;
		previousMessage?: Message;
		onDelete?: (messageId: string) => void;
		onDeleteRequest?: (messageId: string) => Promise<void>;
		onReactionToggle?: (messageId: string, emoji: string, reacted: boolean) => Promise<void>;
		enableReactions?: boolean;
		enableReply?: boolean;
		isDm?: boolean;
	}

	let {
		message,
		previousMessage,
		onDelete,
		onDeleteRequest,
		onReactionToggle,
		enableReactions = true,
		enableReply = true,
		isDm = false
	}: Props = $props();

	let isHovered = $state(false);
	let isDeleting = $state(false);
	let showActionBarPicker = $state(false);
	let showReactionsPicker = $state(false);
	let showDeleteConfirm = $state(false);

	let isOwnMessage = $derived(message.authorId === $currentUserId);
	let hasContent = $derived(!!message.content && message.content.trim().length > 0);
	let myMember = $derived.by(() => $activeCommunityMembers.find((m) => m.userId === $currentUserId) || null);
	let canModerateMessages = $derived(!isDm && memberHasPermission(myMember, Permission.ManageMessages));
	let canDeleteMessage = $derived(isOwnMessage || canModerateMessages);
	let authorMember = $derived.by(() => $activeCommunityMembers.find((m) => m.userId === message.authorId) || null);
	let authorColor = $derived(getMemberNameColor(authorMember));
	let replyColor = $derived.by(() => {
		if (!message.replyTo?.authorId) return null;
		const replyMember = $activeCommunityMembers.find((m) => m.userId === message.replyTo?.authorId) || null;
		return getMemberNameColor(replyMember);
	});

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

	async function performDelete() {
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

	function requestDelete(event?: MouseEvent) {
		if (isDeleting) return;
		if (event?.shiftKey) {
			showDeleteConfirm = false;
			void performDelete();
			return;
		}
		showDeleteConfirm = true;
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
			if (onReactionToggle) {
				await onReactionToggle(message.id, emoji, reacted);
				return;
			}
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
		const contentType = attachment.contentType || '';
		const isPreviewable = previewableTypes.some(type => contentType.startsWith(type));

		if (isPreviewable) {
			event.preventDefault();
			filePreviewData.set(attachment);
			filePreviewOpen.set(true);
		}
	}

	function formatFileSize(bytes: number): string {
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
		return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	}

	function getPreviewSite(url: string, siteName?: string | null): string {
		if (siteName && siteName.trim().length > 0) return siteName;
		try {
			return new URL(url).hostname;
		} catch {
			return url;
		}
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
			<span class="font-medium" style={replyColor ? `color: ${replyColor}` : undefined}>
				{message.replyTo.author?.displayName || message.replyTo.author?.username}
			</span>
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
						style={authorColor ? `color: ${authorColor}` : undefined}
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
			{#if hasContent}
				<div class="message-content text-text-secondary">
					{@html renderMarkdown(message.content || '')}
				</div>
				{#if message.isEdited}
					<div class="text-xs text-text-muted mt-1">(edited)</div>
				{/if}
			{/if}

			<!-- Link previews -->
			{#if message.linkPreviews && message.linkPreviews.length > 0}
				<div class="mt-2 flex flex-col gap-2">
					{#each message.linkPreviews as preview}
						<a
							href={preview.url}
							target="_blank"
							rel="noopener noreferrer"
							class="group/link-preview block max-w-xl rounded-lg border border-border bg-surface/60 hover:border-primary transition-colors"
						>
							<div class="flex gap-3 p-3">
								{#if preview.imageUrl}
									<img
										src={preview.imageUrl}
										alt={preview.title || getPreviewSite(preview.url, preview.siteName)}
										class="h-20 w-28 rounded-md object-cover border border-border"
									/>
								{/if}
								<div class="min-w-0">
									<div class="flex items-center gap-2 text-xs text-text-muted">
										{#if preview.faviconUrl}
											<img src={preview.faviconUrl} alt="" class="h-4 w-4 rounded-sm" />
										{/if}
										<span class="truncate">{getPreviewSite(preview.url, preview.siteName)}</span>
									</div>
									{#if preview.title}
										<div class="mt-1 text-sm font-semibold text-text-primary truncate">
											{preview.title}
										</div>
									{/if}
									{#if preview.description}
										<p class="mt-1 text-xs text-text-muted">
											{preview.description}
										</p>
									{/if}
								</div>
							</div>
						</a>
					{/each}
				</div>
			{/if}

			<!-- Attachments -->
			{#if message.attachments && message.attachments.length > 0}
				<div class="{hasContent ? 'mt-2' : ''} flex flex-wrap gap-2">
					{#each message.attachments as attachment}
						{#if attachment.contentType?.startsWith('image/')}
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
			{/if}
			{#if canDeleteMessage}
				<button
					onclick={(e) => requestDelete(e)}
					class="p-2 text-text-muted hover:text-error hover:bg-surface-hover transition-colors"
					aria-label="Delete"
					title="Hold Shift to delete without confirmation"
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

<Modal
	isOpen={showDeleteConfirm}
	onclose={() => (showDeleteConfirm = false)}
	title="Delete Message"
	size="sm"
>
	<div class="space-y-4">
		<p class="text-sm text-text-secondary">Delete this message? This can’t be undone.</p>
		<div class="flex justify-end gap-2">
			<Button variant="ghost" onclick={() => (showDeleteConfirm = false)} disabled={isDeleting}>
				Cancel
			</Button>
			<Button
				variant="danger"
				onclick={() => {
					showDeleteConfirm = false;
					void performDelete();
				}}
				disabled={isDeleting}
			>
				Delete
			</Button>
		</div>
	</div>
</Modal>
