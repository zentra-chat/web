<script lang="ts">
	import { get } from 'svelte/store';
	import { Input, Avatar, Spinner } from '$lib/components/ui';
	import { MessageSquare, Search } from 'lucide-svelte';
	import { MessageList, MessageInput } from '$lib/components/chat';
	import { api } from '$lib/api';
	import { activeInstance, currentUserId, activeAuth } from '$lib/stores/instance';
	import {
		dmConversationsCache,
		activeDmConversationId,
		setDmConversations,
		setActiveDmConversationId,
		upsertDmConversation
	} from '$lib/stores/dm';
	import type { DMConversation, User } from '$lib/types';

	const dmLoadInFlightByInstance: Record<string, boolean> = {};
	const dmRetryAfterByInstance: Record<string, number> = {};

	let isLoading = $state(true);
	let searchQuery = $state('');
	let isSearching = $state(false);
	let searchResults = $state<User[]>([]);
	let searchError = $state<string | null>(null);

	let conversations = $derived($dmConversationsCache[$activeInstance?.id || ''] || []);

	async function loadDmConversationsFor(instanceId: string): Promise<void> {
		if (!$activeAuth) {
			isLoading = false;
			return;
		}

		const cached = get(dmConversationsCache)[instanceId] || [];
		if (cached.length > 0) {
			isLoading = false;
			if (cached.length > 0 && !$activeDmConversationId) {
				setActiveDmConversationId(cached[0].id);
			}
			return;
		}

		if (dmLoadInFlightByInstance[instanceId]) {
			isLoading = false;
			return;
		}

		const retryAfter = dmRetryAfterByInstance[instanceId] || 0;
		if (Date.now() < retryAfter) {
			isLoading = false;
			return;
		}

		isLoading = true;
		dmLoadInFlightByInstance[instanceId] = true;
		try {
			const list = await api.getDmConversations();
			setDmConversations(list || []);
			dmRetryAfterByInstance[instanceId] = 0;

			if (list.length > 0 && !$activeDmConversationId) {
				setActiveDmConversationId(list[0].id);
			}
		} catch (err) {
			console.error('Failed to load DM conversations:', err);
			dmRetryAfterByInstance[instanceId] = Date.now() + 5000;
		} finally {
			dmLoadInFlightByInstance[instanceId] = false;
			isLoading = false;
		}
	}

	$effect(() => {
		const instance = $activeInstance;
		const auth = $activeAuth;

		if (!instance || !auth) {
			isLoading = false;
			return;
		}

		void loadDmConversationsFor(instance.id);
	});

	$effect(() => {
		if (searchQuery.trim().length < 2) {
			searchResults = [];
			searchError = null;
			return;
		}

		let cancelled = false;
		isSearching = true;
		searchError = null;

		const handle = setTimeout(async () => {
			try {
				const result = await api.searchUsers(searchQuery.trim(), 1, 10);
				if (!cancelled) {
					const list = result.data || [];
					searchResults = list.filter((user) => user.id !== $currentUserId);
				}
			} catch (err) {
				if (!cancelled) {
					searchError = 'Failed to search users';
					searchResults = [];
				}
			} finally {
				if (!cancelled) isSearching = false;
			}
		}, 300);

		return () => {
			cancelled = true;
			clearTimeout(handle);
		};
	});

	function getOtherParticipant(conversation: DMConversation): User | undefined {
		return conversation.participants.find((p) => p.id !== $currentUserId);
	}

	async function startConversation(userId: string) {
		if (userId === $currentUserId) return;
		try {
			const conversation = await api.createDmConversation(userId);
			upsertDmConversation(conversation);
			setActiveDmConversationId(conversation.id);
			searchQuery = '';
			searchResults = [];
		} catch (err) {
			console.error('Failed to start DM:', err);
		}
	}

	function handleSelectConversation(conversationId: string) {
		setActiveDmConversationId(conversationId);
	}

	function getLastMessagePreview(conversation: DMConversation): string {
		const last = conversation.lastMessage;
		if (!last) return 'No messages yet';
		if (last.content) return last.content;
		if (last.attachments && last.attachments.length > 0) {
			return last.attachments.length === 1 ? 'Attachment' : 'Attachments';
		}
		return 'No messages yet';
	}
