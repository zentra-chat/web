<script lang="ts">
	import { Spinner } from '$lib/components/ui';
	import { Send, Plus, X, Smile, Paperclip } from 'lucide-svelte';
	import { replyingToMessage, editingMessageId, typingUsers, setReplyingTo, setEditingMessage, addToast } from '$lib/stores/ui';
	import { addMessage, updateMessage, messages, activeCommunityMembers, activeCommunityRoles, setRoles, activeCommunityId } from '$lib/stores/community';
	import {
		addDmMessage,
		updateDmMessage,
		dmMessagesCache,
		updateDmConversationFromMessage,
		activeDmConversation
	} from '$lib/stores/dm';
	import { currentUserId } from '$lib/stores/instance';
	import { api, websocket } from '$lib/api';
	import type { Attachment } from '$lib/types';
	import EmojiPicker from './EmojiPicker.svelte';
	import { customEmojis } from '$lib/stores/emoji';
	import { searchEmojis as searchNativeEmojis } from '$lib/utils/emoji';
	import { getErrorMessage } from '$lib/utils/apiError';
	import { SvelteMap } from 'svelte/reactivity';

	interface Props {
		channelId?: string;
		dmConversationId?: string;
	}

	let { channelId, dmConversationId }: Props = $props();

	let content = $state('');
	let attachments = $state<File[]>([]);
	let isSending = $state(false);
	let showEmojiPicker = $state(false);
	let textareaRef: HTMLTextAreaElement | null = $state(null);
	let fileInputRef: HTMLInputElement | null = $state(null);
	const MESSAGE_INPUT_MAX_HEIGHT = 192;
	const MAX_ATTACHMENTS = 10;
	const MAX_FILE_SIZE = 50 * 1024 * 1024;

	function resizeTextarea() {
		const textarea = textareaRef;
		if (!textarea) return;

		textarea.style.height = 'auto';
		const nextHeight = Math.min(textarea.scrollHeight, MESSAGE_INPUT_MAX_HEIGHT);
		textarea.style.height = `${nextHeight}px`;
		textarea.style.overflowY = textarea.scrollHeight > MESSAGE_INPUT_MAX_HEIGHT ? 'auto' : 'hidden';
	}

	function resetTextareaSize() {
		const textarea = textareaRef;
		if (!textarea) return;

		textarea.style.height = '';
		textarea.style.overflowY = 'hidden';
		requestAnimationFrame(() => resizeTextarea());
	}

	// Map from lowercase name → emoji for fast :shortcode: lookup on send
	let customEmojiByName = $derived.by(() => {
		const map = new SvelteMap<string, (typeof $customEmojis)[number]>();
		for (const e of $customEmojis) map.set(e.name.toLowerCase(), e);
		return map;
	});

	// ---- Mention autocomplete ----
	let mentionQuery = $state<string | null>(null); // null = not active
	let mentionStartIndex = $state(-1); // index of @ in content
	let mentionSelectedIndex = $state(0);

	const SPECIAL_MENTIONS = [
		{ id: 'everyone', label: '@everyone', insert: '@everyone' },
		{ id: 'here', label: '@here', insert: '@here' }
	];

	let mentionResults = $derived.by(() => {
		if (mentionQuery === null) return [];
		const q = mentionQuery.toLowerCase();

		if (isDm) {
			const participants = $activeDmConversation?.participants ?? [];
			return participants
				.filter((participant) => participant.id !== $currentUserId)
				.filter((participant) => {
					const displayName = (participant.displayName ?? '').toLowerCase();
					const username = participant.username.toLowerCase();
					return displayName.includes(q) || username.includes(q);
				})
				.slice(0, 10)
				.map((participant) => ({
					id: participant.id,
					label: `@${participant.displayName ?? participant.username}`,
					insert: `<@${participant.id}>`
				}));
		}

		const specials = SPECIAL_MENTIONS.filter((s) => s.label.includes(q));

		const roles = $activeCommunityRoles
			.filter((r) => r.name.toLowerCase().includes(q))
			.slice(0, 5)
			.map((r) => ({
				id: r.id,
				label: `@${r.name}`,
				insert: `<@&${r.id}>`
			}));

		const members = $activeCommunityMembers
			.filter((m) => {
				const name = (m.nickname ?? m.user?.displayName ?? m.user?.username ?? '').toLowerCase();
				const uname = (m.user?.username ?? '').toLowerCase();
				return name.includes(q) || uname.includes(q);
			})
			.slice(0, 10)
			.map((m) => ({
				id: m.userId,
				label: `@${m.nickname ?? m.user?.displayName ?? m.user?.username ?? m.userId.slice(0, 8)}`,
				insert: `<@${m.userId}>`
			}));

		return [...specials, ...roles, ...members].slice(0, 12);
	});

	function detectMention() {
		const el = textareaRef;
		if (!el) return;
		const cursor = el.selectionStart;
		const before = content.slice(0, cursor);

		// Find the most recent @ that isn't part of a completed mention
		const atMatch = before.match(/(?:^|[\s\n])@(\w*)$/);
		if (atMatch) {
			mentionQuery = atMatch[1];
			mentionStartIndex = before.lastIndexOf('@');
			mentionSelectedIndex = 0;
		} else {
			closeMention();
		}
	}

	function closeMention() {
		mentionQuery = null;
		mentionStartIndex = -1;
		mentionSelectedIndex = 0;
	}

	function insertMention(insert: string) {
		if (mentionStartIndex < 0 || !textareaRef) return;
		const el = textareaRef;
		const cursor = el.selectionStart;
		const before = content.slice(0, mentionStartIndex);
		const after = content.slice(cursor);
		content = before + insert + ' ' + after;
		resizeTextarea();
		closeMention();
		// Re-focus and position
		const newCursor = before.length + insert.length + 1;
		requestAnimationFrame(() => {
			el.focus();
			el.setSelectionRange(newCursor, newCursor);
		});
	}

	// ---- Emoji shortcode autocomplete ----
	let emojiQuery = $state<string | null>(null);
	let emojiStartIndex = $state(-1);
	let emojiSelectedIndex = $state(0);

	let emojiResults = $derived.by(() => {
		if (emojiQuery === null || emojiQuery.length < 2) return [];
		const q = emojiQuery.toLowerCase();

		// Custom emojis matching the query, insert as :name: shortcode (expanded on send)
		const customs = $customEmojis
			.filter((e) => e.name.toLowerCase().includes(q))
			.slice(0, 8)
			.map((e) => ({
				id: `custom-${e.id}`,
				label: `:${e.name}:`,
				insert: `:${e.name}:`,
				imageUrl: e.imageUrl,
				native: undefined as string | undefined,
				type: 'custom' as const
			}));

		// Native emojis matching the query
		const natives = searchNativeEmojis(q)
			.slice(0, 8)
			.map((e) => ({
				id: `native-${e.id}`,
				label: `:${e.id}:`,
				insert: e.native,
				imageUrl: undefined as string | undefined,
				native: e.native,
				type: 'native' as const
			}));

		return [...customs, ...natives].slice(0, 10);
	});

	function detectEmoji() {
		const el = textareaRef;
		if (!el) return;
		const cursor = el.selectionStart;
		const before = content.slice(0, cursor);

		// Match :word at the end (must start after whitespace or start of line)
		const colonMatch = before.match(/(?:^|[\s\n]):([a-zA-Z0-9_+-]{2,})$/);
		if (colonMatch) {
			emojiQuery = colonMatch[1];
			emojiStartIndex = before.lastIndexOf(':');
			emojiSelectedIndex = 0;
		} else {
			closeEmoji();
		}
	}

	function closeEmoji() {
		emojiQuery = null;
		emojiStartIndex = -1;
		emojiSelectedIndex = 0;
	}

	function insertEmoji(insert: string) {
		if (emojiStartIndex < 0 || !textareaRef) return;
		const el = textareaRef;
		const cursor = el.selectionStart;
		const before = content.slice(0, emojiStartIndex);
		const after = content.slice(cursor);
		content = before + insert + ' ' + after;
		resizeTextarea();
		closeEmoji();
		const newCursor = before.length + insert.length + 1;
		requestAnimationFrame(() => {
			el.focus();
			el.setSelectionRange(newCursor, newCursor);
		});
	}

	function handleAutoComplete() {
		resizeTextarea();
		detectMention();
		detectEmoji();
	}


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

	// Fetch roles for the active community so role mentions can be autocompleted
	let fetchedRolesFor = $state<string | null>(null);
	$effect(() => {
		const comId = $activeCommunityId;
		if (!comId || isDm || comId === fetchedRolesFor) return;
		const cached = $activeCommunityRoles;
		if (cached.length > 0) {
			fetchedRolesFor = comId;
			return;
		}
		fetchedRolesFor = comId;
		api.getRoles(comId).then((roles) => setRoles(comId, roles));
	});

	// Load content when editing, convert stored <:name:UUID> tokens back to :name: for editing
	$effect(() => {
		if (editingMessage) {
			content = (editingMessage.content || '').replace(
				/<:([a-zA-Z0-9_+-]{2,32}):([0-9a-f-]{36})>/gi,
				(_, name) => `:${name}:`
			);
			resizeTextarea();
			textareaRef?.focus();
		}
	});

	async function handleSubmit() {
		// Expand :customEmojiName: shortcodes to their wire format <:name:UUID>
		// This handles both autocomplete insertions and manually typed :name: tokens
		const expandedContent = content.replace(
			/:([a-zA-Z0-9_+-]{2,32}):/g,
			(match, name) => {
				const emoji = customEmojiByName.get(name.toLowerCase());
				return emoji ? `<:${emoji.name}:${emoji.id}>` : match;
			}
		);
		const trimmedContent = expandedContent.trim();
		if (!trimmedContent && attachments.length === 0) return;
		if (isSending) return;

		isSending = true;

		try {
			// Upload attachments first
			let uploadedAttachments: Attachment[] = [];
			if (attachments.length > 0) {
				for (const file of attachments) {
					try {
						const att = dmConversationId
							? await api.uploadDmAttachment(file, dmConversationId)
							: await api.uploadAttachment(file, channelId as string);
						uploadedAttachments.push(att);
					} catch (err) {
						console.error('Failed to upload attachment:', err);
						addToast({
							type: 'error',
							message: getErrorMessage(err, `Failed to upload ${file.name}`)
						});
					}
				}
			}

			if (!trimmedContent && uploadedAttachments.length === 0) {
				addToast({
					type: 'error',
					message: 'Attachment upload failed'
				});
				return;
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

				if ($replyingToMessage) {
					messageData.replyToId = $replyingToMessage.id;
				}

				if (uploadedAttachments.length > 0) {
					messageData.attachments = uploadedAttachments.map(a => a.id);
				}

				if (dmConversationId) {
					const msg = await api.sendDmMessage(dmConversationId, messageData);
					addDmMessage(dmConversationId, msg);
					updateDmConversationFromMessage(dmConversationId, msg);
					setReplyingTo(null);
				} else if (channelId) {
					const msg = await api.sendMessage(channelId, messageData);
					addMessage(channelId, msg);
					setReplyingTo(null);
				}
			}

			content = '';
			resetTextareaSize();
			attachments = [];
		} catch (err) {
			console.error('Failed to send message:', err);
			addToast({
				type: 'error',
				message: getErrorMessage(err, 'Failed to send message')
			});
		} finally {
			isSending = false;
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		// Intercept keys when mention autocomplete is open
		if (mentionQuery !== null && mentionResults.length > 0) {
			if (e.key === 'ArrowDown') {
				e.preventDefault();
				mentionSelectedIndex = (mentionSelectedIndex + 1) % mentionResults.length;
				return;
			}
			if (e.key === 'ArrowUp') {
				e.preventDefault();
				mentionSelectedIndex = (mentionSelectedIndex - 1 + mentionResults.length) % mentionResults.length;
				return;
			}
			if (e.key === 'Enter' || e.key === 'Tab') {
				e.preventDefault();
				insertMention(mentionResults[mentionSelectedIndex].insert);
				return;
			}
			if (e.key === 'Escape') {
				e.preventDefault();
				closeMention();
				return;
			}
		}

		// Intercept keys when emoji autocomplete is open
		if (emojiQuery !== null && emojiResults.length > 0) {
			if (e.key === 'ArrowDown') {
				e.preventDefault();
				emojiSelectedIndex = (emojiSelectedIndex + 1) % emojiResults.length;
				return;
			}
			if (e.key === 'ArrowUp') {
				e.preventDefault();
				emojiSelectedIndex = (emojiSelectedIndex - 1 + emojiResults.length) % emojiResults.length;
				return;
			}
			if (e.key === 'Enter' || e.key === 'Tab') {
				e.preventDefault();
				insertEmoji(emojiResults[emojiSelectedIndex].insert);
				return;
			}
			if (e.key === 'Escape') {
				e.preventDefault();
				closeEmoji();
				return;
			}
		}

		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			handleSubmit();
		}

		if (e.key === 'Escape') {
			if ($editingMessageId) {
				setEditingMessage(null);
				content = '';
				resetTextareaSize();
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

	function handleEmojiSelect(emoji: string, options?: { keepOpen?: boolean }) {
		content += emoji;
		resizeTextarea();
		if (!options?.keepOpen) {
			showEmojiPicker = false;
		}
		textareaRef?.focus();
	}

	function handleFileSelect(e: Event) {
		const input = e.target as HTMLInputElement;
		if (input.files) {
			addAttachments(Array.from(input.files));
		}
		// Reset input
		if (fileInputRef) fileInputRef.value = '';
	}

	function addAttachments(files: File[]) {
		if (files.length === 0) return;

		const remaining = Math.max(0, MAX_ATTACHMENTS - attachments.length);
		if (remaining === 0) {
			addToast({
				type: 'error',
				message: `You can attach up to ${MAX_ATTACHMENTS} files`
			});
			return;
		}

		const oversized: string[] = [];
		const valid = [];

		for (const file of files) {
			if (file.size > MAX_FILE_SIZE) {
				oversized.push(file.name);
			} else {
				valid.push(file);
			}
		}

		if (oversized.length > 0) {
			addToast({
				type: 'error',
				message: `${oversized.join(', ')} ${oversized.length === 1 ? 'is' : 'are'} over the 50MB limit`
			});
		}

		const filesToAdd = valid.slice(0, remaining);
		attachments = [...attachments, ...filesToAdd];

		if (filesToAdd.length < valid.length) {
			addToast({
				type: 'error',
				message: `Only ${MAX_ATTACHMENTS} attachments are allowed per message`
			});
		}
	}

	function dragEventHasFiles(e: DragEvent): boolean {
		return Array.from(e.dataTransfer?.types ?? []).includes('Files');
	}

	function removeAttachment(index: number) {
		attachments = attachments.filter((_, i) => i !== index);
	}

	function openFilePicker() {
		fileInputRef?.click();
	}

	function cancelReply() {
		setReplyingTo(null);
	}

	function cancelEdit() {
		setEditingMessage(null);
		content = '';
		resetTextareaSize();
	}

	function isVideoFile(file: File): boolean {
		return file.type.toLowerCase().startsWith('video/');
	}

	function isAudioFile(file: File): boolean {
		return file.type.toLowerCase().startsWith('audio/');
	}

	// Auto-focus message input when typing anywhere
	$effect(() => {
		resizeTextarea();

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

		function handleGlobalDragOver(e: DragEvent) {
			if (!dragEventHasFiles(e)) return;
			e.preventDefault();
			if (e.dataTransfer) {
				e.dataTransfer.dropEffect = 'copy';
			}
		}

		function handleGlobalDrop(e: DragEvent) {
			if (!dragEventHasFiles(e)) return;
			e.preventDefault();

			const droppedFiles = Array.from(e.dataTransfer?.files ?? []);
			addAttachments(droppedFiles);
		}

		function handleGlobalPaste(e: ClipboardEvent) {
			const clipboardData = e.clipboardData;
			if (!clipboardData) return;

			const target = e.target as HTMLElement;
			const isInInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

			const items = Array.from(clipboardData.items);
			const fileItems = items.filter(item => item.kind === 'file');
			
			if (fileItems.length > 0) {
				e.preventDefault();

				if (!isInInput) {
					textareaRef?.focus();
				}

				const files: File[] = [];
				for (const item of fileItems) {
					const file = item.getAsFile();
					if (file) {
						files.push(file);
					}
				}
				
				if (files.length > 0) {
					addAttachments(files);
				}
			} else if (!isInInput) {
				e.preventDefault();
				textareaRef?.focus();
				const text = clipboardData.getData('text');
				if (text && textareaRef) {
					content = content + text;
					requestAnimationFrame(() => {
						textareaRef?.focus();
						const newPos = content.length;
						textareaRef?.setSelectionRange(newPos, newPos);
					});
				}
			}
		}

		window.addEventListener('keydown', handleGlobalKeydown, true);
		window.addEventListener('dragover', handleGlobalDragOver, true);
		window.addEventListener('drop', handleGlobalDrop, true);
		window.addEventListener('paste', handleGlobalPaste, true);
		return () => {
			window.removeEventListener('keydown', handleGlobalKeydown, true);
			window.removeEventListener('dragover', handleGlobalDragOver, true);
			window.removeEventListener('drop', handleGlobalDrop, true);
			window.removeEventListener('paste', handleGlobalPaste, true);
		};
	});
</script>

<div class="px-4 pb-4">
	<!-- Typing indicator -->
	<div class="flex items-center gap-2 px-2 pt-1 text-xs mb-2 text-text-muted h-5">
		{#if typingInChannel.length > 0}
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
		{/if}
	</div>

	<!-- Reply/Edit indicator -->
	{#if $replyingToMessage}
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
	{#if attachments.length > 0}
		<div class="flex flex-wrap gap-2 px-4 py-2 bg-surface {$replyingToMessage || $editingMessageId ? '' : 'rounded-t-lg'} border border-b-0 border-border">
			{#each attachments as file, index (file.name + ':' + file.size + ':' + file.lastModified)}
				<div class="relative group">
					{#if file.type.startsWith('image/')}
						<div class="w-20 h-20 rounded bg-surface-hover overflow-hidden">
							<img
								src={URL.createObjectURL(file)}
								alt={file.name}
								class="w-full h-full object-cover"
							/>
						</div>
					{:else if isVideoFile(file)}
						<div class="w-36 h-20 rounded bg-surface-hover overflow-hidden border border-border">
							<video
								src={URL.createObjectURL(file)}
								class="w-full h-full object-cover"
								muted
								playsinline
								preload="metadata"
							>
								<track kind="captions" />
							</video>
						</div>
					{:else if isAudioFile(file)}
						<div class="w-48 h-20 rounded bg-surface-hover border border-border px-2 py-1 flex flex-col justify-center gap-1">
							<div class="flex items-center gap-2 min-w-0">
								<Paperclip size={16} class="text-text-muted shrink-0" />
								<span class="text-[10px] text-text-muted truncate">{file.name}</span>
							</div>
							<audio src={URL.createObjectURL(file)} controls preload="metadata" class="w-full h-7"></audio>
						</div>
					{:else}
						<div class="w-20 h-20 rounded bg-surface-hover flex flex-col items-center justify-center p-2">
							<Paperclip size={20} class="text-text-muted mb-1" />
							<span class="text-[10px] text-text-muted truncate w-full text-center">{file.name}</span>
						</div>
					{/if}
					<div class="absolute bottom-1 left-1 right-1 flex justify-between items-center gap-1">
						<span class="text-[9px] text-text-muted bg-surface/80 px-1 rounded truncate max-w-[60%]">{file.name}</span>
						<span class="text-[9px] text-text-muted bg-surface/80 px-1 rounded shrink-0">
							{file.size < 1024 * 1024
								? (file.size / 1024).toFixed(0) + ' KB'
								: (file.size / (1024 * 1024)).toFixed(1) + ' MB'}
						</span>
					</div>
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
	<div class="relative flex items-center gap-2 bg-surface {$replyingToMessage || $editingMessageId || attachments.length > 0 ? 'rounded-b-lg border-t-0' : 'rounded-lg'} border border-border">
		<!-- Mention autocomplete popup -->
		{#if mentionQuery !== null && mentionResults.length > 0}
			<div
				class="absolute bottom-full left-0 right-0 mb-1 bg-surface border border-border rounded-lg shadow-xl z-50 overflow-hidden"
				role="listbox"
				aria-label="Mention suggestions"
			>
				<div class="px-3 py-1.5 text-xs text-text-muted border-b border-border">Mentions</div>
				{#each mentionResults as result, i (result.id)}
					<button
						onclick={() => insertMention(result.insert)}
						class="w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-surface-hover transition-colors
						{i === mentionSelectedIndex ? 'bg-surface-hover text-text-primary' : 'text-text-secondary'}"
						role="option"
						aria-selected={i === mentionSelectedIndex}
					>
						<span class="font-medium">{result.label}</span>
					</button>
				{/each}
			</div>
		{/if}

		<!-- Emoji shortcode autocomplete popup -->
		{#if emojiQuery !== null && emojiResults.length > 0}
			<div
				class="absolute bottom-full left-0 right-0 mb-1 bg-surface border border-border rounded-lg shadow-xl z-50 overflow-hidden"
				role="listbox"
				aria-label="Emoji suggestions"
			>
				<div class="px-3 py-1.5 text-xs text-text-muted border-b border-border">Emojis matching :{emojiQuery}</div>
				{#each emojiResults as result, i (result.id)}
					<button
						onclick={() => insertEmoji(result.insert)}
						class="w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-surface-hover transition-colors
						{i === emojiSelectedIndex ? 'bg-surface-hover text-text-primary' : 'text-text-secondary'}"
						role="option"
						aria-selected={i === emojiSelectedIndex}
					>
						{#if result.type === 'custom'}
							<img src={result.imageUrl} alt={result.label} class="w-5 h-5 object-contain" />
						{:else}
							<span class="text-lg leading-none">{result.native}</span>
						{/if}
						<span class="font-medium">{result.label}</span>
					</button>
				{/each}
			</div>
		{/if}

		<input
			bind:this={fileInputRef}
			type="file"
			multiple
			accept="*/*"
			onchange={handleFileSelect}
			class="hidden"
		/>

		<button
			onclick={openFilePicker}
			class="p-3 text-text-muted hover:text-text-primary transition-colors shrink-0 flex items-center justify-center h-12"
			aria-label="Add attachment"
			disabled={isSending}
		>
			<Plus size={20} />
		</button>

		<textarea
			bind:this={textareaRef}
			bind:value={content}
			onkeydown={handleKeydown}
			oninput={handleAutoComplete}
			placeholder={$editingMessageId ? 'Edit message...' : 'Message...'}
			rows={1}
			class="flex-1 py-3 bg-transparent text-text-primary placeholder-text-muted resize-none focus:outline-none focus-visible:outline-none max-h-48 min-h-12 message-send-field"
			disabled={isSending}
		></textarea>

		<div class="flex items-center gap-1 pr-1 shrink-0 h-12">
			<div class="relative flex items-center h-full">
				{#if showEmojiPicker}
					<div class="absolute bottom-full right-0 mb-4 z-50">
						<EmojiPicker onSelect={handleEmojiSelect} onClose={() => (showEmojiPicker = false)} />
					</div>
				{/if}
				<button
					onclick={() => (showEmojiPicker = !showEmojiPicker)}
					data-emoji-picker-trigger="true"
					class="p-3 text-text-muted hover:text-text-primary transition-colors flex items-center justify-center {showEmojiPicker ? 'text-primary' : ''}"
					aria-label="Add emoji"
				>
					<Smile size={20} />
				</button>
			</div>
			<button
				onclick={handleSubmit}
				disabled={isSending || (!content.trim() && attachments.length === 0)}
				class="p-3 text-primary hover:text-secondary disabled:text-text-muted disabled:cursor-not-allowed transition-colors flex items-center justify-center h-full"
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