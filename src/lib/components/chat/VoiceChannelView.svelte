<script lang="ts">
	import { Volume2, Mic, MicOff, VolumeX, PhoneOff, Monitor, Maximize2 } from 'lucide-svelte';
	import { Avatar, Tooltip } from '$lib/components/ui';
	import {
		voiceChannelId,
		voiceConnectionState,
		currentVoiceParticipants,
		isSelfMuted,
		isSelfDeafened,
		isSelfScreenSharing,
		screenShareStreams,
		speakingUsers,
		toggleMute,
		toggleDeafen,
		toggleScreenShare,
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

	let activeScreenShares = $derived.by(() =>
		participants
			.filter((participant) => participant.isScreenSharing)
			.map((participant) => ({
				userId: participant.userId,
				displayName:
					participant.user?.displayName || participant.user?.username || 'Unknown',
				stream: $screenShareStreams[participant.userId] || null
			}))
	);

	const screenShareVideoEls = new Map<string, HTMLVideoElement>();
	const screenShareVolumes = $state<Record<string, number>>({});

	function getScreenShareVolume(userId: string): number {
		return screenShareVolumes[userId] ?? 100;
	}

	function applyScreenShareVolume(userId: string, volume: number) {
		screenShareVolumes[userId] = volume;
		const node = screenShareVideoEls.get(userId);
		if (!node) return;
		node.volume = Math.max(0, Math.min(100, volume)) / 100;
		node.muted = volume <= 0;
	}

	function setScreenShareVolume(userId: string, event: Event) {
		const value = Number((event.currentTarget as HTMLInputElement).value);
		applyScreenShareVolume(userId, value);
	}

	function fullscreenScreenShare(userId: string) {
		const node = screenShareVideoEls.get(userId);
		if (!node) return;
		void node.requestFullscreen().catch(() => {});
	}

	function attachMediaStream(node: HTMLVideoElement, params: { userId: string; stream: MediaStream | null }) {
		const { userId, stream } = params;
		screenShareVideoEls.set(userId, node);
		applyScreenShareVolume(userId, getScreenShareVolume(userId));
		node.srcObject = stream;
		if (stream) {
			void node.play().catch(() => {});
		}
		return {
			update(nextParams: { userId: string; stream: MediaStream | null }) {
				node.srcObject = nextParams.stream;
				applyScreenShareVolume(nextParams.userId, getScreenShareVolume(nextParams.userId));
				if (nextParams.stream) {
					void node.play().catch(() => {});
				}
			},
			destroy() {
				screenShareVideoEls.delete(userId);
				node.srcObject = null;
			}
		};
	}
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
			{#if activeScreenShares.length > 0}
				<div class="w-full max-w-5xl mb-6 space-y-4">
					{#each activeScreenShares as share (share.userId)}
						<div class="rounded-xl bg-surface ring-1 ring-border overflow-hidden">
							<div class="px-4 py-2 border-b border-border text-sm text-text-secondary flex items-center gap-2">
								<Monitor size={16} class="text-success" />
								<span class="font-medium text-text-primary">{share.displayName}</span>
								<span>is sharing their screen</span>
							</div>
							{#if share.stream}
								<video
									class="w-full max-h-[28rem] bg-black"
									autoplay
									playsinline
									use:attachMediaStream={{ userId: share.userId, stream: share.stream }}
								></video>
								<div class="px-4 py-3 border-t border-border bg-surface-hover flex items-center gap-3">
									<Tooltip text="Fullscreen" position="top">
										<button
											onclick={() => fullscreenScreenShare(share.userId)}
											class="p-2 rounded-md bg-surface text-text-secondary hover:text-text-primary hover:bg-surface-active transition-colors"
										>
											<Maximize2 size={16} />
										</button>
									</Tooltip>
									<div class="flex items-center gap-2 min-w-[180px]">
										<Volume2 size={16} class="text-text-muted" />
										<input
											type="range"
											min="0"
											max="100"
											value={getScreenShareVolume(share.userId)}
											oninput={(event) => setScreenShareVolume(share.userId, event)}
											class="w-36 accent-success"
										/>
										<span class="text-xs text-text-muted w-9 text-right">{getScreenShareVolume(share.userId)}%</span>
									</div>
								</div>
							{:else}
								<div class="h-52 flex items-center justify-center text-text-muted text-sm bg-surface-hover">
									Waiting for video track...
								</div>
							{/if}
						</div>
					{/each}
				</div>
			{/if}

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

				<Tooltip text={$isSelfScreenSharing ? 'Stop sharing' : 'Share screen'} position="top">
					<button
						onclick={toggleScreenShare}
						class="p-3 rounded-full transition-colors {$isSelfScreenSharing ? 'bg-success/20 text-success hover:bg-success/30' : 'bg-surface-hover text-text-secondary hover:text-text-primary hover:bg-surface-active'}"
					>
						<Monitor size={22} />
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

					<Tooltip text={$isSelfScreenSharing ? 'Stop sharing' : 'Share screen'} position="top">
						<button
							onclick={toggleScreenShare}
							class="p-3 rounded-full transition-colors {$isSelfScreenSharing ? 'bg-success/20 text-success hover:bg-success/30' : 'bg-surface-hover text-text-secondary hover:text-text-primary hover:bg-surface-active'}"
						>
							<Monitor size={22} />
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
