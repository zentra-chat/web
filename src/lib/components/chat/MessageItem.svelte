<script lang="ts">
	import { format, isToday, isYesterday, isSameDay } from 'date-fns';
	import { Avatar, Spinner, Modal, Button } from '$lib/components/ui';
	import { Edit, Trash, Reply, Pin, Paperclip, Image, File, Smile } from 'lucide-svelte';
	import type { Attachment, Message } from '$lib/types';
	import { currentUserId } from '$lib/stores/instance';
	import {
		activeCommunityMembers,
		activeChannelId,
		getMemberNameColor,
		memberHasPermission,
		Permission,
		updateMessage
	} from '$lib/stores/community';
	import { activeDmConversation } from '$lib/stores/dm';
	import {
		setEditingMessage,
		setReplyingTo,
		filePreviewOpen,
		filePreviewData,
		openProfileCard,
		openContextMenu,
		addToast
	} from '$lib/stores/ui';
	import { api } from '$lib/api';
	import EmojiPicker from './EmojiPicker.svelte';
	import { renderMarkdown, type MentionResolver, type EmojiResolver } from '$lib/utils/markdown';
	import { customEmojiById } from '$lib/stores/emoji';

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
	let isPinning = $state(false);
	let showActionBarPicker = $state(false);
	let showReactionsPicker = $state(false);
	let showDeleteConfirm = $state(false);

	let isOwnMessage = $derived(message.authorId === $currentUserId);
	let hasContent = $derived(!!message.content && message.content.trim().length > 0);
	let myMember = $derived.by(() => $activeCommunityMembers.find((m) => m.userId === $currentUserId) || null);
	let canModerateMessages = $derived(!isDm && memberHasPermission(myMember, Permission.ManageMessages));
	let canPinMessages = $derived(!isDm && memberHasPermission(myMember, Permission.PinMessages));
	let canDeleteMessage = $derived(isOwnMessage || canModerateMessages);
	let authorMember = $derived.by(() => $activeCommunityMembers.find((m) => m.userId === message.authorId) || null);
	let authorColor = $derived(getMemberNameColor(authorMember));
	let replyColor = $derived.by(() => {
		if (!message.replyTo?.authorId) return null;
		const replyMember = $activeCommunityMembers.find((m) => m.userId === message.replyTo?.authorId) || null;
		return getMemberNameColor(replyMember);
	});

	// Mention resolver for markdown rendering
	let mentionResolver = $derived.by((): MentionResolver => {
		if (isDm) {
			const participants = $activeDmConversation?.participants ?? [];
			return {
				getUserName: (id) => {
					const user = participants.find((participant) => participant.id === id);
					return user ? (user.displayName ?? user.username) : null;
				},
				getRoleName: () => null
			};
		}

		const members = $activeCommunityMembers;
		// Collect all unique roles from members
		const rolesById = new Map<string, string>();
		for (const m of members) {
			for (const r of m.roles ?? []) {
				rolesById.set(r.id, r.name);
			}
		}
		return {
			getUserName: (id) => {
				const m = members.find((x) => x.userId === id);
				return m ? (m.nickname ?? m.user?.displayName ?? m.user?.username ?? null) : null;
			},
			getRoleName: (id) => rolesById.get(id) ?? null
		};
	});

	// Custom emoji resolver for rendering <:name:id> tokens in messages
	let emojiResolver = $derived.by((): EmojiResolver => {
		const lookup = $customEmojiById;
		// Build a name-based lookup for :shortcode: resolution too
		const byName = new Map<string, typeof lookup extends Map<string, infer V> ? V : never>();
		for (const [, emoji] of lookup) {
			byName.set(emoji.name.toLowerCase(), emoji);
		}
		return {
			getCustomEmoji: (id) => {
				const emoji = lookup.get(id);
				if (!emoji) return null;
				return { name: emoji.name, imageUrl: emoji.imageUrl };
			},
			getCustomEmojiByName: (name) => {
				const emoji = byName.get(name.toLowerCase());
				if (!emoji) return null;
				return { name: emoji.name, imageUrl: emoji.imageUrl };
			}
		};
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

	async function handlePinToggle() {
		if (isDm || !canPinMessages || isPinning) return;

		isPinning = true;
		const nextPinnedState = !message.isPinned;

		try {
			if (nextPinnedState) {
				await api.pinMessage(message.id);
			} else {
				await api.unpinMessage(message.id);
			}

			if ($activeChannelId) {
				updateMessage($activeChannelId, message.id, { isPinned: nextPinnedState });
			}
		} catch (err) {
			console.error('Failed to toggle pin state:', err);
			addToast({
				type: 'error',
				message: nextPinnedState ? 'Failed to pin message' : 'Failed to unpin message'
			});
		} finally {
			isPinning = false;
		}
	}

	async function handleReactionSelect(emoji: string, options?: { keepOpen?: boolean }) {
		if (!options?.keepOpen) {
			showActionBarPicker = false;
			showReactionsPicker = false;
		}
		const existingReaction = message.reactions?.find((r) => r.emoji === emoji);
		await handleToggleReaction(emoji, !!existingReaction?.reacted);
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

	function handleFileClick(event: MouseEvent, attachment: Attachment) {
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

	function isVideoAttachment(attachment: Attachment): boolean {
		const contentType = attachment.contentType?.toLowerCase() ?? '';
		return contentType.startsWith('video/');
	}

	function isAudioAttachment(attachment: Attachment): boolean {
		const contentType = attachment.contentType?.toLowerCase() ?? '';
		return contentType.startsWith('audio/');
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
	<div class="flex items-center gap-4 py-2 px-4 select-none">
		<div class="flex-1 h-px bg-border"></div>
		<span class="text-xs font-medium text-text-muted">
			{formatDateDivider(new Date(message.createdAt))}
		</span>
		<div class="flex-1 h-px bg-border"></div>
	</div>
{/if}

<div
	id="message-container-{message.id}"
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

	<div class="flex items-start gap-4">
		<!-- Avatar or timestamp -->
		<div class="w-10 shrink-0 flex justify-end {showHeader ? 'items-start pt-0.5' : 'self-stretch items-center'}">
			{#if showHeader}
				<button 
					class="block transition-transform active:scale-95" 
					onclick={(e) => message.author && openProfileCard(message.author, e)}
					oncontextmenu={(e) => message.author && openContextMenu(message.author, e)}
				>
					<Avatar user={message.author} size="md" />
				</button>
			{:else if isHovered}
				<span class="text-[10px] leading-none whitespace-nowrap text-text-muted">
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
						oncontextmenu={(e) => message.author && openContextMenu(message.author, e)}
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
					{@html renderMarkdown(message.content || '', mentionResolver, emojiResolver)}
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
						{:else if isVideoAttachment(attachment)}
							<div class="w-full max-w-xl rounded-lg overflow-hidden border border-border bg-surface/60">
								<video
									src={attachment.url}
									controls
									playsinline
									preload="metadata"
									class="w-full max-h-100 bg-background"
								>
									<track kind="captions" />
									<a href={attachment.url} target="_blank" rel="noopener noreferrer">{attachment.filename}</a>
								</video>
								<div class="px-3 py-2 border-t border-border">
									<p class="text-sm text-text-primary truncate">{attachment.filename}</p>
									<p class="text-xs text-text-muted">{formatFileSize(attachment.size)}</p>
								</div>
							</div>
						{:else if isAudioAttachment(attachment)}
							<div class="w-full max-w-xl p-3 bg-surface border border-border rounded-lg">
								<p class="text-sm text-text-primary truncate mb-2">{attachment.filename}</p>
								<audio
									src={attachment.url}
									controls
									preload="metadata"
									class="w-full"
								>
									<a href={attachment.url} target="_blank" rel="noopener noreferrer">{attachment.filename}</a>
								</audio>
								<p class="text-xs text-text-muted mt-2">{formatFileSize(attachment.size)}</p>
							</div>
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
						{@const customMatch = reaction.emoji.match(/^<:([^:]+):([0-9a-f-]+)>$/)}
						{@const customEmoji = customMatch ? $customEmojiById.get(customMatch[2]) : null}
						<button
							onclick={() => handleToggleReaction(reaction.emoji, reaction.reacted)}
							class="flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-xs font-medium transition-colors {reaction.reacted ? 'bg-primary/10 border-primary text-primary' : 'bg-surface border-border text-text-muted hover:border-text-muted'}"
						>
							{#if customEmoji}
								<img src={customEmoji.imageUrl} alt={`:${customEmoji.name}:`} class="w-4 h-4 object-contain" />
							{:else}
								<span>{reaction.emoji}</span>
							{/if}
							<span>{reaction.count}</span>
						</button>
					{/each}
					<div class="relative">
						{#if showReactionsPicker}
							<div class="absolute bottom-full left-0 mb-4 z-50">
								<EmojiPicker
									align="left"
									customEmojiFormat="reaction"
									onSelect={handleReactionSelect}
									onClose={() => (showReactionsPicker = false)}
								/>
							</div>
						{/if}
						<button
							onclick={() => (showReactionsPicker = !showReactionsPicker)}
							data-emoji-picker-trigger="true"
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
						customEmojiFormat="reaction"
						onSelect={handleReactionSelect}
						onClose={() => (showActionBarPicker = false)}
					/>
				</div>
			{/if}
			{#if enableReactions}
				<button
					onclick={() => (showActionBarPicker = !showActionBarPicker)}
					data-emoji-picker-trigger="true"
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
			{#if canPinMessages}
				<button
					onclick={handlePinToggle}
					class="p-2 text-text-muted hover:text-text-primary hover:bg-surface-hover transition-colors {message.isPinned
						? 'text-primary'
						: ''}"
					aria-label={message.isPinned ? 'Unpin Message' : 'Pin Message'}
					title={message.isPinned ? 'Unpin Message' : 'Pin Message'}
					disabled={isPinning}
				>
					<Pin size={16} />
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
