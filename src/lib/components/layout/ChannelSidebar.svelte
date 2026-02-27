<script lang="ts">
	import { onMount } from 'svelte';
	import {
		Hash,
		Megaphone,
		Image,
		ChevronDown,
		ChevronRight,
		Plus,
		Settings,
		FolderPlus,
		Volume2
	} from 'lucide-svelte';
	import { Tooltip, Button, Modal, Input } from '$lib/components/ui';
	import VoiceChannelUsers from '$lib/components/chat/VoiceChannelUsers.svelte';
	import VoiceCallOverlay from '$lib/components/chat/VoiceCallOverlay.svelte';
	import {
		activeCommunity,
		activeCommunityMembers,
		activeCommunityChannels,
		activeCommunityCategories,
		activeChannelId,
		selectChannel,
		setChannels,
		setCategories,
		memberHasPermission,
		Permission,
		unreadCounts
	} from '$lib/stores/community';
	import { openModal, isMobileMenuOpen, addToast, userSettings } from '$lib/stores/ui';
	import { currentUserId } from '$lib/stores/instance';
	import { api } from '$lib/api';
	import { joinVoiceChannel, voiceChannelId, loadVoiceStates } from '$lib/stores/voice';
	import type { Channel, ChannelCategory } from '$lib/types';

	let collapsedCategories = $state<Set<string>>(new Set());
	let developerModeEnabled = $derived(Boolean($userSettings?.settings?.developerMode));
	let contextMenu = $state<
		| { x: number; y: number; type: 'channel'; channelId: string }
		| { x: number; y: number; type: 'category'; categoryId: string }
		| null
	>(null);
	let isLoading = $state(false);
	let draggedChannelId = $state<string | null>(null);
	let dragOverChannelId = $state<string | null>(null);
	let isReorderingChannels = $state(false);
	let renameModal = $state<
		| {
			type: 'channel' | 'category';
			id: string;
			currentName: string;
		}
		| null
	>(null);
	let renameInput = $state('');
	let renameError = $state('');
	let isRenaming = $state(false);
	let myMember = $derived.by(() => $activeCommunityMembers.find((m) => m.userId === $currentUserId) || null);
	let isOwner = $derived(Boolean($activeCommunity && $activeCommunity.ownerId === $currentUserId));
	let canManageChannels = $derived(isOwner || memberHasPermission(myMember, Permission.ManageChannels));
	let canOpenCommunitySettings = $derived(
		isOwner ||
		memberHasPermission(myMember, Permission.ManageCommunity) ||
			memberHasPermission(myMember, Permission.ManageRoles) ||
			memberHasPermission(myMember, Permission.CreateInvites) ||
			memberHasPermission(myMember, Permission.ManageChannels)
	);

	const channelIcons: Record<string, any> = {
		text: Hash,
		announcement: Megaphone,
		gallery: Image,
		forum: Hash,
		voice: Volume2
	};

	// Group channels by category
	let channelsByCategory = $derived.by(() => {
		const grouped: Record<string, Channel[]> = { 'uncategorized': [] };

		for (const category of $activeCommunityCategories) {
			grouped[category.id] = [];
		}

		for (const channel of $activeCommunityChannels) {
			const categoryId = channel.categoryId || 'uncategorized';
			if (!grouped[categoryId]) {
				grouped[categoryId] = [];
			}
			grouped[categoryId].push(channel);
		}

		// Sort channels by position
		for (const key of Object.keys(grouped)) {
			grouped[key].sort((a, b) => a.position - b.position);
		}

		return grouped;
	});

	onMount(async () => {
		await loadChannelsAndCategories();
	});

	async function loadChannelsAndCategories() {
		if (!$activeCommunity) return;

		isLoading = true;
		try {
			const [channels, categories] = await Promise.all([
				api.getChannels($activeCommunity.id),
				api.getCategories($activeCommunity.id)
			]);
			setChannels($activeCommunity.id, channels);
			setCategories($activeCommunity.id, categories);

			// Load voice states for voice channels
			const voiceChannels = channels.filter((c) => c.type === 'voice');
			voiceChannels.forEach((vc) => loadVoiceStates(vc.id));

			// Select first channel if none selected
			if (!$activeChannelId && channels.length > 0) {
				selectChannel(channels[0].id);
			}
		} catch (err) {
			console.error('Failed to load channels:', err);
		} finally {
			isLoading = false;
		}
	}

	function toggleCategory(categoryId: string) {
		collapsedCategories = new Set(collapsedCategories);
		if (collapsedCategories.has(categoryId)) {
			collapsedCategories.delete(categoryId);
		} else {
			collapsedCategories.add(categoryId);
		}
	}

	function handleChannelClick(channel: Channel) {
		if (isReorderingChannels) return;
		if (channel.type === 'voice') {
			// Select the channel to show the voice view, and join if not already in
			selectChannel(channel.id);
			joinVoiceChannel(channel.id);
			return;
		}
		selectChannel(channel.id);
	}

	function handleChannelDragStart(event: DragEvent, channelId: string) {
		if (!canManageChannels || isReorderingChannels) return;
		draggedChannelId = channelId;
		dragOverChannelId = channelId;
		if (event.dataTransfer) {
			event.dataTransfer.effectAllowed = 'move';
			event.dataTransfer.setData('text/plain', channelId);
		}
	}

	function handleChannelDragOver(event: DragEvent, channelId: string) {
		if (!draggedChannelId || draggedChannelId === channelId) return;
		event.preventDefault();
		dragOverChannelId = channelId;
	}

	function handleChannelDragLeave(channelId: string) {
		if (dragOverChannelId === channelId) {
			dragOverChannelId = null;
		}
	}

	async function handleChannelDrop(event: DragEvent, targetChannelId: string) {
		event.preventDefault();
		const sourceChannelId = draggedChannelId;
		draggedChannelId = null;
		dragOverChannelId = null;

		if (!sourceChannelId || sourceChannelId === targetChannelId || !$activeCommunity) {
			return;
		}

		const orderedIds = [...$activeCommunityChannels]
			.sort((a, b) => a.position - b.position)
			.map((channel) => channel.id);

		const sourceIndex = orderedIds.indexOf(sourceChannelId);
		const targetIndex = orderedIds.indexOf(targetChannelId);
		if (sourceIndex < 0 || targetIndex < 0) {
			return;
		}

		orderedIds.splice(sourceIndex, 1);
		orderedIds.splice(targetIndex, 0, sourceChannelId);

		isReorderingChannels = true;
		try {
			await api.reorderChannels($activeCommunity.id, orderedIds);
			await loadChannelsAndCategories();
		} catch (err: any) {
			console.error('Failed to reorder channels:', err);
			addToast({ type: 'error', message: err?.error || 'Failed to reorder channels' });
		} finally {
			isReorderingChannels = false;
		}
	}

	function handleChannelDragEnd() {
		draggedChannelId = null;
		dragOverChannelId = null;
	}

	function handleChannelContextMenu(event: MouseEvent, channel: Channel) {
		if (!canManageChannels && !developerModeEnabled) {
			return;
		}
		event.preventDefault();
		contextMenu = { x: event.clientX, y: event.clientY, type: 'channel', channelId: channel.id };
	}

	function handleCategoryContextMenu(event: MouseEvent, category: ChannelCategory) {
		if (!canManageChannels) {
			return;
		}
		event.preventDefault();
		contextMenu = {
			x: event.clientX,
			y: event.clientY,
			type: 'category',
			categoryId: category.id
		};
	}

	async function handleCopyChannelId(channelId: string) {
		try {
			await navigator.clipboard.writeText(channelId);
			addToast({ type: 'success', message: 'Channel ID copied' });
		} catch (err) {
			console.error('Failed to copy channel ID:', err);
			addToast({ type: 'error', message: 'Failed to copy channel ID' });
		}
		contextMenu = null;
	}

	function openRenameChannelModal(channelId: string) {
		const channel = $activeCommunityChannels.find((c) => c.id === channelId);
		if (!channel) {
			contextMenu = null;
			return;
		}

		renameModal = { type: 'channel', id: channel.id, currentName: channel.name };
		renameInput = channel.name;
		renameError = '';
		contextMenu = null;
	}

	async function handleCreateCategory() {
		if (!canManageChannels || !$activeCommunity) return;

		const nameInput = window.prompt('Create folder (category) name');
		if (nameInput === null) return;

		const name = nameInput.trim();
		if (!name) return;

		try {
			await api.createCategory($activeCommunity.id, name);
			await loadChannelsAndCategories();
			addToast({ type: 'success', message: 'Folder created' });
		} catch (err: any) {
			console.error('Failed to create folder:', err);
			addToast({ type: 'error', message: err?.error || 'Failed to create folder' });
		}
	}

	function openRenameCategoryModal(categoryId: string) {
		const category = $activeCommunityCategories.find((c) => c.id === categoryId);
		if (!category) {
			contextMenu = null;
			return;
		}

		renameModal = { type: 'category', id: category.id, currentName: category.name };
		renameInput = category.name;
		renameError = '';
		contextMenu = null;
	}

	function closeRenameModal() {
		renameModal = null;
		renameInput = '';
		renameError = '';
		isRenaming = false;
	}

	async function handleSubmitRename() {
		if (!renameModal || isRenaming) return;

		const trimmedName = renameInput.trim();
		if (!trimmedName) {
			renameError = renameModal.type === 'channel' ? 'Channel name is required' : 'Folder name is required';
			return;
		}

		const isChannel = renameModal.type === 'channel';
		const nextName = isChannel ? trimmedName.toLowerCase().replace(/\s+/g, '-') : trimmedName;

		if (nextName === renameModal.currentName) {
			closeRenameModal();
			return;
		}

		if (isChannel && !/^[a-z0-9-]+$/.test(nextName)) {
			renameError = 'Channel names can only use letters, numbers, and hyphens';
			return;
		}

		isRenaming = true;
		renameError = '';

		try {
			if (isChannel) {
				await api.updateChannel(renameModal.id, { name: nextName });
				addToast({ type: 'success', message: `Renamed to #${nextName}` });
			} else {
				await api.updateCategory(renameModal.id, nextName);
				addToast({ type: 'success', message: 'Folder renamed' });
			}

			await loadChannelsAndCategories();
			closeRenameModal();
		} catch (err: any) {
			console.error('Failed to rename item:', err);
			renameError = err?.error || (isChannel ? 'Failed to rename channel' : 'Failed to rename folder');
			isRenaming = false;
		}
	}

	function handleContextRenameChannel() {
		if (!contextMenu || contextMenu.type !== 'channel') return;
		openRenameChannelModal(contextMenu.channelId);
	}

	function handleContextCopyChannelId() {
		if (!contextMenu || contextMenu.type !== 'channel') return;
		void handleCopyChannelId(contextMenu.channelId);
	}

	function handleContextRenameCategory() {
		if (!contextMenu || contextMenu.type !== 'category') return;
		openRenameCategoryModal(contextMenu.categoryId);
	}

	function handleOpenCommunitySettings() {
		if (!canOpenCommunitySettings) {
			addToast({ type: 'error', message: 'Insufficient permissions' });
			return;
		}
		openModal('communitySettings', { community: $activeCommunity });
	}

	function handleCreateChannel(categoryId: string | null) {
		if (!canManageChannels) {
			addToast({ type: 'error', message: 'Insufficient permissions' });
			return;
		}
		openModal('createChannel', { categoryId });
	}

	$effect(() => {
		if (!contextMenu) return;
		const close = (event: MouseEvent) => {
			if (event.button !== 0) return;
			contextMenu = null;
		};
		window.addEventListener('click', close);
		return () => {
			window.removeEventListener('click', close);
		};
	});
