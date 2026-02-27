<script lang="ts">
	import { Mic, MicOff, PhoneOff, VolumeX, Volume2 } from 'lucide-svelte';
	import { Tooltip } from '$lib/components/ui';
	import {
		voiceChannelId,
		voiceConnectionState,
		isInVoiceCall,
		isSelfMuted,
		isSelfDeafened,
		currentVoiceParticipants,
		toggleMute,
		toggleDeafen,
		leaveVoiceChannel
	} from '$lib/stores/voice';
	import { activeCommunityChannels } from '$lib/stores/community';

	let channelName = $derived.by(() => {
		if (!$voiceChannelId) return '';
		const channel = $activeCommunityChannels.find((c) => c.id === $voiceChannelId);
		return channel?.name || 'Voice Channel';
	});

	let participantCount = $derived($currentVoiceParticipants.length);
</script>

{#if $isInVoiceCall}
	<div class="bg-surface border-t border-border px-3 py-2">
		<!-- Connection info -->
		<div class="flex items-center justify-between mb-2">
			<div class="flex-1 min-w-0">
				<div class="flex items-center gap-1.5">
					<div class="w-2 h-2 rounded-full {$voiceConnectionState === 'connected' ? 'bg-success' : 'bg-warning animate-pulse'}"></div>
					<span class="text-xs font-medium {$voiceConnectionState === 'connected' ? 'text-success' : 'text-warning'}">
						{$voiceConnectionState === 'connected' ? 'Voice Connected' : 'Connecting...'}
					</span>
				</div>
				<p class="text-xs text-text-muted truncate mt-0.5">
					{channelName} · {participantCount} {participantCount === 1 ? 'user' : 'users'}
				</p>
			</div>
		</div>

		<!-- Controls -->
		<div class="flex items-center justify-center gap-2">
			<Tooltip text={$isSelfMuted ? 'Unmute' : 'Mute'} position="top">
				<button
					onclick={toggleMute}
					class="p-2 rounded-full transition-colors {$isSelfMuted ? 'bg-error/20 text-error hover:bg-error/30' : 'bg-surface-hover text-text-secondary hover:text-text-primary hover:bg-surface-active'}"
				>
					{#if $isSelfMuted}
						<MicOff size={18} />
					{:else}
						<Mic size={18} />
					{/if}
				</button>
			</Tooltip>

			<Tooltip text={$isSelfDeafened ? 'Undeafen' : 'Deafen'} position="top">
				<button
					onclick={toggleDeafen}
					class="p-2 rounded-full transition-colors {$isSelfDeafened ? 'bg-error/20 text-error hover:bg-error/30' : 'bg-surface-hover text-text-secondary hover:text-text-primary hover:bg-surface-active'}"
				>
					{#if $isSelfDeafened}
						<VolumeX size={18} />
					{:else}
						<Volume2 size={18} />
					{/if}
				</button>
			</Tooltip>

			<Tooltip text="Disconnect" position="top">
				<button
					onclick={() => leaveVoiceChannel()}
					class="p-2 rounded-full bg-error/20 text-error hover:bg-error/30 transition-colors"
				>
					<PhoneOff size={18} />
				</button>
			</Tooltip>
		</div>
	</div>
{/if}
