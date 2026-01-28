<script lang="ts">
	import { Modal, Input, Textarea, Button, Spinner, Avatar } from '$lib/components/ui';
	import { Image, X, Trash, Copy, RefreshCw, Users, Settings as SettingsIcon } from '$lib/components/icons';
	import { communitySettingsModalOpen, closeCommunitySettingsModal, addToast } from '$lib/stores/ui';
	import { activeCommunity, updateCommunity, removeCommunity } from '$lib/stores/community';
	import { currentUserId } from '$lib/stores/instance';
	import { api } from '$lib/api';

	let name = $state('');
	let description = $state('');
	let icon = $state<File | null>(null);
	let iconPreview = $state<string | null>(null);
	let isPrivate = $state(false);
	let inviteCode = $state<string | null>(null);
	let activeTab = $state<'overview' | 'members' | 'roles' | 'invites'>('overview');
	let isSubmitting = $state(false);
	let isGeneratingInvite = $state(false);
	let errors = $state<Record<string, string>>({});

	let fileInputRef: HTMLInputElement | null = $state(null);
	let isOwner = $derived($activeCommunity?.ownerId === $currentUserId);

	// Load community data when modal opens
	$effect(() => {
		if ($communitySettingsModalOpen && $activeCommunity) {
			name = $activeCommunity.name;
			description = $activeCommunity.description || '';
			iconPreview = $activeCommunity.iconUrl || $activeCommunity.icon || null;
			isPrivate = $activeCommunity.isPrivate || false;
		}
	});

	function handleClose() {
		closeCommunitySettingsModal();
		resetForm();
	}

	function resetForm() {
		icon = null;
		iconPreview = $activeCommunity?.iconUrl || $activeCommunity?.icon || null;
		errors = {};
		activeTab = 'overview';
		inviteCode = null;
	}

	function handleIconSelect(e: Event) {
		const input = e.target as HTMLInputElement;
		if (input.files && input.files[0]) {
			const file = input.files[0];

			if (!file.type.startsWith('image/')) {
				errors = { ...errors, icon: 'Please select an image file' };
				return;
			}

			if (file.size > 5 * 1024 * 1024) {
				errors = { ...errors, icon: 'Image must be less than 5MB' };
				return;
			}

			icon = file;
			iconPreview = URL.createObjectURL(file);
			delete errors.icon;
		}
	}

	function removeIcon() {
		icon = null;
		iconPreview = null;
		if (fileInputRef) fileInputRef.value = '';
	}

	function validate(): boolean {
		const newErrors: Record<string, string> = {};

		if (!name.trim()) {
			newErrors.name = 'Community name is required';
		} else if (name.length < 2) {
			newErrors.name = 'Name must be at least 2 characters';
		} else if (name.length > 100) {
			newErrors.name = 'Name must be less than 100 characters';
		}

		if (description.length > 500) {
			newErrors.description = 'Description must be less than 500 characters';
		}

		errors = newErrors;
		return Object.keys(newErrors).length === 0;
	}

	async function handleSubmit() {
		if (!validate() || isSubmitting || !$activeCommunity) return;

		isSubmitting = true;

		try {
			const updatedCommunity = await api.updateCommunity($activeCommunity.id, {
				name: name.trim(),
				description: description.trim() || undefined,
				isPublic: !isPrivate
			});

			// Upload icon if changed
			if (icon) {
				try {
					const iconUrl = await api.updateCommunityIcon($activeCommunity.id, icon);
					updatedCommunity.iconUrl = iconUrl;
					updatedCommunity.icon = iconUrl;
				} catch (err) {
					console.error('Failed to upload icon:', err);
				}
			} else if (iconPreview === null && ($activeCommunity.iconUrl || $activeCommunity.icon)) {
				try {
					await api.removeCommunityIcon($activeCommunity.id);
					updatedCommunity.iconUrl = null;
					updatedCommunity.icon = null;
				} catch (err) {
					console.error('Failed to remove icon:', err);
				}
			}

			updateCommunity($activeCommunity.id, updatedCommunity);
			addToast({
				type: 'success',
				message: 'Community updated!'
			});
		} catch (err: any) {
			console.error('Failed to update community:', err);
			if (err.response?.data?.message) {
				errors = { submit: err.response.data.message };
			} else {
				errors = { submit: 'Failed to update community. Please try again.' };
			}
		} finally {
			isSubmitting = false;
		}
	}

	async function handleDeleteCommunity() {
		if (!$activeCommunity) return;

		const confirmed = confirm(
			`Are you sure you want to delete "${$activeCommunity.name}"? This action cannot be undone.`
		);
		if (!confirmed) return;

		try {
			await api.deleteCommunity($activeCommunity.id);
			removeCommunity($activeCommunity.id);
			addToast({
				type: 'success',
				message: 'Community deleted'
			});
			handleClose();
		} catch (err) {
			console.error('Failed to delete community:', err);
			addToast({
				type: 'error',
				message: 'Failed to delete community'
			});
		}
	}

	async function handleLeaveCommunity() {
		if (!$activeCommunity) return;

		const confirmed = confirm(`Are you sure you want to leave "${$activeCommunity.name}"?`);
		if (!confirmed) return;

		try {
			await api.leaveCommunity($activeCommunity.id);
			removeCommunity($activeCommunity.id);
			addToast({
				type: 'success',
				message: 'Left community'
			});
			handleClose();
		} catch (err) {
			console.error('Failed to leave community:', err);
			addToast({
				type: 'error',
				message: 'Failed to leave community'
			});
		}
	}

	async function generateInvite() {
		if (!$activeCommunity || isGeneratingInvite) return;

		isGeneratingInvite = true;

		try {
			const invite = await api.createInvite($activeCommunity.id);
			inviteCode = invite.code;
		} catch (err) {
			console.error('Failed to generate invite:', err);
			addToast({
				type: 'error',
				message: 'Failed to generate invite'
			});
		} finally {
			isGeneratingInvite = false;
		}
	}

	function copyInvite() {
		if (inviteCode) {
			navigator.clipboard.writeText(`${window.location.origin}/invite/${inviteCode}`);
			addToast({
				type: 'success',
				message: 'Invite link copied!'
			});
		}
	}
