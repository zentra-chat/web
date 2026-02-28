<!-- Thin wrapper around the existing VoiceChannelView so the channel type
     registry can lazy-import it without moving the original file. -->
<script lang="ts">
	import VoiceChannelView from '$lib/components/chat/VoiceChannelView.svelte';
</script>

<VoiceChannelView />