</script>

<div class="flex-1 flex min-h-0">
	<aside class="w-72 border-r border-border bg-surface-hover flex flex-col">
		<div class="p-4 border-b border-border">
			<h2 class="text-lg font-semibold text-text-primary">Direct Messages</h2>
			<div class="mt-3 relative">
				<Input
					placeholder="Search users to message"
					bind:value={searchQuery}
					class="w-full"
				/>
				<Search size={16} class="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted" />
			</div>
		</div>

		{#if searchQuery.trim().length >= 2}
			<div class="px-2 py-2 border-b border-border bg-background">
				{#if isSearching}
					<div class="flex items-center gap-2 px-2 py-2 text-sm text-text-muted">
						<Spinner size="sm" />
						Searching...
					</div>
				{:else if searchError}
					<p class="px-2 py-2 text-sm text-error">{searchError}</p>
				{:else if searchResults.length === 0}
					<p class="px-2 py-2 text-sm text-text-muted">No users found.</p>
				{:else}
					{#each searchResults as user (user.id)}
						<button
							class="w-full flex items-center gap-3 px-2 py-2 rounded hover:bg-surface transition-colors"
							onclick={() => startConversation(user.id)}
						>
							<Avatar user={user} size="sm" />
							<div class="flex-1 text-left">
								<p class="text-sm text-text-primary">
									{user.displayName || user.username}
								</p>
								<p class="text-xs text-text-muted">@{user.username}</p>
							</div>
						</button>
					{/each}
				{/if}
			</div>
		{/if}

		<div class="flex-1 overflow-y-auto">
			{#if isLoading}
				<div class="flex items-center justify-center h-full">
					<Spinner size="md" />
				</div>
			{:else if conversations.length === 0}
				<div class="flex flex-col items-center justify-center text-center px-6 py-10">
					<div class="w-12 h-12 rounded-full bg-surface flex items-center justify-center mb-3">
						<MessageSquare size={20} class="text-text-muted" />
					</div>
					<p class="text-sm text-text-muted">No conversations yet.</p>
					<p class="text-xs text-text-muted">Search for a user to start chatting.</p>
				</div>
			{:else}
				{#each conversations as conversation (conversation.id)}
					{@const otherUser = getOtherParticipant(conversation)}
					<button
						onclick={() => handleSelectConversation(conversation.id)}
						class="w-full px-3 py-3 flex items-center gap-3 hover:bg-surface transition-colors border-b border-border/60
						{$activeDmConversationId === conversation.id ? 'bg-surface-active' : ''}"
					>
						<Avatar user={otherUser} size="md" />
						<div class="flex-1 min-w-0 text-left">
							<p class="text-sm font-medium text-text-primary truncate">
								{otherUser?.displayName || otherUser?.username || 'Unknown'}
							</p>
							<p class="text-xs text-text-muted truncate">
								{getLastMessagePreview(conversation)}
							</p>
						</div>
						{#if conversation.unreadCount > 0}
							<span class="text-xs bg-danger text-white px-2 py-0.5 rounded-full">
								{conversation.unreadCount > 99 ? '99+' : conversation.unreadCount}
							</span>
						{/if}
					</button>
				{/each}
			{/if}
		</div>
	</aside>

	<section class="flex-1 min-w-0 flex flex-col">
		{#if $activeDmConversationId}
			<MessageList dmConversationId={$activeDmConversationId} />
			<MessageInput dmConversationId={$activeDmConversationId} />
		{:else}
			<div class="flex-1 flex items-center justify-center text-center p-8">
				<div class="max-w-md">
					<div class="w-16 h-16 rounded-full bg-surface flex items-center justify-center mb-4 mx-auto">
						<MessageSquare size={28} class="text-text-muted" />
					</div>
					<h2 class="text-lg font-semibold text-text-primary mb-2">Select a conversation</h2>
					<p class="text-sm text-text-muted">Choose a conversation or start a new one.</p>
				</div>
			</div>
		{/if}
	</section>
</div>
