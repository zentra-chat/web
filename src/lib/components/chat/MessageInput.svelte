<script lang="ts">
	import { Spinner } from '$lib/components/ui';
	import { Send, Plus, X, Smile, Paperclip } from '$lib/components/icons';
	import { replyingToMessage, editingMessageId, typingUsers, setReplyingTo, setEditingMessage, addToast } from '$lib/stores/ui';
	import { addMessage, updateMessage, messages } from '$lib/stores/community';
	import {
		addDmMessage,
		updateDmMessage,
		dmMessagesCache,
		updateDmConversationFromMessage
	} from '$lib/stores/dm';
	import { currentUserId } from '$lib/stores/instance';
	import { api, websocket } from '$lib/api';
	import type { Attachment } from '$lib/types';
	import EmojiPicker from './EmojiPicker.svelte';

	interface Props {
		channelId?: string;
		dmConversationId?: string;
	}

	let { channelId, dmConversationId }: Props = $props();

	let content = $state('');
	let attachments = $state<File[]>([]);
	let isSending = $state(false);
	let isUploading = $state(false);
	let showEmojiPicker = $state(false);
	let textareaRef: HTMLTextAreaElement | null = $state(null);
	let fileInputRef: HTMLInputElement | null = $state(null);


	let isDm = $derived(!!dmConversationId);
	let typingInChannel = $derived.by(() => {
		const activeId = dmConversationId || channelId;
		if (!activeId) return [];
		const users = $typingUsers[activeId] || [];
		return users.filter((entry) => entry.userId != $currentUserId);
	});

	let editingMessage = $derived.by(() => {
		if (!$editingMessageId) return null;
		const channelMsgs = dmConversationId
			? $dmMessagesCache[dmConversationId] || []
			: $messages[channelId as string] || [];
		return channelMsgs.find(m => m.id === $editingMessageId) || null;
	});

	// Load content when editing
	$effect(() => {
		if (editingMessage) {
			content = editingMessage.content || '';
			textareaRef?.focus();
		}
	});

	$effect(() => {
		if (isDm && attachments.length > 0) {
			attachments = [];
		}
	});

	async function handleSubmit() {
		const trimmedContent = content.trim();
		if (!trimmedContent && attachments.length === 0) return;
		if (isSending) return;

		isSending = true;

		try {
			// Upload attachments first
			let uploadedAttachments: Attachment[] = [];
			if (!dmConversationId && attachments.length > 0) {
				isUploading = true;
				for (const file of attachments) {
					try {
						const att = await api.uploadAttachment(file, channelId as string);
						uploadedAttachments.push(att);
					} catch (err) {
						console.error('Failed to upload attachment:', err);
						addToast({
							type: 'error',
							message: `Failed to upload ${file.name}`
						});
					}
				}
				isUploading = false;
			}

			if ($editingMessageId && editingMessage) {
				// Edit existing message
				if (dmConversationId) {
					const msg = await api.editDmMessage(editingMessage.id, trimmedContent);
					updateDmMessage(dmConversationId, editingMessage.id, msg);
					updateDmConversationFromMessage(dmConversationId, msg);
				} else if (channelId) {
					const msg = await api.editMessage(editingMessage.id, trimmedContent);
					updateMessage(channelId, editingMessage.id, msg);
				}
				setEditingMessage(null);
			} else {
				// Send new message
				const messageData: {
					content: string;
					replyToId?: string;
					attachments?: string[];
				} = {
					content: trimmedContent
				};

				if (!dmConversationId && $replyingToMessage) {
					messageData.replyToId = $replyingToMessage.id;
				}

				if (!dmConversationId && uploadedAttachments.length > 0) {
					messageData.attachments = uploadedAttachments.map(a => a.id);
				}

				if (dmConversationId) {
					const msg = await api.sendDmMessage(dmConversationId, messageData.content);
					addDmMessage(dmConversationId, msg);
					updateDmConversationFromMessage(dmConversationId, msg);
				} else if (channelId) {
					const msg = await api.sendMessage(channelId, messageData);
					addMessage(channelId, msg);
					setReplyingTo(null);
				}
			}

			content = '';
			attachments = [];
		} catch (err) {
			console.error('Failed to send message:', err);
			addToast({
				type: 'error',
				message: 'Failed to send message'
			});
		} finally {
			isSending = false;
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			handleSubmit();
		}

		if (e.key === 'Escape') {
			if ($editingMessageId) {
				setEditingMessage(null);
				content = '';
			} else if ($replyingToMessage) {
				setReplyingTo(null);
			}
		}

		// Send typing indicator
		const activeId = dmConversationId || channelId;
		if (activeId) {
			websocket.sendTyping(activeId);
		}
	}

	function handleEmojiSelect(emoji: string) {
		content += emoji;
		showEmojiPicker = false;
		textareaRef?.focus();
	}

	function handleFileSelect(e: Event) {
		if (dmConversationId) return;
		const input = e.target as HTMLInputElement;
		if (input.files) {
			const newFiles = Array.from(input.files);
			// Limit to 10 attachments
			const remaining = 10 - attachments.length;
			attachments = [...attachments, ...newFiles.slice(0, remaining)];
		}
		// Reset input
		if (fileInputRef) fileInputRef.value = '';
	}

	function removeAttachment(index: number) {
		attachments = attachments.filter((_, i) => i !== index);
	}

	function openFilePicker() {
		if (dmConversationId) return;
		fileInputRef?.click();
	}

	function cancelReply() {
		setReplyingTo(null);
	}

	function cancelEdit() {
		setEditingMessage(null);
		content = '';
	}

	function formatFileSize(bytes: number): string {
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
		return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	}

	// Auto-focus message input when typing anywhere
	$effect(() => {
		function handleGlobalKeydown(e: KeyboardEvent) {
			// Don't focus if we're already in an input, textarea, or contenteditable
			const target = e.target as HTMLElement;
			if (
				target.tagName === 'INPUT' ||
				target.tagName === 'TEXTAREA' ||
				target.isContentEditable ||
				e.ctrlKey ||
				e.metaKey ||
				e.altKey
			) {
				return;
			}

			// Focus if it's a printable character
			if (e.key.length === 1) {
				textareaRef?.focus();
			}
		}

		window.addEventListener('keydown', handleGlobalKeydown, true);
		return () => window.removeEventListener('keydown', handleGlobalKeydown, true);
	});
