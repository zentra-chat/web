<script lang="ts">
	import { Modal, Input, Textarea, Button, Spinner } from '$lib/components/ui';
	import { Hash, Megaphone, Image, Lock } from 'lucide-svelte';
	import { createChannelModalOpen, closeCreateChannelModal, addToast, createChannelModalData } from '$lib/stores/ui';
	import { activeCommunity, activeCommunityMembers, addChannel, memberHasPermission, Permission } from '$lib/stores/community';
	import { currentUserId } from '$lib/stores/instance';
	import { api } from '$lib/api';
	import type { Channel } from '$lib/types';

	let name = $state('');
	let description = $state('');
	let type = $state<Channel['type']>('text');
	let isSubmitting = $state(false);
	let errors = $state<Record<string, string>>({});

	let categoryId = $derived($createChannelModalData.categoryId);
	let myMember = $derived.by(() => $activeCommunityMembers.find((m) => m.userId === $currentUserId) || null);
	let canManageChannels = $derived(memberHasPermission(myMember, Permission.ManageChannels));

	function handleClose() {
		closeCreateChannelModal();
		resetForm();
	}

	function resetForm() {
		name = '';
		description = '';
		type = 'text';
		errors = {};
	}

	function validate(): boolean {
		const newErrors: Record<string, string> = {};

		if (!name.trim()) {
			newErrors.name = 'Channel name is required';
		} else if (name.length < 1) {
			newErrors.name = 'Name must be at least 1 character';
		} else if (name.length > 100) {
			newErrors.name = 'Name must be less than 100 characters';
		} else if (!/^[a-z0-9-]+$/.test(name.toLowerCase().replace(/\s/g, '-'))) {
			newErrors.name = 'Name can only contain letters, numbers, and hyphens';
		}

		if (description.length > 500) {
			newErrors.description = 'Description must be less than 500 characters';
		}

		errors = newErrors;
		return Object.keys(newErrors).length === 0;
	}

	async function handleSubmit() {
		if (!validate() || isSubmitting || !$activeCommunity) return;
		if (!canManageChannels) {
			errors = { submit: 'Insufficient permissions' };
			return;
		}

		isSubmitting = true;

		try {
			const channel = await api.createChannel($activeCommunity.id, {
				name: name.trim().toLowerCase().replace(/\s+/g, '-'),
				topic: description.trim() || undefined,
				type,
				categoryId: categoryId || undefined
			});

			addChannel($activeCommunity.id, channel);
			addToast({
				type: 'success',
				message: `Channel #${channel.name} created!`
			});
			handleClose();
		} catch (err: any) {
			console.error('Failed to create channel:', err);
			errors = { submit: err.error || err.message || 'Failed to create channel. Please try again.' };
		} finally {
			isSubmitting = false;
		}
	}

	const channelTypes: { value: Channel['type']; label: string; icon: any; description: string }[] = [
		{
			value: 'text',
			label: 'Text',
			icon: Hash,
			description: 'Send messages, images, and files'
		},
		{
			value: 'announcement',
			label: 'Announcement',
			icon: Megaphone,
			description: 'Only admins can send messages'
		},
		{
			value: 'gallery',
			label: 'Gallery',
			icon: Image,
			description: 'Specialized for media sharing'
		},
		{
			value: 'forum',
			label: 'Forum',
			icon: Hash,
			description: 'Structured discussion threads'
		}
	];
</script>

<Modal isOpen={$createChannelModalOpen} onclose={handleClose} title="Create Channel" size="sm">
	<form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }} class="space-y-4">
		<!-- Channel type selection -->
		<div>
			<span class="block text-sm font-medium text-text-secondary mb-2">Channel Type</span>
			<div class="space-y-2">
				{#each channelTypes as channelType}
					{@const Icon = channelType.icon}
					<label
						class="flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors {type === channelType.value ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}"
					>
						<input
							type="radio"
							bind:group={type}
							value={channelType.value}
							class="sr-only"
						/>
						<div class="w-10 h-10 rounded-lg bg-surface flex items-center justify-center">
							<Icon size={20} class="text-text-muted" />
						</div>
						<div class="flex-1">
							<p class="text-sm font-medium text-text-primary">{channelType.label}</p>
							<p class="text-xs text-text-muted">{channelType.description}</p>
						</div>
						<div class="w-5 h-5 rounded-full border-2 flex items-center justify-center {type === channelType.value ? 'border-primary' : 'border-border'}">
							{#if type === channelType.value}
								<div class="w-2.5 h-2.5 rounded-full bg-primary"></div>
							{/if}
						</div>
					</label>
				{/each}
			</div>
		</div>

		<!-- Name -->
		<div>
			<Input
				label="Channel Name"
				bind:value={name}
				placeholder="general"
				error={errors.name}
				required
				maxlength={100}
			/>
			<p class="text-xs text-text-muted mt-1">
				Will be formatted as: #{name.toLowerCase().replace(/\s+/g, '-') || 'channel-name'}
			</p>
		</div>

		<!-- Description -->
		<Textarea
			label="Description"
			bind:value={description}
			placeholder="What's this channel about?"
			rows={2}
			maxlength={500}
			error={errors.description}
		/>

		{#if errors.submit}
			<p class="text-sm text-error">{errors.submit}</p>
		{/if}

		<!-- Actions -->
		<div class="flex justify-end gap-3 pt-4">
			<Button variant="ghost" onclick={handleClose} disabled={isSubmitting}>
				Cancel
			</Button>
			<Button type="submit" disabled={isSubmitting || !$activeCommunity}>
				{#if isSubmitting}
					<Spinner size="sm" />
					Creating...
				{:else}
					Create Channel
				{/if}
			</Button>
		</div>
	</form>
</Modal>
