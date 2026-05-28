<script lang="ts">
	import { onMount } from 'svelte';
	import type { Component } from 'svelte';
	import { getSDK } from '@zentra/plugin-sdk/runtime';

	const sdk = getSDK();
	const { activeChannel, activeCommunity, activeCommunityMembers, currentUserId } = sdk.stores;
	const { memberHasPermission, Permission } = sdk.permissions;

	let MessageListComponent: Component | null = null;
	let MessageInputComponent: Component | null = null;

	$: isOwner = Boolean($activeCommunity && $activeCommunity.ownerId === $currentUserId);
	$: myMember = $activeCommunityMembers.find((m) => m.userId === $currentUserId) || null;
	$: canPost =
		isOwner ||
		memberHasPermission(myMember, Permission.ManageChannels) ||
		memberHasPermission(myMember, Permission.ManageMessages);

	onMount(() => {
		sdk.components.MessageList().then((mod) => {
			MessageListComponent = mod.default;
		});
		sdk.components.MessageInput().then((mod) => {
			MessageInputComponent = mod.default;
		});

		return () => {
			MessageListComponent = null;
			MessageInputComponent = null;
		};
	});
</script>

<div class="flex-1 flex flex-col min-h-0">
	{#if MessageListComponent}
		{@const MessageList = MessageListComponent}
		<MessageList channelId={$activeChannel?.id ?? ''} />
	{/if}

	{#if canPost && MessageInputComponent}
		{@const MessageInput = MessageInputComponent}
		<MessageInput channelId={$activeChannel?.id ?? ''} />
	{:else if !canPost}
		<div class="px-4 py-3 border-t border-border bg-surface">
			<p class="text-sm text-text-muted text-center">
				Only moderators can post in announcement channels.
			</p>
		</div>
	{/if}
</div>
