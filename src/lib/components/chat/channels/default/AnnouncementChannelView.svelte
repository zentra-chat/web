<script lang="ts">
	import {
		activeChannel,
		activeCommunity,
		activeCommunityMembers,
		memberHasPermission,
		Permission
	} from '$lib/stores/community';
	import { currentUserId } from '$lib/stores/instance';
	import MessageList from '$lib/components/chat/MessageList.svelte';
	import MessageInput from '$lib/components/chat/MessageInput.svelte';

	$: isOwner = Boolean($activeCommunity && $activeCommunity.ownerId === $currentUserId);
	$: myMember = $activeCommunityMembers.find((m) => m.userId === $currentUserId) || null;
	$: canPost =
		isOwner ||
		memberHasPermission(myMember, Permission.ManageChannels) ||
		memberHasPermission(myMember, Permission.ManageMessages);
</script>

<div class="flex-1 flex flex-col min-h-0">
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
