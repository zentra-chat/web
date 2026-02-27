<script lang="ts">
	import { Volume2, Mic, MicOff, VolumeX, PhoneOff } from 'lucide-svelte';
	import { Avatar, Tooltip } from '$lib/components/ui';
	import {
		voiceChannelId,
		voiceConnectionState,
		currentVoiceParticipants,
		isSelfMuted,
		isSelfDeafened,
		speakingUsers,
		toggleMute,
		toggleDeafen,
		leaveVoiceChannel,
		joinVoiceChannel
	} from '$lib/stores/voice';
	import { currentUserId } from '$lib/stores/instance';
	import { activeChannel } from '$lib/stores/community';
	import type { VoiceState } from '$lib/types';

	let isConnected = $derived($voiceChannelId === $activeChannel?.id);
	let participants = $derived.by(() => {
		if (!$activeChannel) return [];
		// If we're connected, use the live participants from WS events
		if (isConnected) return $currentVoiceParticipants;
		// Otherwise the sidebar already loaded them via REST
		return [];
	}) as VoiceState[];
</script>

<div class="flex-1 flex flex-col min-h-0">
	<!-- Channel header -->
	<div class="h-12 px-4 flex items-center gap-2 border-b border-border shrink-0">
		<Volume2 size={20} class="text-text-muted" />
		<h2 class="font-semibold text-text-primary">{$activeChannel?.name || 'Voice Channel'}</h2>
		{#if isConnected}
			<span class="text-xs text-success font-medium ml-2">Connected</span>
		{/if}
	</div>

	<!-- Main voice area -->
	<div class="flex-1 flex flex-col items-center justify-center p-8 overflow-y-auto">
		{#if isConnected && participants.length > 0}
			<!-- Participant grid -->
			<div class="grid gap-4 w-full max-w-4xl"
				style="grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));"
			>
				{#each participants as participant (participant.userId)}
					{@const isMe = participant.userId === $currentUserId}
					{@const displayName = participant.user?.displayName || participant.user?.username || 'Unknown'}
					{@const isSpeaking = $speakingUsers[participant.userId] || false}
					{@const isMuted = participant.isSelfMuted || participant.isMuted}
					{@const isDeafened = participant.isSelfDeafened || participant.isDeafened}
					<div
						class="flex flex-col items-center gap-3 p-5 rounded-xl bg-surface transition-all duration-200
							{isSpeaking ? 'ring-2 ring-success shadow-lg shadow-success/10' : 'ring-1 ring-border'}"
					>
						<div class="rounded-full transition-shadow duration-200 {isSpeaking ? 'ring-2 ring-success ring-offset-2 ring-offset-surface' : ''}">
							<Avatar
								src={participant.user?.avatarUrl || null}
								alt={displayName}
								size="xl"
							/>
						</div>
						<div class="text-center min-w-0 w-full">
							<p class="text-sm font-medium text-text-primary truncate">
								{displayName}{#if isMe} (You){/if}
							</p>
						</div>
						<div class="flex items-center gap-1.5">
							{#if isMuted}
								<Tooltip text="Muted" position="top">
									<MicOff size={14} class="text-error" />
								</Tooltip>
							{:else}
								<Tooltip text="Unmuted" position="top">
									<Mic size={14} class="text-text-muted" />
								</Tooltip>
							{/if}
							{#if isDeafened}
								<Tooltip text="Deafened" position="top">
									<VolumeX size={14} class="text-error" />
								</Tooltip>
							{/if}
						</div>
					</div>
				{/each}
			</div>

			<!-- Controls bar -->
			<div class="mt-8 flex items-center gap-3">
				<Tooltip text={$isSelfMuted ? 'Unmute' : 'Mute'} position="top">
					<button
						onclick={toggleMute}
						class="p-3 rounded-full transition-colors {$isSelfMuted ? 'bg-error/20 text-error hover:bg-error/30' : 'bg-surface-hover text-text-secondary hover:text-text-primary hover:bg-surface-active'}"
					>
						{#if $isSelfMuted}
							<MicOff size={22} />
						{:else}
							<Mic size={22} />
						{/if}
					</button>
				</Tooltip>

				<Tooltip text={$isSelfDeafened ? 'Undeafen' : 'Deafen'} position="top">
					<button
						onclick={toggleDeafen}
						class="p-3 rounded-full transition-colors {$isSelfDeafened ? 'bg-error/20 text-error hover:bg-error/30' : 'bg-surface-hover text-text-secondary hover:text-text-primary hover:bg-surface-active'}"
					>
						{#if $isSelfDeafened}
							<VolumeX size={22} />
						{:else}
							<Volume2 size={22} />
						{/if}
					</button>
				</Tooltip>

				<Tooltip text="Disconnect" position="top">
					<button
						onclick={() => leaveVoiceChannel()}
						class="p-3 rounded-full bg-error/20 text-error hover:bg-error/30 transition-colors"
					>
						<PhoneOff size={22} />
					</button>
				</Tooltip>
			</div>
		{:else if isConnected}
			<!-- Connected but no participants yet (just us) -->
			<div class="text-center">
				<div class="w-20 h-20 rounded-full bg-surface flex items-center justify-center mb-4 mx-auto">
					<Volume2 size={40} class="text-success" />
				</div>
				<h2 class="text-xl font-semibold text-text-primary mb-2">You're in the call</h2>
				<p class="text-text-muted max-w-md">Waiting for others to join...</p>

				<!-- Controls -->
				<div class="mt-6 flex items-center justify-center gap-3">
					<Tooltip text={$isSelfMuted ? 'Unmute' : 'Mute'} position="top">
						<button
							onclick={toggleMute}
							class="p-3 rounded-full transition-colors {$isSelfMuted ? 'bg-error/20 text-error hover:bg-error/30' : 'bg-surface-hover text-text-secondary hover:text-text-primary hover:bg-surface-active'}"
						>
							{#if $isSelfMuted}
								<MicOff size={22} />
							{:else}
								<Mic size={22} />
							{/if}
						</button>
					</Tooltip>

					<Tooltip text="Disconnect" position="top">
						<button
							onclick={() => leaveVoiceChannel()}
							class="p-3 rounded-full bg-error/20 text-error hover:bg-error/30 transition-colors"
						>
							<PhoneOff size={22} />
						</button>
					</Tooltip>
				</div>
			</div>
		{:else}
			<!-- Not connected to this channel -->
			<div class="text-center">
				<div class="w-20 h-20 rounded-full bg-surface flex items-center justify-center mb-4 mx-auto">
					<Volume2 size={40} class="text-text-muted" />
				</div>
				<h2 class="text-xl font-semibold text-text-primary mb-2">{$activeChannel?.name || 'Voice Channel'}</h2>
				<p class="text-text-muted max-w-md mb-6">Click below to join this voice channel.</p>
				<button
					onclick={() => { if ($activeChannel) joinVoiceChannel($activeChannel.id); }}
					class="px-6 py-2.5 rounded-lg bg-success text-white font-medium hover:bg-success/90 transition-colors"
				>
					Join Voice
				</button>
			</div>
		{/if}
	</div>
</div>
