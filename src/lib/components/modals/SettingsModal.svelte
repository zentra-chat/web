<script lang="ts">
	import { Modal, Input, Textarea, Button, Spinner, Avatar } from '$lib/components/ui';
	import { Image, X, Trash } from '$lib/components/icons';
	import { settingsModalOpen, closeSettingsModal, addToast, autoHideInstances } from '$lib/stores/ui';
	import { currentUser, updateCurrentUser, logout } from '$lib/stores/instance';
	import { api } from '$lib/api';	
	import { updateMemberUser } from '$lib/stores/community';
	
	let displayName = $state('');
	let username = $state('');
	let bio = $state('');
	let customStatus = $state('');
	let avatar = $state<File | null>(null);
	let avatarPreview = $state<string | null>(null);
	let activeTab = $state<'profile' | 'account' | 'appearance' | 'legal'>('profile');
	let isSubmitting = $state(false);
	let errors = $state<Record<string, string>>({});

	let fileInputRef: HTMLInputElement | null = $state(null);

	// Load current user data when modal opens
	$effect(() => {
		if ($settingsModalOpen) {
			if ($currentUser) {
				displayName = $currentUser.displayName || '';
				username = $currentUser.username || '';
				bio = $currentUser.bio || '';
				customStatus = $currentUser.customStatus || '';
				avatarPreview = $currentUser.avatar || $currentUser.avatarUrl || null;
			}

			// Fetch latest user data to ensure we have everything (bio, customStatus, etc)
			api.getCurrentUser()
				.then((user) => {
					updateCurrentUser(user);
					displayName = user.displayName || '';
					username = user.username || '';
					bio = user.bio || '';
					customStatus = user.customStatus || '';
					avatarPreview = user.avatar || user.avatarUrl || null;
				})
				.catch((err) => {
					console.error('Failed to fetch latest user data:', err);
				});
		}
	});

	async function handlePasswordChange() {
		const newPassword = prompt('Enter new password:');
		if (!newPassword) return;

		try {
			await api.changePassword(newPassword);
			addToast({
				type: 'success',
				message: 'Password changed successfully'
			});
		} catch (err) {
			console.error('Failed to change password:', err);
			addToast({
				type: 'error',
				message: 'Failed to change password'
			});
		}
	}

	async function handleToggle2FA() {
		if ($currentUser?.mfaEnabled) {
			const code = prompt('Enter 2FA code to disable:');
			if (!code) return;
			try {
				await api.disable2FA(code);
				updateCurrentUser({ mfaEnabled: false, totpEnabled: false });
				addToast({ type: 'success', message: '2FA disabled' });
			} catch (err) {
				addToast({ type: 'error', message: 'Failed to disable 2FA' });
			}
		} else {
			try {
				const { secret, qrCode } = await api.enable2FA();
				// Later we should, show a modal with the QR code.
				// For now, we'll prompt for the verification code.
				alert(`2FA Secret: ${secret}\n\nPlease enter this into your authenticator app.`);
				const code = prompt('Enter verification code from app:');
				if (!code) return;

				await api.verify2FA(code);
				updateCurrentUser({ mfaEnabled: true, totpEnabled: true });
				addToast({ type: 'success', message: '2FA enabled successfully!' });
			} catch (err) {
				console.error('Failed to enable 2FA:', err);
				addToast({ type: 'error', message: 'Failed to enable 2FA' });
			}
		}
	}

	function handleClose() {
		closeSettingsModal();
		resetForm();
	}

	function resetForm() {
		displayName = $currentUser?.displayName || '';
		username = $currentUser?.username || '';
		bio = $currentUser?.bio || '';
		customStatus = $currentUser?.customStatus || '';
		avatar = null;
		avatarPreview = $currentUser?.avatar || $currentUser?.avatarUrl || null;
		errors = {};
	}

	function handleAvatarSelect(e: Event) {
		const input = e.target as HTMLInputElement;
		if (input.files && input.files[0]) {
			const file = input.files[0];

			if (!file.type.startsWith('image/')) {
				errors = { ...errors, avatar: 'Please select an image file' };
				return;
			}

			if (file.size > 5 * 1024 * 1024) {
				errors = { ...errors, avatar: 'Image must be less than 5MB' };
				return;
			}

			avatar = file;
			avatarPreview = URL.createObjectURL(file);
			delete errors.avatar;
		}
	}

	function removeAvatar() {
		avatar = null;
		avatarPreview = null;
		if (fileInputRef) fileInputRef.value = '';
	}

	function validate(): boolean {
		const newErrors: Record<string, string> = {};

		if (displayName && displayName.length > 32) {
			newErrors.displayName = 'Display name must be less than 32 characters';
		}

		if (!username.trim()) {
			newErrors.username = 'Username is required';
		} else if (username.length < 3) {
			newErrors.username = 'Username must be at least 3 characters';
		} else if (username.length > 32) {
			newErrors.username = 'Username must be less than 32 characters';
		} else if (!/^[a-zA-Z0-9_]+$/.test(username)) {
			newErrors.username = 'Username can only contain letters, numbers, and underscores';
		}

		if (bio && bio.length > 200) {
			newErrors.bio = 'Bio must be less than 200 characters';
		}

		if (customStatus && customStatus.length > 128) {
			newErrors.customStatus = 'Custom status must be less than 128 characters';
		}

		errors = newErrors;
		return Object.keys(newErrors).length === 0;
	}

	async function handleSubmit() {
		if (!validate() || isSubmitting) return;

		isSubmitting = true;

		try {
			// Update profile
			const user = await api.updateProfile({
				displayName: displayName.trim() || undefined,
				bio: bio.trim() || undefined,
				customStatus: customStatus.trim() || undefined
			});

			// Upload avatar if changed
			if (avatar) {
				try {
					const avatarUrl = await api.updateAvatar(avatar);
					user.avatar = avatarUrl;
				} catch (err) {
					console.error('Failed to upload avatar:', err);
				}
			} else if (avatarPreview === null && $currentUser?.avatar) {
				// Avatar was removed
				try {
					await api.removeAvatar();
					user.avatar = null;
				} catch (err) {
					console.error('Failed to remove avatar:', err);
				}
			}

			updateCurrentUser(user);
			addToast({
				type: 'success',
				message: 'Profile updated!'
			});
			handleClose();
		} catch (err: any) {
			console.error('Failed to update profile:', err);
			errors = { submit: err.error || err.message || 'Failed to update profile. Please try again.' };
		} finally {
			isSubmitting = false;
		}
	}

	async function handleDeleteAccount() {
		const confirmed = confirm(
			'Are you absolutely sure you want to delete your account? This action cannot be undone.'
		);
		if (!confirmed) return;

		const doubleConfirmed = confirm(
			'This will permanently delete all your data. Type "DELETE" to confirm.'
		);
		if (!doubleConfirmed) return;

		try {
			await api.deleteAccount();
			logout();
			addToast({
				type: 'success',
				message: 'Account deleted'
			});
		} catch (err) {
			console.error('Failed to delete account:', err);
			addToast({
				type: 'error',
				message: 'Failed to delete account'
			});
		}
	}
