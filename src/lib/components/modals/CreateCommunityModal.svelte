<script lang="ts">
	import { Modal, Input, Textarea, Button, Avatar, Spinner } from '$lib/components/ui';
	import { Image, X } from '$lib/components/icons';
	import { createCommunityModalOpen, closeCreateCommunityModal, addToast } from '$lib/stores/ui';
	import { addCommunity } from '$lib/stores/community';
	import { api } from '$lib/api';

	let name = $state('');
	let description = $state('');
	let icon = $state<File | null>(null);
	let iconPreview = $state<string | null>(null);
	let isPrivate = $state(false);
	let isSubmitting = $state(false);
	let errors = $state<Record<string, string>>({});

	let fileInputRef: HTMLInputElement | null = $state(null);

	function handleClose() {
		closeCreateCommunityModal();
		resetForm();
	}

	function resetForm() {
		name = '';
		description = '';
		icon = null;
		iconPreview = null;
		isPrivate = false;
		errors = {};
	}

	function handleIconSelect(e: Event) {
		const input = e.target as HTMLInputElement;
		if (input.files && input.files[0]) {
			const file = input.files[0];

			// Validate file type
			if (!file.type.startsWith('image/')) {
				errors = { ...errors, icon: 'Please select an image file' };
				return;
			}

			// Validate file size (max 5MB)
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
		if (iconPreview) {
			URL.revokeObjectURL(iconPreview);
			iconPreview = null;
		}
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
		if (!validate() || isSubmitting) return;

		isSubmitting = true;

		try {
			const community = await api.createCommunity({
				name: name.trim(),
				description: description.trim() || undefined,
				isPublic: !isPrivate
			});

			// Upload icon if provided
			if (icon && community.id) {
				try {
					const iconUrl = await api.updateCommunityIcon(community.id, icon);
					community.iconUrl = iconUrl;
					community.icon = iconUrl;
				} catch (err) {
					console.error('Failed to upload icon:', err);
					// Community was created, just icon failed
				}
			}

			addCommunity(community);
			addToast({
				type: 'success',
				message: `Community "${community.name}" created!`
			});
			handleClose();
		} catch (err: any) {
			console.error('Failed to create community:', err);
			if (err.response?.data?.message) {
				errors = { submit: err.response.data.message };
			} else {
				errors = { submit: 'Failed to create community. Please try again.' };
			}
		} finally {
			isSubmitting = false;
		}
	}
</script>

<Modal isOpen={$createCommunityModalOpen} onclose={handleClose} title="Create a Community">
	<form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }} class="space-y-4">
		<!-- Icon upload -->
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
					<button
						type="button"
						onclick={removeIcon}
						class="absolute -top-1 -right-1 w-5 h-5 bg-error text-white rounded-full flex items-center justify-center"
						aria-label="Remove icon"
					>
						<X size={12} />
					</button>
				</div>
			{:else}
				<button
					type="button"
					onclick={() => fileInputRef?.click()}
					class="w-20 h-20 rounded-xl border-2 border-dashed border-border hover:border-primary flex flex-col items-center justify-center gap-1 transition-colors"
				>
					<Image size={24} class="text-text-muted" />
					<span class="text-xs text-text-muted">Upload</span>
				</button>
			{/if}

			<div class="flex-1">
				<p class="text-sm text-text-secondary">Community Icon</p>
				<p class="text-xs text-text-muted">Recommended size: 256x256. Max 5MB.</p>
				{#if errors.icon}
					<p class="text-xs text-error mt-1">{errors.icon}</p>
				{/if}
			</div>
		</div>

		<!-- Name -->
		<Input
			label="Community Name"
			bind:value={name}
			placeholder="My Awesome Community"
			error={errors.name}
			required
			maxlength={100}
		/>

		<!-- Description -->
		<Textarea
			label="Description"
			bind:value={description}
			placeholder="What's your community about?"
			rows={3}
			maxlength={500}
			error={errors.description}
		/>

		<!-- Private toggle -->
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

		{#if errors.submit}
			<p class="text-sm text-error">{errors.submit}</p>
		{/if}

		<!-- Actions -->
		<div class="flex justify-end gap-3 pt-4">
			<Button variant="ghost" onclick={handleClose} disabled={isSubmitting}>
				Cancel
			</Button>
			<Button type="submit" disabled={isSubmitting}>
				{#if isSubmitting}
					<Spinner size="sm" />
					Creating...
				{:else}
					Create Community
				{/if}
			</Button>
		</div>
	</form>
</Modal>
