<script lang="ts">
	import { onMount } from 'svelte';
	import {
		Hash,
		Megaphone,
		Image,
		ChevronDown,
		ChevronRight,
		Plus,
		Settings
	} from '$lib/components/icons';
	import { Tooltip, Button } from '$lib/components/ui';
	import {
		activeCommunity,
		activeCommunityChannels,
		activeCommunityCategories,
		activeChannelId,
		selectChannel,
		setChannels,
		setCategories,
		unreadCounts
	} from '$lib/stores/community';
	import { openModal, isMobileMenuOpen } from '$lib/stores/ui';
	import { api } from '$lib/api';
	import type { Channel, ChannelCategory } from '$lib/types';

	let collapsedCategories = $state<Set<string>>(new Set());
	let isLoading = $state(false);

	const channelIcons: Record<string, any> = {
		text: Hash,
		announcement: Megaphone,
		gallery: Image,
		forum: Hash,
		voice: Megaphone
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
		if (!$activeCommunity) return;

		isLoading = true;
		try {
			const [channels, categories] = await Promise.all([
				api.getChannels($activeCommunity.id),
				api.getCategories($activeCommunity.id)
			]);
			setChannels($activeCommunity.id, channels);
			setCategories($activeCommunity.id, categories);

			// Select first channel if none selected
			if (!$activeChannelId && channels.length > 0) {
				selectChannel(channels[0].id);
			}
		} catch (err) {
			console.error('Failed to load channels:', err);
		} finally {
			isLoading = false;
		}
	});

	function toggleCategory(categoryId: string) {
		collapsedCategories = new Set(collapsedCategories);
		if (collapsedCategories.has(categoryId)) {
			collapsedCategories.delete(categoryId);
		} else {
			collapsedCategories.add(categoryId);
		}
	}

	function handleChannelClick(channel: Channel) {
		selectChannel(channel.id);
	}
</script>

<aside
	class="w-60 bg-surface-hover flex flex-col border-r border-border z-10
	{$isMobileMenuOpen ? 'fixed left-36 top-0 bottom-0 z-50' : 'hidden md:flex'}"
>
	<!-- Community header -->
	{#if $activeCommunity}
		<button
			class="h-12 px-4 flex items-center justify-between border-b border-border hover:bg-surface-active transition-colors"
			onclick={() => openModal('communitySettings', { community: $activeCommunity })}
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
				<Button
					variant="primary"
					size="sm"
					class="w-full"
					onclick={() => openModal('createChannel', { categoryId: null })}
				>
					<Plus size={16} class="mr-2" />
					Create Channel
				</Button>
			</div>
		{:else}
			<!-- Uncategorized channels header -->
			<div class="px-2 mb-2">
				<div class="flex items-center justify-between px-2 py-1 text-xs font-semibold text-text-muted uppercase tracking-wider group">
					<span>Text Channels</span>
					<Tooltip text="Create Channel" position="top">
						<button
							onclick={() => openModal('createChannel', { categoryId: null })}
							class="p-1 opacity-60 group-hover:opacity-100 hover:text-text-primary transition-opacity"
						>
							<Plus size={14} />
						</button>
					</Tooltip>
				</div>
				{#if channelsByCategory['uncategorized']}
					{#each channelsByCategory['uncategorized'] as channel (channel.id)}
						{@const Icon = channelIcons[channel.type] || Hash}
						{@const unreadCount = $unreadCounts[channel.id] || 0}
						<button
							onclick={() => handleChannelClick(channel)}
							class="w-full px-2 py-1.5 rounded flex items-center gap-2 group {$activeChannelId ===
							channel.id
								? 'bg-surface-active text-text-primary'
								: 'text-text-secondary hover:text-text-primary hover:bg-surface'} transition-colors"
						>
							<Icon size={18} class="shrink-0 opacity-70" />
							<span class="truncate flex-1 text-left text-sm {unreadCount > 0 ? 'font-semibold text-text-primary' : ''}">{channel.name}</span>
							{#if unreadCount > 0}
								<span class="text-xs bg-danger text-white px-1.5 py-0.5 rounded-full">
									{unreadCount > 99 ? '99+' : unreadCount}
								</span>
							{/if}
						</button>
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
						class="w-full px-2 py-1 flex items-center gap-1 text-xs font-semibold text-text-muted uppercase tracking-wider hover:text-text-secondary group"
					>
						{#if isCollapsed}
							<ChevronRight size={12} />
						{:else}
							<ChevronDown size={12} />
						{/if}
						<span class="truncate">{category.name}</span>
						<Tooltip text="Create Channel" position="top">
							<button
								onclick={(e) => {
									e.stopPropagation();
									openModal('createChannel', { categoryId: category.id });
								}}
								class="ml-auto p-1 opacity-60 group-hover:opacity-100 hover:text-text-primary transition-opacity"
							>
								<Plus size={14} />
							</button>
						</Tooltip>
					</button>

					{#if !isCollapsed}
						<div class="px-2">
							{#each categoryChannels as channel (channel.id)}
								{@const Icon = channelIcons[channel.type] || Hash}
								{@const unreadCount = $unreadCounts[channel.id] || 0}
								<button
									onclick={() => handleChannelClick(channel)}
									class="w-full px-2 py-1.5 rounded flex items-center gap-2 group {$activeChannelId ===
									channel.id
										? 'bg-surface-active text-text-primary'
										: 'text-text-secondary hover:text-text-primary hover:bg-surface'} transition-colors"
								>
									<Icon size={18} class="shrink-0 opacity-70" />
									<span class="truncate flex-1 text-left text-sm {unreadCount > 0 ? 'font-semibold text-text-primary' : ''}">{channel.name}</span>
									{#if unreadCount > 0}
										<span class="text-xs bg-danger text-white px-1.5 py-0.5 rounded-full">
											{unreadCount > 99 ? '99+' : unreadCount}
										</span>
									{/if}
								</button>
							{/each}
						</div>
					{/if}
				</div>
			{/each}
		{/if}
	</div>

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
