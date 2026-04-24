<script lang="ts">
	import { Button, Input, Spinner } from '$lib/components/ui';
	import { Pencil, Plus, Smile, Trash } from 'lucide-svelte';
	import { api } from '$lib/api';
	import { addToast } from '$lib/stores/ui';
	import { refreshCustomEmojis } from '$lib/stores/emoji';
	import { getErrorMessage } from '$lib/utils/apiError';
	import type { CustomEmoji } from '$lib/types';

	interface Props {
		communityId: string;
	}

	let { communityId }: Props = $props();

	let communityEmojis = $state<CustomEmoji[]>([]);
	let isLoadingEmojis = $state(false);
	let isUploadingEmoji = $state(false);
	let newEmojiName = $state('');
	let newEmojiFile = $state<File | null>(null);
	let newEmojiPreview = $state<string | null>(null);
	let emojiInputResetKey = $state(0);
	let editingEmojiId = $state<string | null>(null);
	let editingEmojiName = $state('');
	let emojiFileInputRef = $state<HTMLInputElement | null>(null);
	let lastEmojiResetKey = -1;
	let loadedForCommunityId = $state<string | null>(null);

	$effect(() => {
		if (!communityId || loadedForCommunityId === communityId) return;
		loadedForCommunityId = communityId;
		communityEmojis = [];
		newEmojiName = '';
		newEmojiFile = null;
		newEmojiPreview = null;
		emojiInputResetKey = 0;
		editingEmojiId = null;
		editingEmojiName = '';
		void loadEmojis();
	});

	$effect(() => {
		if (emojiInputResetKey !== lastEmojiResetKey) {
			lastEmojiResetKey = emojiInputResetKey;
			if (emojiFileInputRef) {
				emojiFileInputRef.value = '';
			}
		}
	});

	async function loadEmojis() {
		if (!communityId || isLoadingEmojis) return;
		isLoadingEmojis = true;
		try {
			communityEmojis = await api.getCommunityEmojis(communityId);
		} catch {
			addToast({ type: 'error', message: 'Failed to load emojis' });
		} finally {
			isLoadingEmojis = false;
		}
	}

	function handleEmojiFileSelect(event: Event) {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;

		const allowed = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
		if (!allowed.includes(file.type)) {
			addToast({ type: 'error', message: 'Must be a PNG, JPEG, GIF, or WebP image' });
			return;
		}
		if (file.size > 256 * 1024) {
			addToast({ type: 'error', message: 'Emoji must be under 256KB' });
			return;
		}

		newEmojiFile = file;
		const reader = new FileReader();
		reader.onload = () => {
			newEmojiPreview = reader.result as string;
		};
		reader.readAsDataURL(file);
	}

	async function uploadEmoji() {
		if (!communityId || !newEmojiFile || !newEmojiName.trim()) return;
		isUploadingEmoji = true;
		try {
			await api.createEmoji(communityId, newEmojiName.trim(), newEmojiFile);
			addToast({ type: 'success', message: `Emoji :${newEmojiName.trim()}: added` });
			newEmojiName = '';
			newEmojiFile = null;
			newEmojiPreview = null;
			emojiInputResetKey += 1;
			await loadEmojis();
			refreshCustomEmojis();
		} catch (err) {
			addToast({ type: 'error', message: getErrorMessage(err, 'Failed to upload emoji') });
		} finally {
			isUploadingEmoji = false;
		}
	}

	function startEditEmoji(emoji: CustomEmoji) {
		editingEmojiId = emoji.id;
		editingEmojiName = emoji.name;
	}

	function cancelEditEmoji() {
		editingEmojiId = null;
		editingEmojiName = '';
	}

	async function saveEmojiName(emojiId: string) {
		if (!editingEmojiName.trim()) return;
		try {
			await api.updateEmoji(emojiId, editingEmojiName.trim());
			addToast({ type: 'success', message: 'Emoji renamed' });
			cancelEditEmoji();
			await loadEmojis();
			refreshCustomEmojis();
		} catch (err) {
			addToast({ type: 'error', message: getErrorMessage(err, 'Failed to rename emoji') });
		}
	}

	async function deleteEmoji(emojiId: string, emojiName: string) {
		if (!confirm(`Delete :${emojiName}:? This can't be undone.`)) return;
		try {
			await api.deleteEmoji(emojiId);
			addToast({ type: 'success', message: `Emoji :${emojiName}: deleted` });
			await loadEmojis();
			refreshCustomEmojis();
		} catch (err) {
			addToast({ type: 'error', message: getErrorMessage(err, 'Failed to delete emoji') });
		}
	}
