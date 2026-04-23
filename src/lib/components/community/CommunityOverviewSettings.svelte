<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { Button, Input, Spinner, Textarea } from '$lib/components/ui';
	import { Image, X, Trash } from 'lucide-svelte';
	import { api } from '$lib/api';
	import { addToast } from '$lib/stores/ui';
	import { activeCommunity, removeCommunity, updateCommunity } from '$lib/stores/community';
	import { currentUserId } from '$lib/stores/instance';
	import { getErrorMessage } from '$lib/utils/apiError';

	interface Props {
		communityId: string;
	}

	let { communityId }: Props = $props();

	let name = $state('');
	let description = $state('');
	let icon = $state<File | null>(null);
	let iconPreview = $state<string | null>(null);
	let isPrivate = $state(false);
	let isSubmitting = $state(false);
	let errors = $state<Record<string, string>>({});
	let fileInputRef = $state<HTMLInputElement | null>(null);
	let isOwner = $derived($activeCommunity?.ownerId === $currentUserId);

	$effect(() => {
		if (!$activeCommunity || $activeCommunity.id !== communityId) return;

		name = $activeCommunity.name;
		description = $activeCommunity.description || '';
		iconPreview = $activeCommunity.iconUrl || null;
		isPrivate = !$activeCommunity.isPublic;
	});

	function handleIconSelect(event: Event) {
		const input = event.target as HTMLInputElement;
		if (!input.files || !input.files[0]) return;

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

	function removeIcon() {
		icon = null;
		iconPreview = null;
	}

	function removeIconAndResetInput() {
		removeIcon();
		if (fileInputRef) {
			fileInputRef.value = '';
		}
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
		if (!validate() || isSubmitting || !$activeCommunity || $activeCommunity.id !== communityId) return;

		isSubmitting = true;
		try {
			const updatedCommunity = await api.updateCommunity(communityId, {
				name: name.trim(),
				description: description.trim() || undefined,
				isPublic: !isPrivate
			});

			if (icon) {
				try {
					const iconUrl = await api.updateCommunityIcon(communityId, icon);
					updatedCommunity.iconUrl = iconUrl;
				} catch (err) {
					console.error('Failed to upload icon:', err);
				}
			} else if (iconPreview === null && $activeCommunity.iconUrl) {
				try {
					await api.removeCommunityIcon(communityId);
					updatedCommunity.iconUrl = null;
				} catch (err) {
					console.error('Failed to remove icon:', err);
				}
			}

			updateCommunity(communityId, updatedCommunity);
			addToast({ type: 'success', message: 'Community updated!' });
		} catch (err: unknown) {
			console.error('Failed to update community:', err);
			errors = { submit: getErrorMessage(err, 'Failed to update community. Please try again.') };
		} finally {
			isSubmitting = false;
		}
	}

	async function handleDeleteCommunity() {
		if (!$activeCommunity || $activeCommunity.id !== communityId) return;

		const confirmed = confirm(`Are you sure you want to delete "${$activeCommunity.name}"? This action cannot be undone.`);
		if (!confirmed) return;

		try {
			await api.deleteCommunity(communityId);
			removeCommunity(communityId);
			addToast({ type: 'success', message: 'Community deleted' });
			goto(resolve('/app'));
		} catch (err) {
			console.error('Failed to delete community:', err);
			addToast({ type: 'error', message: getErrorMessage(err, 'Failed to delete community') });
		}
	}

	async function handleLeaveCommunity() {
		if (!$activeCommunity || $activeCommunity.id !== communityId) return;

		const confirmed = confirm(`Are you sure you want to leave "${$activeCommunity.name}"?`);
		if (!confirmed) return;

		try {
			await api.leaveCommunity(communityId);
			removeCommunity(communityId);
			addToast({ type: 'success', message: 'Left community' });
			goto(resolve('/app'));
		} catch (err) {
			console.error('Failed to leave community:', err);
			addToast({ type: 'error', message: getErrorMessage(err, 'Failed to leave community') });
		}
	}
</script>

<form
	onsubmit={(event) => {
		event.preventDefault();
		handleSubmit();
	}}
	class="space-y-4"
>
	<div class="flex items-center gap-4">
		<input bind:this={fileInputRef} type="file" accept="image/*" onchange={handleIconSelect} class="hidden" />

		{#if iconPreview}
			<div class="relative">
				<img src={iconPreview} alt="Community icon" class="w-20 h-20 rounded-xl object-cover" />
				{#if isOwner}
					<button
						type="button"
						onclick={removeIconAndResetInput}
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
				<input type="checkbox" bind:checked={isPrivate} class="sr-only peer" />
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
			<Button variant="danger" onclick={handleLeaveCommunity}>Leave Community</Button>
		</div>
	{/if}
</form>
