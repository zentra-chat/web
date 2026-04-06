<script lang="ts">
	import { Input, Avatar, Button, Spinner } from '$lib/components/ui';
	import {
		Users,
		UserPlus,
		Clock3,
		Check,
		X,
		MessageSquare,
		UserMinus,
		Search
	} from 'lucide-svelte';
	import { api } from '$lib/api';
	import { currentUserId } from '$lib/stores/instance';
	import { addToast } from '$lib/stores/ui';
	import { setActiveDmConversationId, upsertDmConversation } from '$lib/stores/dm';
	import {
		activeFriendsSnapshot,
		getRelationshipFromSnapshot,
		loadFriendsData,
		sendFriendRequestAndRefresh,
		acceptFriendRequestAndRefresh,
		removeFriendRequestAndRefresh,
		removeFriendAndRefresh
	} from '$lib/stores/friends';
	import type { RelationshipStatus, User } from '$lib/types';

	interface Props {
		onOpenDm?: () => void;
	}

	let { onOpenDm = () => {} }: Props = $props();

	let activeTab = $state<'all' | 'online' | 'pending' | 'add'>('all');
	let addFriendQuery = $state('');
	let isSearching = $state(false);
	let searchError = $state<string | null>(null);
	let searchResults = $state<User[]>([]);
	let actionInFlight = $state<Record<string, boolean>>({});

	let snapshot = $derived($activeFriendsSnapshot);
	let visibleFriends = $derived.by(() => {
		if (activeTab === 'online') {
			return snapshot.friends.filter((friend) => friend.status !== 'offline' && friend.status !== 'invisible');
		}
		return snapshot.friends;
	});

	$effect(() => {
		void loadFriendsData();
	});

	$effect(() => {
		if (activeTab !== 'add') {
			searchResults = [];
			searchError = null;
			isSearching = false;
			return;
		}

		const query = addFriendQuery.trim();
		if (query.length < 2) {
			searchResults = [];
			searchError = null;
			isSearching = false;
			return;
		}

		let cancelled = false;
		isSearching = true;
		searchError = null;

		const handle = setTimeout(async () => {
			try {
				const result = await api.searchUsers(query, 1, 20);
				if (!cancelled) {
					searchResults = (result.data || []).filter((user) => user.id !== $currentUserId);
				}
			} catch (error) {
				if (!cancelled) {
					searchResults = [];
					searchError = 'Failed to search users';
				}
			} finally {
				if (!cancelled) {
					isSearching = false;
				}
			}
		}, 300);

		return () => {
			cancelled = true;
			clearTimeout(handle);
		};
	});

	function setActionLoading(userId: string, loading: boolean): void {
		actionInFlight = {
			...actionInFlight,
			[userId]: loading
		};
	}

	function isActionLoading(userId: string): boolean {
		return !!actionInFlight[userId];
	}

	function getDisplayName(user: User): string {
		return user.displayName || user.username;
	}

	function getPresenceLabel(user: User): string {
		if (user.status === 'invisible') return 'Offline';
		if (user.status === 'away') return 'Idle';
		return user.status.charAt(0).toUpperCase() + user.status.slice(1);
	}

	function relationshipLabel(status: RelationshipStatus): string {
		switch (status) {
			case 'friends':
				return 'Friends';
			case 'incoming_request':
				return 'Incoming Request';
			case 'outgoing_request':
				return 'Request Sent';
			case 'blocked':
				return 'Blocked';
			case 'blocked_by':
				return 'Unavailable';
			default:
				return 'Not Friends';
		}
	}

	async function runAction(
		userId: string,
		action: () => Promise<void>,
		successMessage: string,
		errorMessage: string
	): Promise<void> {
		if (isActionLoading(userId)) return;
		setActionLoading(userId, true);
		try {
			await action();
			addToast({ type: 'success', message: successMessage });
		} catch (error: any) {
			addToast({ type: 'error', message: error?.error || error?.message || errorMessage });
		} finally {
			setActionLoading(userId, false);
		}
	}

	async function handleSendRequest(userId: string): Promise<void> {
		await runAction(
			userId,
			() => sendFriendRequestAndRefresh(userId),
			'Friend request sent',
			'Failed to send friend request'
		);
	}

	async function handleAcceptRequest(userId: string): Promise<void> {
		await runAction(
			userId,
			() => acceptFriendRequestAndRefresh(userId),
			'Friend request accepted',
			'Failed to accept friend request'
		);
	}

	async function handleRemoveRequest(userId: string): Promise<void> {
		await runAction(
			userId,
			() => removeFriendRequestAndRefresh(userId),
			'Friend request removed',
			'Failed to remove friend request'
		);
	}

	async function handleRemoveFriend(userId: string): Promise<void> {
		await runAction(
			userId,
			() => removeFriendAndRefresh(userId),
			'Friend removed',
			'Failed to remove friend'
		);
	}

	async function handleMessage(userId: string): Promise<void> {
		if (isActionLoading(userId)) return;
		setActionLoading(userId, true);
		try {
			const conversation = await api.createDmConversation(userId);
			upsertDmConversation(conversation);
			setActiveDmConversationId(conversation.id);
			onOpenDm();
		} catch (error: any) {
			addToast({ type: 'error', message: error?.error || error?.message || 'Failed to open DM' });
		} finally {
			setActionLoading(userId, false);
		}
	}