</script>

<aside
	class="w-60 bg-surface-hover flex flex-col border-r border-border z-10
	{$isMobileMenuOpen ? 'fixed left-36 top-0 bottom-0 z-50' : 'hidden md:flex'}"
>
	<!-- Community header -->
	{#if $activeCommunity}
		<button
			class="h-12 px-4 flex items-center justify-between border-b border-border hover:bg-surface-active transition-colors"
			onclick={handleOpenCommunitySettings}
		>
			<h2 class="font-semibold text-text-primary truncate">{$activeCommunity.name}</h2>
			<ChevronDown size={16} class="text-text-muted shrink-0" />
		</button>
	{/if}

	<!-- Channels list -->
	<div class="flex-1 overflow-y-auto overflow-x-hidden py-2">
		{#if isLoading}
			<div class="px-2 space-y-2">
				<div class="h-6 bg-surface rounded animate-pulse"></div>
				<div class="h-8 bg-surface rounded animate-pulse"></div>
				<div class="h-8 bg-surface rounded animate-pulse"></div>
			</div>
		{:else if $activeCommunityChannels.length === 0 && $activeCommunityCategories.length === 0}
			<div class="px-4 py-8 text-center">
				<p class="text-sm text-text-muted mb-4">No channels yet.</p>
				{#if canManageChannels}
					<Button
						variant="primary"
						size="sm"
						class="w-full"
						onclick={() => handleCreateChannel(null)}
					>
						<Plus size={16} class="mr-2" />
						Create Channel
					</Button>
				{/if}
			</div>
		{:else}
			<!-- Uncategorized channels header -->
			<div class="px-2 mb-2">
				<div class="flex items-center justify-between px-2 py-1 text-xs font-semibold text-text-muted uppercase tracking-wider group">
					<span>Text Channels</span>
					{#if canManageChannels}
						<Tooltip text="Create Folder" position="top">
							<button
								onclick={handleCreateCategory}
								class="p-1 opacity-60 group-hover:opacity-100 hover:text-text-primary transition-opacity"
							>
								<FolderPlus size={14} />
							</button>
						</Tooltip>
						<Tooltip text="Create Channel" position="top">
							<button
								onclick={() => handleCreateChannel(null)}
								class="p-1 opacity-60 group-hover:opacity-100 hover:text-text-primary transition-opacity"
							>
								<Plus size={14} />
							</button>
						</Tooltip>
					{/if}
				</div>
				{#if channelsByCategory['uncategorized']}
					{#each channelsByCategory['uncategorized'] as channel (channel.id)}
						{@const Icon = channelIcons[channel.type] || Hash}
						{@const unreadCount = $unreadCounts[channel.id] || 0}
						{@const isVoice = channel.type === 'voice'}
						{@const isActiveVoice = isVoice && $voiceChannelId === channel.id}
						{@const isSelected = $activeChannelId === channel.id}
						<button
							onclick={() => handleChannelClick(channel)}
							oncontextmenu={(event) => handleChannelContextMenu(event, channel)}
							draggable={canManageChannels && !isReorderingChannels}
							ondragstart={(event) => handleChannelDragStart(event, channel.id)}
							ondragover={(event) => handleChannelDragOver(event, channel.id)}
							ondragleave={() => handleChannelDragLeave(channel.id)}
							ondrop={(event) => handleChannelDrop(event, channel.id)}
							ondragend={handleChannelDragEnd}
							class="w-full px-2 py-1.5 rounded flex items-center gap-2 group {isActiveVoice
								? 'bg-success/10 text-success'
								: isSelected
									? 'bg-surface-active text-text-primary'
									: 'text-text-secondary hover:text-text-primary hover:bg-surface'} transition-colors {dragOverChannelId === channel.id ? 'ring-1 ring-primary' : ''}"
						>
							<Icon size={18} class="shrink-0 {isActiveVoice ? 'text-success' : 'opacity-70'}" />
							<span class="truncate flex-1 text-left text-sm {unreadCount > 0 ? 'font-semibold text-text-primary' : ''}">{channel.name}</span>
							{#if unreadCount > 0 && !isVoice}
								<span class="text-xs bg-danger text-white px-1.5 py-0.5 rounded-full">
									{unreadCount > 99 ? '99+' : unreadCount}
								</span>
							{/if}
						</button>
						{#if isVoice}
							<VoiceChannelUsers channelId={channel.id} />
						{/if}
					{/each}
					{/if}
				</div>

				<!-- Categorized channels -->
				{#each $activeCommunityCategories.sort((a, b) => a.position - b.position) as category (category.id)}
				{@const categoryChannels = channelsByCategory[category.id] || []}
				{@const isCollapsed = collapsedCategories.has(category.id)}

				<div class="mb-2">
					<button
						onclick={() => toggleCategory(category.id)}
						oncontextmenu={(event) => handleCategoryContextMenu(event, category)}
						class="w-full px-2 py-1 flex items-center gap-1 text-xs font-semibold text-text-muted uppercase tracking-wider hover:text-text-secondary group"
					>
						{#if isCollapsed}
							<ChevronRight size={12} />
						{:else}
							<ChevronDown size={12} />
						{/if}
						<span class="truncate">{category.name}</span>
						{#if canManageChannels}
							<Tooltip text="Create Channel" position="top">
								<button
									onclick={(e) => {
										e.stopPropagation();
										handleCreateChannel(category.id);
									}}
									class="ml-auto p-1 opacity-60 group-hover:opacity-100 hover:text-text-primary transition-opacity"
								>
									<Plus size={14} />
								</button>
							</Tooltip>
						{/if}
					</button>

					{#if !isCollapsed}
						<div class="px-2">
							{#each categoryChannels as channel (channel.id)}
								{@const Icon = channelIcons[channel.type] || Hash}
								{@const unreadCount = $unreadCounts[channel.id] || 0}
								{@const isVoice = channel.type === 'voice'}
								{@const isActiveVoice = isVoice && $voiceChannelId === channel.id}
								{@const isSelected = $activeChannelId === channel.id}
								<button
									onclick={() => handleChannelClick(channel)}
									oncontextmenu={(event) => handleChannelContextMenu(event, channel)}
									draggable={canManageChannels && !isReorderingChannels}
									ondragstart={(event) => handleChannelDragStart(event, channel.id)}
									ondragover={(event) => handleChannelDragOver(event, channel.id)}
									ondragleave={() => handleChannelDragLeave(channel.id)}
									ondrop={(event) => handleChannelDrop(event, channel.id)}
									ondragend={handleChannelDragEnd}
									class="w-full px-2 py-1.5 rounded flex items-center gap-2 group {isActiveVoice
										? 'bg-success/10 text-success'
										: isSelected
											? 'bg-surface-active text-text-primary'
											: 'text-text-secondary hover:text-text-primary hover:bg-surface'} transition-colors {dragOverChannelId === channel.id ? 'ring-1 ring-primary' : ''}"
								>
									<Icon size={18} class="shrink-0 {isActiveVoice ? 'text-success' : 'opacity-70'}" />
									<span class="truncate flex-1 text-left text-sm {unreadCount > 0 ? 'font-semibold text-text-primary' : ''}">{channel.name}</span>
									{#if unreadCount > 0 && !isVoice}
										<span class="text-xs bg-danger text-white px-1.5 py-0.5 rounded-full">
											{unreadCount > 99 ? '99+' : unreadCount}
										</span>
									{/if}
								</button>
								{#if isVoice}
									<VoiceChannelUsers channelId={channel.id} />
								{/if}
							{/each}
						</div>
					{/if}
				</div>
			{/each}
		{/if}
	</div>

	{#if contextMenu}
		<div
			class="fixed z-70 min-w-44 rounded-lg border border-border bg-surface p-1 shadow-xl"
			style="left: {contextMenu.x}px; top: {contextMenu.y}px"
		>
			{#if contextMenu.type === 'channel'}
				{#if canManageChannels}
					<button
						onclick={handleContextRenameChannel}
						class="w-full rounded px-3 py-2 text-left text-sm text-text-primary hover:bg-surface-hover"
					>
						Rename Channel
					</button>
				{/if}
				{#if developerModeEnabled}
					<button
						onclick={handleContextCopyChannelId}
						class="w-full rounded px-3 py-2 text-left text-sm text-text-primary hover:bg-surface-hover"
					>
						Copy Channel ID
					</button>
				{/if}
			{:else if contextMenu.type === 'category'}
				<button
					onclick={handleContextRenameCategory}
					class="w-full rounded px-3 py-2 text-left text-sm text-text-primary hover:bg-surface-hover"
				>
					Rename Folder
				</button>
			{/if}
		</div>
	{/if}

	<Modal
		isOpen={renameModal !== null}
		onclose={closeRenameModal}
		title={renameModal?.type === 'channel' ? 'Rename Channel' : 'Rename Folder'}
		size="sm"
	>
		<form
			onsubmit={(event) => {
				event.preventDefault();
				void handleSubmitRename();
			}}
			class="space-y-4"
		>
			<Input
				label={renameModal?.type === 'channel' ? 'Channel Name' : 'Folder Name'}
				bind:value={renameInput}
				error={renameError}
				maxlength={100}
				disabled={isRenaming}
				required
			/>
			<p class="text-xs text-text-muted">
				{renameModal?.type === 'channel'
					? 'Spaces will be converted to hyphens.'
					: 'Pick a clear name for this folder.'}
			</p>
			<div class="flex justify-end gap-2">
				<Button variant="ghost" onclick={closeRenameModal} disabled={isRenaming}>Cancel</Button>
				<Button variant="primary" type="submit" loading={isRenaming}>
					Save
				</Button>
			</div>
		</form>
	</Modal>

	<!-- Voice call controls -->
	<VoiceCallOverlay />

	<!-- User panel -->
	<div class="h-14 px-2 bg-background-secondary border-t border-border flex items-center gap-2">
		<div class="flex-1 min-w-0 text-sm">
			<p class="font-medium text-text-primary truncate">
				{$activeCommunity?.name || 'Select a community'}
			</p>
			<p class="text-xs text-text-muted truncate">
				{$activeCommunityChannels.length} channels
			</p>
		</div>
	</div>
</aside>
