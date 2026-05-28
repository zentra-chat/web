<script lang="ts">
	import { onMount } from 'svelte';
	import type { Component } from 'svelte';
	import { getSDK } from '@zentra/plugin-sdk/runtime';

	const sdk = getSDK();
	const { activeChannel } = sdk.stores;

	let MessageListComponent: Component | null = null;
	let MessageInputComponent: Component | null = null;

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

	{#if MessageInputComponent}
		{@const MessageInput = MessageInputComponent}
		<MessageInput channelId={$activeChannel?.id ?? ''} />
	{/if}
</div>
