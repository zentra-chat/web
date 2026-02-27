<script lang="ts">
	import { Avatar } from '$lib/components/ui';
	import { MicOff, VolumeX } from 'lucide-svelte';
	import { voiceParticipants, speakingUsers } from '$lib/stores/voice';
	import { currentUserId } from '$lib/stores/instance';
	import type { VoiceState } from '$lib/types';

	interface Props {
		channelId: string;
	}

	let { channelId }: Props = $props();

	let participants = $derived(($voiceParticipants[channelId] || []) as VoiceState[]);
</script>

{#if participants.length > 0}
	<div class="ml-7 space-y-0.5">
		{#each participants as participant (participant.userId)}
			{@const isMe = participant.userId === $currentUserId}
			{@const displayName = participant.user?.displayName || participant.user?.username || 'Unknown'}
			{@const isSpeaking = $speakingUsers[participant.userId] || false}
			<div
				class="flex items-center gap-2 px-2 py-1 rounded text-xs group
					{isMe ? 'text-text-primary' : 'text-text-secondary'}"
			>
				<div class="relative">
					<Avatar
						src={participant.user?.avatarUrl || null}
						alt={displayName}
						size="xs"
					/>
					{#if isSpeaking}
						<div class="absolute -inset-0.5 rounded-full ring-2 ring-success pointer-events-none"></div>
					{:else if participant.user?.status === 'online'}
						<div class="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-success border border-surface-hover"></div>
					{/if}
				</div>
				<span class="truncate flex-1 {isSpeaking ? 'text-success font-medium' : ''}">{displayName}</span>
				<div class="flex items-center gap-0.5">
					{#if participant.isSelfMuted || participant.isMuted}
						<MicOff size={12} class="text-error" />
					{/if}
					{#if participant.isSelfDeafened || participant.isDeafened}
						<VolumeX size={12} class="text-error" />
					{/if}
				</div>
			</div>
		{/each}
	</div>
{/if}