</script>

<div class="space-y-4">
	<div>
		<h3 class="text-lg font-semibold text-text-primary">Custom Emojis</h3>
		<p class="text-sm text-text-muted">Upload custom emojis for your community. Members can use them anywhere.</p>
	</div>

	<div class="bg-surface-hover rounded-lg p-4 space-y-3">
		<h4 class="font-medium text-text-primary text-sm">Upload Emoji</h4>
		<div class="flex items-end gap-3">
			<div class="shrink-0">
				<button
					onclick={() => emojiFileInputRef?.click()}
					class="w-16 h-16 rounded-lg border-2 border-dashed border-border hover:border-primary flex items-center justify-center transition-colors bg-surface overflow-hidden"
				>
					{#if newEmojiPreview}
						<img src={newEmojiPreview} alt="Preview" class="w-12 h-12 object-contain" />
					{:else}
						<Plus size={20} class="text-text-muted" />
					{/if}
				</button>
				<input
					bind:this={emojiFileInputRef}
					type="file"
					accept="image/png,image/jpeg,image/gif,image/webp"
					onchange={handleEmojiFileSelect}
					class="hidden"
				/>
			</div>
			<div class="flex-1">
				<label for="emoji-name" class="block text-xs text-text-muted mb-1">Name</label>
				<Input id="emoji-name" bind:value={newEmojiName} placeholder="emoji_name" maxlength={32} />
				<p class="text-xs text-text-muted mt-1">2-32 characters, letters, numbers, and underscores only</p>
			</div>
			<Button onclick={uploadEmoji} disabled={isUploadingEmoji || !newEmojiFile || !newEmojiName.trim()} size="sm">
				{#if isUploadingEmoji}
					<Spinner size="sm" />
				{:else}
					Upload
				{/if}
			</Button>
		</div>
	</div>

	{#if isLoadingEmojis}
		<div class="flex justify-center py-8">
			<Spinner />
		</div>
	{:else if communityEmojis.length === 0}
		<div class="text-center py-8 text-text-muted">
			<Smile size={32} class="mx-auto mb-2 opacity-50" />
			<p>No custom emojis yet</p>
		</div>
	{:else}
		<div class="text-xs text-text-muted">{communityEmojis.length} / 200 emoji slots used</div>
		<div class="grid gap-2">
			{#each communityEmojis as emoji (emoji.id)}
				<div class="flex items-center gap-3 bg-surface rounded-lg px-3 py-2 border border-border group">
					<img src={emoji.imageUrl} alt={emoji.name} class="w-8 h-8 object-contain shrink-0" />
					{#if editingEmojiId === emoji.id}
						<div class="flex-1 flex items-center gap-2">
							<Input
								bind:value={editingEmojiName}
								class="text-sm"
								onkeydown={(event: KeyboardEvent) => {
									if (event.key === 'Enter') saveEmojiName(emoji.id);
									if (event.key === 'Escape') cancelEditEmoji();
								}}
							/>
							<Button size="sm" onclick={() => saveEmojiName(emoji.id)}>Save</Button>
							<Button size="sm" variant="ghost" onclick={cancelEditEmoji}>Cancel</Button>
						</div>
					{:else}
						<span class="flex-1 text-sm text-text-primary font-medium">:{emoji.name}:</span>
						<div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
							<button
								onclick={() => startEditEmoji(emoji)}
								class="p-1.5 rounded hover:bg-surface-hover text-text-muted hover:text-text-primary transition-colors"
								aria-label="Rename emoji"
							>
								<Pencil size={14} />
							</button>
							<button
								onclick={() => deleteEmoji(emoji.id, emoji.name)}
								class="p-1.5 rounded hover:bg-surface-hover text-text-muted hover:text-danger transition-colors"
								aria-label="Delete emoji"
							>
								<Trash size={14} />
							</button>
						</div>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
</div>