</script>

<Modal isOpen={$settingsModalOpen} onclose={handleClose} title="Settings" size="xl">
	<div class="flex gap-6">
		<!-- Tabs -->
		<div class="w-40 space-y-1">
			<button
				onclick={() => activeTab = 'profile'}
				class="w-full text-left px-3 py-2 rounded-lg text-sm transition-colors {activeTab === 'profile' ? 'bg-surface-hover text-text-primary' : 'text-text-muted hover:text-text-primary hover:bg-surface'}"
			>
				Profile
			</button>
			<button
				onclick={() => activeTab = 'account'}
				class="w-full text-left px-3 py-2 rounded-lg text-sm transition-colors {activeTab === 'account' ? 'bg-surface-hover text-text-primary' : 'text-text-muted hover:text-text-primary hover:bg-surface'}"
			>
				Account
			</button>
			<button
				onclick={() => activeTab = 'appearance'}
				class="w-full text-left px-3 py-2 rounded-lg text-sm transition-colors {activeTab === 'appearance' ? 'bg-surface-hover text-text-primary' : 'text-text-muted hover:text-text-primary hover:bg-surface'}"
			>
				Appearance
			</button>
			<button
				onclick={() => activeTab = 'legal'}
				class="w-full text-left px-3 py-2 rounded-lg text-sm transition-colors {activeTab === 'legal' ? 'bg-surface-hover text-text-primary' : 'text-text-muted hover:text-text-primary hover:bg-surface'}"
			>
				Legal
			</button>
		</div>

		<!-- Content -->
		<div class="flex-1">
			{#if activeTab === 'profile'}
				<form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }} class="space-y-4">
					<!-- Avatar -->
					<div class="flex items-center gap-4">
						<input
							bind:this={fileInputRef}
							type="file"
							accept="image/*"
							onchange={handleAvatarSelect}
							class="hidden"
						/>

						{#if avatarPreview}
							<div class="relative">
								<img
									src={avatarPreview}
									alt="Avatar"
									class="w-20 h-20 rounded-full object-cover"
								/>
								<button
									type="button"
									onclick={removeAvatar}
									class="absolute -top-1 -right-1 w-5 h-5 bg-error text-white rounded-full flex items-center justify-center"
									aria-label="Remove avatar"
								>
									<X size={12} />
								</button>
							</div>
						{:else}
							<button
								type="button"
								onclick={() => fileInputRef?.click()}
								class="w-20 h-20 rounded-full border-2 border-dashed border-border hover:border-primary flex flex-col items-center justify-center gap-1 transition-colors"
							>
								<Image size={24} class="text-text-muted" />
							</button>
						{/if}

						<div>
							<p class="text-sm text-text-secondary">Avatar</p>
							<p class="text-xs text-text-muted">Recommended size: 256x256</p>
							{#if errors.avatar}
								<p class="text-xs text-error mt-1">{errors.avatar}</p>
							{/if}
						</div>
					</div>

					<Input
						label="Display Name"
						bind:value={displayName}
						placeholder="How you want to be shown"
						error={errors.displayName}
						maxlength={32}
					/>

					<Input
						label="Username"
						bind:value={username}
						placeholder="your_username"
						error={errors.username}
						required
						maxlength={32}
					/>

					<Textarea
						label="Bio"
						bind:value={bio}
						placeholder="Tell us about yourself"
						rows={3}
						maxlength={200}
						error={errors.bio}
					/>

					<Input
						label="Custom Status"
						bind:value={customStatus}
						placeholder="What are you up to?"
						error={errors.customStatus}
						maxlength={128}
					/>

					{#if errors.submit}
						<p class="text-sm text-error">{errors.submit}</p>
					{/if}

					<div class="flex justify-end pt-4">
						<Button type="submit" disabled={isSubmitting}>
							{#if isSubmitting}
								<Spinner size="sm" />
								Saving...
							{:else}
								Save Changes
							{/if}
						</Button>
					</div>
				</form>
			{:else if activeTab === 'account'}
				<div class="space-y-6">
					<div>
						<h3 class="text-lg font-semibold text-text-primary mb-2">Email</h3>
						<p class="text-text-muted">{$currentUser?.email || 'Not set'}</p>
					</div>

					<div>
						<h3 class="text-lg font-semibold text-text-primary mb-2">Password</h3>
						<Button variant="secondary" onclick={handlePasswordChange}>Change Password</Button>
					</div>

					<div>
						<h3 class="text-lg font-semibold text-text-primary mb-2">Two-Factor Authentication</h3>
						<p class="text-sm text-text-muted mb-2">Add an extra layer of security to your account</p>
						<Button variant="secondary" onclick={handleToggle2FA}>
							{$currentUser?.mfaEnabled || $currentUser?.totpEnabled ? 'Manage 2FA' : 'Enable 2FA'}
						</Button>
					</div>

					<div class="pt-6 border-t border-border">
						<h3 class="text-lg font-semibold text-error mb-2">Danger Zone</h3>
						<p class="text-sm text-text-muted mb-4">
							Once you delete your account, there is no going back. Please be certain.
						</p>
						<Button variant="danger" onclick={handleDeleteAccount}>
							<Trash size={16} />
							Delete Account
						</Button>
					</div>
				</div>
			{:else if activeTab === 'appearance'}
				<div class="space-y-6">
					<div>
						<h3 class="text-lg font-semibold text-text-primary mb-2">Theme</h3>
						<p class="text-sm text-text-muted mb-4">Currently using dark theme (default)</p>
						<div class="flex gap-2">
							<button class="px-4 py-2 bg-surface border-2 border-primary rounded-lg text-sm text-text-primary">
								Dark
							</button>
							<button class="px-4 py-2 bg-surface border border-border rounded-lg text-sm text-text-muted opacity-50 cursor-not-allowed">
								Light (Coming soon)
							</button>
						</div>
					</div>

					<div>
						<h3 class="text-lg font-semibold text-text-primary mb-2">Compact Mode</h3>
						<p class="text-sm text-text-muted mb-4">Reduce spacing and show more content</p>
						<label class="flex items-center gap-3 cursor-pointer">
							<div class="relative">
								<input type="checkbox" class="sr-only peer" disabled />
								<div class="w-10 h-6 bg-surface-hover rounded-full opacity-50"></div>
								<div class="absolute left-1 top-1 w-4 h-4 bg-white rounded-full"></div>
							</div>
							<span class="text-text-muted">Coming soon</span>
						</label>
					</div>

					<div>
						<h3 class="text-lg font-semibold text-text-primary mb-2">Auto-hide Instances</h3>
						<p class="text-sm text-text-muted mb-4">Automatically hide the instances bar on the left</p>
						<label class="flex items-center gap-3 cursor-pointer">
							<div class="relative">
								<input 
									type="checkbox" 
									class="sr-only peer" 
									checked={$autoHideInstances} 
									onchange={(e) => autoHideInstances.set(e.currentTarget.checked)}
								/>
								<div class="w-10 h-6 bg-surface-hover peer-checked:bg-primary rounded-full transition-colors"></div>
								<div class="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-4"></div>
							</div>
							<span class="text-text-primary">Enable</span>
						</label>
					</div>
				</div>
			{:else if activeTab === 'legal'}
				<div class="space-y-6">
					<div>
						<h3 class="text-lg font-semibold text-text-primary mb-2">Policies</h3>
						<p class="text-sm text-text-muted mb-4">
							Review the Terms of Service and Privacy Policy for how the Service works and
							how data is handled.
						</p>
						<div class="flex flex-col gap-2">
							<a href="/terms" class="text-primary hover:underline">Terms of Service</a>
							<a href="/privacy" class="text-primary hover:underline">Privacy Policy</a>
						</div>
					</div>

					<div class="pt-6 border-t border-border">
						<h3 class="text-lg font-semibold text-text-primary mb-2">Contact</h3>
						<p class="text-sm text-text-muted">
							For legal or privacy requests, contact contact@abstractmelon.net.
						</p>
					</div>
				</div>
			{/if}
		</div>
	</div>
</Modal>
