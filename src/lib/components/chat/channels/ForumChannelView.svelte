<script lang="ts">
	import { onMount } from 'svelte';
	import { MessagesSquare, Plus, Clock, ArrowUp, MessageCircle, ChevronLeft } from 'lucide-svelte';
	import { Button, Spinner, Avatar, Input, Textarea } from '$lib/components/ui';
	import { MessageList, MessageInput } from '$lib/components/chat';
	import { activeChannel } from '$lib/stores/community';
	import { api } from '$lib/api';
	import type { Message } from '$lib/types';

	// Forum state
	let isLoading = $state(true);
	let topics = $state<ForumTopic[]>([]);
	let selectedTopic = $state<ForumTopic | null>(null);
	let showCreateForm = $state(false);
	let newTopicTitle = $state('');
	let newTopicBody = $state('');
	let isCreating = $state(false);
	let sortBy = $state<'latest' | 'popular'>('latest');

	// A forum topic is really a message that acts as a thread starter
	interface ForumTopic {
		id: string;
		title: string;
		author: { username: string; displayName: string | null; avatarUrl: string | null };
		content: string;
		replyCount: number;
		lastActivityAt: string;
		createdAt: string;
	}

	// For now, topics are derived from messages in the channel.
	// Each top-level message (no replyToId) is treated as a topic.
	// The "title" comes from the first line of the message content.
	onMount(async () => {
		await loadTopics();
	});

	async function loadTopics() {
		if (!$activeChannel) return;
		isLoading = true;
		try {
			const messages = await api.getMessages($activeChannel.id, { limit: 50 });
			// Top-level messages are forum topics
			const topLevel = (messages || []).filter((m: Message) => !m.replyToId);
			topics = topLevel.map((msg: Message) => {
				const lines = (msg.content || '').split('\n');
				const title = lines[0] || 'Untitled';
				const body = lines.slice(1).join('\n').trim();
				return {
					id: msg.id,
					title,
					author: msg.author,
					content: body,
					replyCount: 0, // We'll count replies if available
					lastActivityAt: msg.updatedAt || msg.createdAt,
					createdAt: msg.createdAt
				};
			});
		} catch (err) {
			console.error('Failed to load forum topics:', err);
		} finally {
			isLoading = false;
		}
	}

	function openTopic(topic: ForumTopic) {
		selectedTopic = topic;
	}

	function backToTopics() {
		selectedTopic = null;
	}

	async function createTopic() {
		if (!newTopicTitle.trim() || !$activeChannel || isCreating) return;
		isCreating = true;
		try {
			// Combine title + body into a single message (first line = title)
			const content = newTopicBody.trim()
				? `${newTopicTitle.trim()}\n${newTopicBody.trim()}`
				: newTopicTitle.trim();

			await api.sendMessage($activeChannel.id, { content });
			newTopicTitle = '';
			newTopicBody = '';
			showCreateForm = false;
			await loadTopics();
		} catch (err) {
			console.error('Failed to create topic:', err);
		} finally {
			isCreating = false;
		}
	}

	function formatDate(dateStr: string): string {
		const date = new Date(dateStr);
		const now = new Date();
		const diffMs = now.getTime() - date.getTime();
		const diffHrs = diffMs / (1000 * 60 * 60);

		if (diffHrs < 1) return `${Math.floor(diffMs / (1000 * 60))}m ago`;
		if (diffHrs < 24) return `${Math.floor(diffHrs)}h ago`;
		if (diffHrs < 168) return `${Math.floor(diffHrs / 24)}d ago`;
		return date.toLocaleDateString();
	}

	let sortedTopics = $derived(
		[...topics].sort((a, b) => {
			if (sortBy === 'popular') return b.replyCount - a.replyCount;
			return new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime();
		})
	);
</script>