</script>

<div class="flex-1 min-h-0 flex flex-col">
	<div class="px-4 py-3 border-b border-border bg-surface-hover">
		<div class="flex flex-wrap items-center gap-2">
			<Button variant={activeTab === 'all' ? 'secondary' : 'ghost'} size="sm" onclick={() => (activeTab = 'all')}>
				<Users size={14} />
				All ({snapshot.friends.length})
			</Button>
			<Button variant={activeTab === 'online' ? 'secondary' : 'ghost'} size="sm" onclick={() => (activeTab = 'online')}>
				<Users size={14} />
				Online ({snapshot.friends.filter((f) => f.status !== 'offline' && f.status !== 'invisible').length})
			</Button>
			<Button variant={activeTab === 'pending' ? 'secondary' : 'ghost'} size="sm" onclick={() => (activeTab = 'pending')}>
				<Clock3 size={14} />
				Pending ({snapshot.incoming.length + snapshot.outgoing.length})
			</Button>
			<Button variant={activeTab === 'add' ? 'secondary' : 'ghost'} size="sm" onclick={() => (activeTab = 'add')}>
				<UserPlus size={14} />
				Add Friend
			</Button>
		</div>
	</div>

	<div class="flex-1 min-h-0 overflow-y-auto p-4">
		{#if snapshot.loading && !snapshot.loaded}
			<div class="h-full flex items-center justify-center">
				<Spinner size="md" />
			</div>
		{:else if activeTab === 'add'}
			<div class="max-w-2xl space-y-4">
				<div>
					<h2 class="text-base font-semibold text-text-primary">Add Friend</h2>
					<p class="text-sm text-text-muted mt-1">
						Search by username or display name and send a friend request.
					</p>
				</div>

				<div class="relative">
					<Input
						placeholder="Type at least 2 characters"
						bind:value={addFriendQuery}
						class="w-full"
					/>
					<Search size={16} class="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted" />
				</div>

				{#if addFriendQuery.trim().length >= 2}
					{#if isSearching}
						<div class="flex items-center gap-2 text-sm text-text-muted">
							<Spinner size="sm" />
							Searching users...
						</div>
					{:else if searchError}
						<p class="text-sm text-error">{searchError}</p>
					{:else if searchResults.length === 0}
						<p class="text-sm text-text-muted">No users found.</p>
					{:else}
						<div class="space-y-2">
							{#each searchResults as user (user.id)}
								{@const relationship = getRelationshipFromSnapshot(snapshot, user.id)}
								<div class="rounded-lg border border-border bg-surface px-3 py-3 flex items-center gap-3">
									<Avatar {user} size="md" />
									<div class="flex-1 min-w-0">
										<p class="text-sm font-medium text-text-primary truncate">{getDisplayName(user)}</p>
										<p class="text-xs text-text-muted truncate">@{user.username} • {relationshipLabel(relationship)}</p>
									</div>
									{#if relationship === 'none'}
										<Button
											size="sm"
											onclick={() => handleSendRequest(user.id)}
											disabled={isActionLoading(user.id)}
										>
											<UserPlus size={14} />
											Add
										</Button>
									{:else if relationship === 'incoming_request'}
										<div class="flex items-center gap-2">
											<Button
												variant="secondary"
												size="sm"
												onclick={() => handleAcceptRequest(user.id)}
												disabled={isActionLoading(user.id)}
											>
												<Check size={14} />
												Accept
											</Button>
											<Button
												variant="ghost"
												size="sm"
												onclick={() => handleRemoveRequest(user.id)}
												disabled={isActionLoading(user.id)}
											>
												<X size={14} />
												Ignore
											</Button>
										</div>
									{:else if relationship === 'outgoing_request'}
										<Button
											variant="ghost"
											size="sm"
											onclick={() => handleRemoveRequest(user.id)}
											disabled={isActionLoading(user.id)}
										>
											<X size={14} />
											Cancel
										</Button>
									{:else}
										<Button size="sm" variant="ghost" disabled>
											{relationshipLabel(relationship)}
										</Button>
									{/if}
								</div>
							{/each}
						</div>
					{/if}
				{/if}
			</div>
		{:else if activeTab === 'pending'}
			<div class="space-y-6">
				<div>
					<h3 class="text-sm font-semibold text-text-primary mb-2">Incoming Requests</h3>
					{#if snapshot.incoming.length === 0}
						<p class="text-sm text-text-muted">No incoming requests.</p>
					{:else}
						<div class="space-y-2">
							{#each snapshot.incoming as request (request.user.id)}
								<div class="rounded-lg border border-border bg-surface px-3 py-3 flex items-center gap-3">
									<Avatar user={request.user} size="md" />
									<div class="flex-1 min-w-0">
										<p class="text-sm font-medium text-text-primary truncate">{getDisplayName(request.user)}</p>
										<p class="text-xs text-text-muted">@{request.user.username}</p>
									</div>
									<div class="flex items-center gap-2">
										<Button
											variant="secondary"
											size="sm"
											onclick={() => handleAcceptRequest(request.user.id)}
											disabled={isActionLoading(request.user.id)}
										>
											<Check size={14} />
											Accept
										</Button>
										<Button
											variant="ghost"
											size="sm"
											onclick={() => handleRemoveRequest(request.user.id)}
											disabled={isActionLoading(request.user.id)}
										>
											<X size={14} />
											Ignore
										</Button>
									</div>
								</div>
							{/each}
						</div>
					{/if}
				</div>

				<div>
					<h3 class="text-sm font-semibold text-text-primary mb-2">Outgoing Requests</h3>
					{#if snapshot.outgoing.length === 0}
						<p class="text-sm text-text-muted">No outgoing requests.</p>
					{:else}
						<div class="space-y-2">
							{#each snapshot.outgoing as request (request.user.id)}
								<div class="rounded-lg border border-border bg-surface px-3 py-3 flex items-center gap-3">
									<Avatar user={request.user} size="md" />
									<div class="flex-1 min-w-0">
										<p class="text-sm font-medium text-text-primary truncate">{getDisplayName(request.user)}</p>
										<p class="text-xs text-text-muted">@{request.user.username}</p>
									</div>
									<Button
										variant="ghost"
										size="sm"
										onclick={() => handleRemoveRequest(request.user.id)}
										disabled={isActionLoading(request.user.id)}
									>
										<X size={14} />
										Cancel
									</Button>
								</div>
							{/each}
						</div>
					{/if}
				</div>
			</div>
		{:else}
			{#if visibleFriends.length === 0}
				<div class="h-full flex flex-col items-center justify-center text-center px-6">
					<div class="w-14 h-14 rounded-full bg-surface flex items-center justify-center mb-3">
						<Users size={22} class="text-text-muted" />
					</div>
					<p class="text-sm text-text-muted">
						{activeTab === 'online' ? 'No friends are online right now.' : 'No friends yet.'}
					</p>
					{#if activeTab !== 'online'}
						<p class="text-xs text-text-muted">Use Add Friend to send your first request.</p>
					{/if}
				</div>
			{:else}
				<div class="space-y-2">
					{#each visibleFriends as friend (friend.id)}
						<div class="rounded-lg border border-border bg-surface px-3 py-3 flex items-center gap-3">
							<Avatar user={friend} size="md" />
							<div class="flex-1 min-w-0">
								<p class="text-sm font-medium text-text-primary truncate">{getDisplayName(friend)}</p>
								<p class="text-xs text-text-muted truncate">@{friend.username} • {getPresenceLabel(friend)}</p>
							</div>
							<div class="flex items-center gap-2">
								<Button
									variant="secondary"
									size="sm"
									onclick={() => handleMessage(friend.id)}
									disabled={isActionLoading(friend.id)}
								>
									<MessageSquare size={14} />
									Message
								</Button>
								<Button
									variant="ghost"
									size="sm"
									onclick={() => handleRemoveFriend(friend.id)}
									disabled={isActionLoading(friend.id)}
								>
									<UserMinus size={14} />
									Remove
								</Button>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		{/if}
	</div>
</div>
