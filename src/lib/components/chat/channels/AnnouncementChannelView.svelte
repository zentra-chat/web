<script lang="ts">
	import { MessageList, MessageInput } from '$lib/components/chat';
	import { Megaphone } from 'lucide-svelte';
	import { activeChannel } from '$lib/stores/community';
	import { activeCommunity, activeCommunityMembers, memberHasPermission, Permission } from '$lib/stores/community';
	import { currentUserId } from '$lib/stores/instance';

	let isOwner = $derived(Boolean($activeCommunity && $activeCommunity.ownerId === $currentUserId));
	let myMember = $derived($activeCommunityMembers.find((m) => m.userId === $currentUserId) || null);
	let canPost = $derived(
		isOwner ||
		memberHasPermission(myMember, Permission.ManageChannels) ||
		memberHasPermission(myMember, Permission.ManageMessages)
	);
</script>

<div class="flex-1 flex flex-col min-h-0">
	<!-- Channel header -->
	<div class="h-12 px-4 flex items-center gap-2 border-b border-border shrink-0">
		<Megaphone size={20} class="text-text-muted" />
		<h2 class="font-semibold text-text-primary">{$activeChannel?.name || 'Announcements'}</h2>
		{#if $activeChannel?.topic}
			<span class="text-xs text-text-muted ml-2 truncate">{$activeChannel.topic}</span>
		{/if}
	</div>

	<MessageList channelId={$activeChannel?.id ?? ''} />

	{#if canPost}
		<MessageInput channelId={$activeChannel?.id ?? ''} />
	{:else}
		<div class="px-4 py-3 border-t border-border bg-surface">
			<p class="text-sm text-text-muted text-center">
				Only moderators can post in announcement channels.
			</p>
		</div>
	{/if}
</div>
