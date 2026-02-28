<script lang="ts">
	import { MessageList, MessageInput } from '$lib/components/chat';
	import { Hash } from 'lucide-svelte';
	import { activeChannel } from '$lib/stores/community';
</script>

<div class="flex-1 flex flex-col min-h-0">
	<!-- Channel header -->
	<div class="h-12 px-4 flex items-center gap-2 border-b border-border shrink-0">
		<Hash size={20} class="text-text-muted" />
		<h2 class="font-semibold text-text-primary">{$activeChannel?.name || 'Text Channel'}</h2>
		{#if $activeChannel?.topic}
			<span class="text-xs text-text-muted ml-2 truncate">{$activeChannel.topic}</span>
		{/if}
	</div>

	<MessageList channelId={$activeChannel?.id ?? ''} />
	<MessageInput channelId={$activeChannel?.id ?? ''} />
</div>
