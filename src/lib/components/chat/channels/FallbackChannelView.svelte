<script lang="ts">
	import { HelpCircle } from 'lucide-svelte';
	import { activeChannel } from '$lib/stores/community';
	import { MessageList, MessageInput } from '$lib/components/chat';
</script>

<div class="flex-1 flex flex-col min-h-0">
	<!-- Channel header -->
	<div class="h-12 px-4 flex items-center gap-2 border-b border-border shrink-0">
		<HelpCircle size={20} class="text-text-muted" />
		<h2 class="font-semibold text-text-primary">{$activeChannel?.name || 'Channel'}</h2>
		<span class="text-xs text-text-muted ml-2">
			{$activeChannel?.type ? `Type: ${$activeChannel.type}` : ''}
		</span>
	</div>

	<!-- Fall back to basic text/message view for unknown types -->
	<MessageList channelId={$activeChannel?.id ?? ''} />
	<MessageInput channelId={$activeChannel?.id ?? ''} />
</div>
