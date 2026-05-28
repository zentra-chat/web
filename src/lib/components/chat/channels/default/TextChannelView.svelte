<script lang="ts">
	import { activeChannel } from '$lib/stores/community';
	import MessageList from '$lib/components/chat/MessageList.svelte';
	import MessageInput from '$lib/components/chat/MessageInput.svelte';
</script>

<div class="flex-1 flex flex-col min-h-0">
	<MessageList channelId={$activeChannel?.id ?? ''} />
	<MessageInput channelId={$activeChannel?.id ?? ''} />
</div>