</script>

<div class="px-4 pb-4">
	<!-- Typing indicator -->
	{#if typingInChannel.length > 0}
		<div class="flex items-center gap-2 px-2 pt-1 text-xs mb-2 text-text-muted">
			<div class="flex gap-1">
				<span class="w-1.5 h-1.5 rounded-full bg-text-muted animate-bounce" style="animation-delay: 0ms"></span>
				<span class="w-1.5 h-1.5 rounded-full bg-text-muted animate-bounce" style="animation-delay: 150ms"></span>
				<span class="w-1.5 h-1.5 rounded-full bg-text-muted animate-bounce" style="animation-delay: 300ms"></span>
			</div>
			<span>
				{#if typingInChannel.length === 1}
					{typingInChannel[0].username} is typing...
				{:else if typingInChannel.length === 2}
					{typingInChannel[0].username} and {typingInChannel[1].username} are typing...
				{:else}
					Several people are typing...
				{/if}
			</span>
		</div>
	{/if}

	<!-- Reply/Edit indicator -->
	{#if !isDm && $replyingToMessage}
		<div class="flex items-center gap-2 px-4 py-2 bg-surface rounded-t-lg border border-b-0 border-border">
			<span class="text-xs text-text-muted">Replying to</span>
			<span class="text-xs font-medium text-primary">
				{$replyingToMessage.author?.displayName || $replyingToMessage.author?.username}
			</span>
			<span class="text-xs text-text-muted truncate flex-1">{$replyingToMessage.content}</span>
			<button
				onclick={cancelReply}
				class="p-1 text-text-muted hover:text-text-primary transition-colors"
				aria-label="Cancel reply"
			>
				<X size={14} />
			</button>
		</div>
	{/if}

	{#if $editingMessageId}
		<div class="flex items-center gap-2 px-4 py-2 bg-warning/10 rounded-t-lg border border-b-0 border-warning/30">
			<span class="text-xs text-warning">Editing message</span>
			<button
				onclick={cancelEdit}
				class="p-1 text-text-muted hover:text-text-primary transition-colors ml-auto"
				aria-label="Cancel edit"
			>
				<X size={14} />
			</button>
		</div>
	{/if}

	<!-- Attachments preview -->
	{#if !isDm && attachments.length > 0}
		<div class="flex flex-wrap gap-2 px-4 py-2 bg-surface {$replyingToMessage || $editingMessageId ? '' : 'rounded-t-lg'} border border-b-0 border-border">
			{#each attachments as file, index}
				<div class="relative group">
					{#if file.type.startsWith('image/')}
						<div class="w-20 h-20 rounded bg-surface-hover overflow-hidden">
							<img
								src={URL.createObjectURL(file)}
								alt={file.name}
								class="w-full h-full object-cover"
							/>
						</div>
					{:else}
						<div class="w-20 h-20 rounded bg-surface-hover flex flex-col items-center justify-center p-2">
							<Paperclip size={20} class="text-text-muted mb-1" />
							<span class="text-[10px] text-text-muted truncate w-full text-center">{file.name}</span>
						</div>
					{/if}
					<button
						onclick={() => removeAttachment(index)}
						class="absolute -top-1 -right-1 w-5 h-5 bg-error text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
						aria-label="Remove attachment"
					>
						<X size={12} />
					</button>
				</div>
			{/each}
		</div>
	{/if}

	<!-- Input area -->
	<div class="relative flex items-end gap-2 bg-surface {$replyingToMessage || $editingMessageId || (!isDm && attachments.length > 0) ? 'rounded-b-lg border-t-0' : 'rounded-lg'} border border-border">
		{#if !isDm}
			<input
				bind:this={fileInputRef}
				type="file"
				multiple
				accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt,.zip"
				onchange={handleFileSelect}
				class="hidden"
			/>

			<button
				onclick={openFilePicker}
				class="p-3 text-text-muted hover:text-text-primary transition-colors shrink-0"
				aria-label="Add attachment"
				disabled={isSending}
			>
				<Plus size={20} />
			</button>
		{/if}

		<textarea
			bind:this={textareaRef}
			bind:value={content}
			onkeydown={handleKeydown}
			placeholder={$editingMessageId ? 'Edit message...' : 'Message...'}
			rows={1}
			class="flex-1 py-3 bg-transparent text-text-primary placeholder-text-muted resize-none focus:outline-none focus-visible:outline-none max-h-48 min-h-12 message-send-field"
			disabled={isSending}
		></textarea>

		<div class="flex items-center gap-1 pr-1 shrink-0">
			<div class="relative">
				{#if showEmojiPicker}
					<div class="absolute bottom-full right-0 mb-4 z-50">
						<EmojiPicker onSelect={handleEmojiSelect} onClose={() => (showEmojiPicker = false)} />
					</div>
				{/if}
				<button
					onclick={() => (showEmojiPicker = !showEmojiPicker)}
					class="p-3 text-text-muted hover:text-text-primary transition-colors {showEmojiPicker ? 'text-primary' : ''}"
					aria-label="Add emoji"
				>
					<Smile size={20} />
				</button>
			</div>
			<button
				onclick={handleSubmit}
				disabled={isSending || (!content.trim() && (!isDm && attachments.length === 0))}
				class="p-3 text-primary hover:text-secondary disabled:text-text-muted disabled:cursor-not-allowed transition-colors"
				aria-label={$editingMessageId ? 'Save edit' : 'Send message'}
			>
				{#if isSending}
					<Spinner size="sm" />
				{:else}
					<Send size={20} />
				{/if}
			</button>
		</div>
	</div>
</div>

<style>
	.message-send-field {
		outline: none
	}
</style>