<div class="flex-1 flex flex-col min-h-0">
	<!-- Channel header -->
	<div class="h-12 px-4 flex items-center gap-2 border-b border-border shrink-0">
		{#if selectedTopic}
			<button onclick={backToTopics} class="p-1 hover:bg-surface rounded transition-colors">
				<ChevronLeft size={20} class="text-text-muted" />
			</button>
			<h2 class="font-semibold text-text-primary truncate">{selectedTopic.title}</h2>
		{:else}
			<MessagesSquare size={20} class="text-text-muted" />
			<h2 class="font-semibold text-text-primary">{$activeChannel?.name || 'Forum'}</h2>
			{#if $activeChannel?.topic}
				<span class="text-xs text-text-muted ml-2 truncate">{$activeChannel.topic}</span>
			{/if}
		{/if}
	</div>

	{#if selectedTopic}
		<!-- Thread view for a specific topic -->
		<div class="flex-1 flex flex-col min-h-0">
			<!-- Topic header/OP -->
			<div class="px-4 py-3 border-b border-border bg-surface/50">
				<div class="flex items-center gap-2 mb-2">
					<Avatar src={selectedTopic.author.avatarUrl} alt={selectedTopic.author.displayName || selectedTopic.author.username} size="sm" />
					<span class="text-sm font-medium text-text-primary">
						{selectedTopic.author.displayName || selectedTopic.author.username}
					</span>
					<span class="text-xs text-text-muted">{formatDate(selectedTopic.createdAt)}</span>
				</div>
				{#if selectedTopic.content}
					<p class="text-sm text-text-secondary whitespace-pre-wrap">{selectedTopic.content}</p>
				{/if}
			</div>

			<!-- Replies (reuse MessageList filtering by replyToId = topic.id) -->
			<MessageList channelId={$activeChannel?.id ?? ''} />
			<MessageInput channelId={$activeChannel?.id ?? ''} />
		</div>
	{:else}
		<!-- Topic list -->
		<div class="flex-1 overflow-y-auto">
			<!-- Toolbar -->
			<div class="px-4 py-3 flex items-center gap-3 border-b border-border">
				<Button variant="primary" size="sm" onclick={() => { showCreateForm = true; }}>
					<Plus size={16} class="mr-1" />
					New Topic
				</Button>
				<div class="flex items-center gap-1 ml-auto">
					<button
						onclick={() => { sortBy = 'latest'; }}
						class="px-2 py-1 text-xs rounded transition-colors {sortBy === 'latest' ? 'bg-primary/10 text-primary' : 'text-text-muted hover:text-text-primary'}"
					>
						<Clock size={12} class="inline mr-1" />
						Latest
					</button>
					<button
						onclick={() => { sortBy = 'popular'; }}
						class="px-2 py-1 text-xs rounded transition-colors {sortBy === 'popular' ? 'bg-primary/10 text-primary' : 'text-text-muted hover:text-text-primary'}"
					>
						<ArrowUp size={12} class="inline mr-1" />
						Popular
					</button>
				</div>
			</div>

			{#if isLoading}
				<div class="flex items-center justify-center py-12">
					<Spinner size="lg" />
				</div>
			{:else if sortedTopics.length === 0}
				<div class="flex flex-col items-center justify-center py-16 text-center px-4">
					<div class="w-20 h-20 rounded-full bg-surface flex items-center justify-center mb-4">
						<MessagesSquare size={40} class="text-text-muted" />
					</div>
					<h3 class="text-lg font-semibold text-text-primary mb-2">No topics yet</h3>
					<p class="text-text-muted max-w-sm">
						Start a discussion by creating the first topic.
					</p>
				</div>
			{:else}
				<div class="divide-y divide-border">
					{#each sortedTopics as topic (topic.id)}
						<button
							onclick={() => openTopic(topic)}
							class="w-full px-4 py-3 text-left hover:bg-surface/50 transition-colors"
						>
							<div class="flex items-start gap-3">
								<Avatar src={topic.author.avatarUrl} alt={topic.author.displayName || topic.author.username} size="sm" />
								<div class="flex-1 min-w-0">
									<h4 class="text-sm font-semibold text-text-primary truncate">{topic.title}</h4>
									{#if topic.content}
										<p class="text-xs text-text-muted mt-0.5 line-clamp-2">{topic.content}</p>
									{/if}
									<div class="flex items-center gap-3 mt-1.5">
										<span class="text-xs text-text-muted">
											{topic.author.displayName || topic.author.username}
										</span>
										<span class="text-xs text-text-muted flex items-center gap-0.5">
											<MessageCircle size={10} />
											{topic.replyCount}
										</span>
										<span class="text-xs text-text-muted">
											{formatDate(topic.lastActivityAt)}
										</span>
									</div>
								</div>
							</div>
						</button>
					{/each}
				</div>
			{/if}
		</div>
	{/if}
</div>

<!-- Create topic modal (inline) -->
{#if showCreateForm}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
		<div class="bg-background rounded-xl border border-border shadow-2xl w-full max-w-lg mx-4 p-6">
			<h3 class="text-lg font-semibold text-text-primary mb-4">New Topic</h3>
			<form
				onsubmit={(e) => { e.preventDefault(); createTopic(); }}
				class="space-y-4"
			>
				<Input
					label="Title"
					bind:value={newTopicTitle}
					placeholder="What do you want to discuss?"
					required
					maxlength={200}
				/>
				<Textarea
					label="Details (optional)"
					bind:value={newTopicBody}
					placeholder="Add more context..."
					rows={4}
					maxlength={4000}
				/>
				<div class="flex justify-end gap-3">
					<Button variant="ghost" onclick={() => { showCreateForm = false; }} disabled={isCreating}>
						Cancel
					</Button>
					<Button type="submit" disabled={isCreating || !newTopicTitle.trim()}>
						{#if isCreating}
							<Spinner size="sm" />
							Creating...
						{:else}
							Post Topic
						{/if}
					</Button>
				</div>
			</form>
		</div>
	</div>
{/if}
