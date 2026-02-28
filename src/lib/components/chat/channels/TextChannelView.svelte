<script lang="ts">
	import { MessageList, MessageInput } from '$lib/components/chat';
	import { activeChannel } from '$lib/stores/community';
</script>

<div class="flex-1 flex flex-col min-h-0">
	<MessageList channelId={$activeChannel?.id ?? ''} />
	<MessageInput channelId={$activeChannel?.id ?? ''} />
</div>