</script>

<Modal isOpen={$communitySettingsModalOpen} onclose={handleClose} title="Community Settings" size="xl">
	<div class="flex gap-6">
		<!-- Tabs -->
		<div class="w-40 space-y-1">
			<button
				onclick={() => activeTab = 'overview'}
				class="w-full text-left px-3 py-2 rounded-lg text-sm transition-colors {activeTab === 'overview' ? 'bg-surface-hover text-text-primary' : 'text-text-muted hover:text-text-primary hover:bg-surface'}"
			>
				<SettingsIcon size={16} class="inline-block mr-2" />
				Overview
			</button>
			<button
				onclick={() => activeTab = 'invites'}
				class="w-full text-left px-3 py-2 rounded-lg text-sm transition-colors {activeTab === 'invites' ? 'bg-surface-hover text-text-primary' : 'text-text-muted hover:text-text-primary hover:bg-surface'}"
			>
				<Users size={16} class="inline-block mr-2" />
				Invites
			</button>
		</div>

		<!-- Content -->
		<div class="flex-1">
			{#if activeTab === 'overview'}
				<form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }} class="space-y-4">
					<!-- Icon -->
					<div class="flex items-center gap-4">
						<input
							bind:this={fileInputRef}
							type="file"
							accept="image/*"
							onchange={handleIconSelect}
							class="hidden"
						/>

						{#if iconPreview}
							<div class="relative">
								<img
									src={iconPreview}
									alt="Community icon"
									class="w-20 h-20 rounded-xl object-cover"
								/>
								{#if isOwner}
									<button
										type="button"
										onclick={removeIcon}
										class="absolute -top-1 -right-1 w-5 h-5 bg-error text-white rounded-full flex items-center justify-center"
										aria-label="Remove icon"
									>
										<X size={12} />
									</button>
								{/if}
							</div>
						{:else}
							<button
								type="button"
								onclick={() => fileInputRef?.click()}
								disabled={!isOwner}
								class="w-20 h-20 rounded-xl border-2 border-dashed border-border hover:border-primary flex flex-col items-center justify-center gap-1 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
							>
								<Image size={24} class="text-text-muted" />
								<span class="text-xs text-text-muted">Upload</span>
							</button>
						{/if}

						<div>
							<p class="text-sm text-text-secondary">Community Icon</p>
							<p class="text-xs text-text-muted">Recommended size: 256x256</p>
							{#if errors.icon}
								<p class="text-xs text-error mt-1">{errors.icon}</p>
							{/if}
						</div>
					</div>

					<Input
						label="Community Name"
						bind:value={name}
						placeholder="My Awesome Community"
						error={errors.name}
						required
						maxlength={100}
						disabled={!isOwner}
					/>

					<Textarea
						label="Description"
						bind:value={description}
						placeholder="What's your community about?"
						rows={3}
						maxlength={500}
						error={errors.description}
						disabled={!isOwner}
					/>

					{#if isOwner}
						<label class="flex items-center gap-3 cursor-pointer">
							<div class="relative">
								<input
									type="checkbox"
									bind:checked={isPrivate}
									class="sr-only peer"
								/>
								<div class="w-10 h-6 bg-surface-hover rounded-full peer-checked:bg-primary transition-colors"></div>
								<div class="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-4"></div>
							</div>
							<div>
								<p class="text-sm text-text-primary">Private Community</p>
								<p class="text-xs text-text-muted">Only people with an invite can join</p>
							</div>
						</label>
					{/if}

					{#if errors.submit}
						<p class="text-sm text-error">{errors.submit}</p>
					{/if}

					{#if isOwner}
						<div class="flex justify-between pt-4">
							<Button variant="danger" onclick={handleDeleteCommunity}>
								<Trash size={16} />
								Delete Community
							</Button>
							<Button type="submit" disabled={isSubmitting}>
								{#if isSubmitting}
									<Spinner size="sm" />
									Saving...
								{:else}
									Save Changes
								{/if}
							</Button>
						</div>
					{:else}
						<div class="pt-4">
							<Button variant="danger" onclick={handleLeaveCommunity}>
								Leave Community
							</Button>
						</div>
					{/if}
				</form>
			{:else if activeTab === 'invites'}
				<div class="space-y-4">
					<p class="text-text-muted">Create an invite link to share with others</p>

					{#if inviteCode}
						<div class="flex items-center gap-2">
							<input
								type="text"
								value={`${window.location.origin}/invite/${inviteCode}`}
								readonly
								class="flex-1 px-3 py-2 bg-surface border border-border rounded-lg text-text-primary text-sm"
							/>
							<Button variant="secondary" onclick={copyInvite}>
								<Copy size={16} />
							</Button>
							<Button variant="secondary" onclick={generateInvite} disabled={isGeneratingInvite}>
								<RefreshCw size={16} />
							</Button>
						</div>
					{:else}
						<Button onclick={generateInvite} disabled={isGeneratingInvite}>
							{#if isGeneratingInvite}
								<Spinner size="sm" />
								Generating...
							{:else}
								Generate Invite Link
							{/if}
						</Button>
					{/if}
				</div>
			{/if}
		</div>
	</div>
</Modal>
