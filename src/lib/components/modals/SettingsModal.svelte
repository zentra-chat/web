<script lang="ts">
	import { Modal, Input, Textarea, Button, Spinner, Avatar } from '$lib/components/ui';
	import { Image, X, Trash, LogOut } from 'lucide-svelte';
	import { goto } from '$app/navigation';
	import {
		settingsModalOpen,
		closeSettingsModal,
		addToast,
		instanceSelectorMode,
		userSettings,
		applyUserSettings
	} from '$lib/stores/ui';
	import {
		activeInstance,
		currentUser,
		updateCurrentUser,
		logout,
		activeInstanceSavedAccounts,
		switchActiveAccount,
		removeSavedAccount
	} from '$lib/stores/instance';
	import { api } from '$lib/api';
	import { updateMemberUser } from '$lib/stores/community';
	import { updateDmUser } from '$lib/stores/dm';
	import type { InstanceSelectorMode } from '$lib/types';

	type ApiErrorLike = { error?: string; message?: string };
	
	let displayName = $state('');
	let username = $state('');
	let bio = $state('');
	let customStatus = $state('');
	let avatar = $state<File | null>(null);
	let avatarPreview = $state<string | null>(null);
	let activeTab = $state<'profile' | 'account' | 'appearance' | 'developer' | 'legal'>('profile');
	let isSubmitting = $state(false);
	let errors = $state<Record<string, string>>({});
	let isSavingAppearance = $state(false);
	let isSavingDeveloperMode = $state(false);
	let isLoggingOut = $state(false);
	let switchingAccountId = $state<string | null>(null);

	let fileInputRef: HTMLInputElement | null = $state(null);

	// Load current user data when modal opens
	$effect(() => {
		if ($settingsModalOpen) {
			if ($currentUser) {
				displayName = $currentUser.displayName || '';
				username = $currentUser.username || '';
				bio = $currentUser.bio || '';
				customStatus = $currentUser.customStatus || '';
				avatarPreview = $currentUser.avatarUrl || null;
			}

			// Fetch latest user data to ensure we have everything (bio, customStatus, etc)
			api.getCurrentUser()
				.then((user) => {
					updateCurrentUser(user);
					displayName = user.displayName || '';
					username = user.username || '';
					bio = user.bio || '';
					customStatus = user.customStatus || '';
					avatarPreview = user.avatarUrl || null;
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
		if ($currentUser?.twoFactorEnabled) {
			const code = prompt('Enter 2FA code to disable:');
			if (!code) return;
			try {
				await api.disable2FA(code);
				updateCurrentUser({ twoFactorEnabled: false });
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
				updateCurrentUser({ twoFactorEnabled: true });
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

	async function saveAppearanceSettings(mode: InstanceSelectorMode) {
		if (isSavingAppearance) return;
		isSavingAppearance = true;
		try {
			const existingSettings = ($userSettings?.settings ?? {}) as Record<string, unknown>;
			const updated = await api.updateUserSettings({
				settings: { ...existingSettings, instanceSelectorMode: mode }
			});
			applyUserSettings(updated);
			addToast({ type: 'success', message: 'Appearance updated' });
		} catch (err) {
			console.error('Failed to update appearance settings:', err);
			addToast({ type: 'error', message: 'Failed to update appearance settings' });
		} finally {
			isSavingAppearance = false;
		}
	}

	function handleInstanceSelectorModeChange(mode: InstanceSelectorMode) {
		if (mode === $instanceSelectorMode) return;
		instanceSelectorMode.set(mode);
		saveAppearanceSettings(mode);
	}

	let developerModeEnabled = $derived(Boolean($userSettings?.settings?.developerMode));

	async function handleDeveloperModeChange(enabled: boolean) {
		if (isSavingDeveloperMode || enabled === developerModeEnabled) return;
		isSavingDeveloperMode = true;
		try {
			const existingSettings = ($userSettings?.settings ?? {}) as Record<string, unknown>;
			const updated = await api.updateUserSettings({
				settings: { ...existingSettings, developerMode: enabled }
			});
			applyUserSettings(updated);
			addToast({ type: 'success', message: `Developer mode ${enabled ? 'enabled' : 'disabled'}` });
		} catch (err) {
			console.error('Failed to update developer mode:', err);
			addToast({ type: 'error', message: 'Failed to update developer mode' });
		} finally {
			isSavingDeveloperMode = false;
		}
	}

	async function handleCopyCurrentUserId() {
		const userId = $currentUser?.id;
		if (!userId) {
			addToast({ type: 'warning', message: 'User ID unavailable' });
			return;
		}

		try {
			await navigator.clipboard.writeText(userId);
			addToast({ type: 'success', message: 'User ID copied' });
		} catch (err) {
			console.error('Failed to copy user ID:', err);
			addToast({ type: 'error', message: 'Failed to copy user ID' });
		}
	}

	function resetForm() {
		displayName = $currentUser?.displayName || '';
		username = $currentUser?.username || '';
		bio = $currentUser?.bio || '';
		customStatus = $currentUser?.customStatus || '';
		avatar = null;
		avatarPreview = $currentUser?.avatarUrl || null;
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
					user.avatarUrl = avatarUrl;
				} catch (err) {
					console.error('Failed to upload avatar:', err);
				}
			} else if (avatarPreview === null && $currentUser?.avatarUrl) {
				// Avatar was removed
				try {
					await api.removeAvatar();
					user.avatarUrl = null;
				} catch (err) {
					console.error('Failed to remove avatar:', err);
				}
			}

			updateCurrentUser(user);
			updateMemberUser(user.id, user);
			updateDmUser(user.id, user);
			addToast({
				type: 'success',
				message: 'Profile updated!'
			});
			handleClose();
		} catch (err: unknown) {
			const error = err as ApiErrorLike;
			console.error('Failed to update profile:', err);
			errors = { submit: error.error || error.message || 'Failed to update profile. Please try again.' };
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
			logout({ removeSavedAccount: true });
			addToast({
				type: 'success',
				message: 'Account deleted'
			});
			closeSettingsModal();
			goto('/login');
		} catch (err) {
			console.error('Failed to delete account:', err);
			addToast({
				type: 'error',
				message: 'Failed to delete account'
			});
		}
	}

	async function handleLogout() {
		if (isLoggingOut) return;
		isLoggingOut = true;

		try {
			await api.logout();
			addToast({ type: 'success', message: 'Logged out' });
		} catch (err) {
			console.error('Failed to log out cleanly:', err);
			addToast({ type: 'warning', message: 'Logged out locally' });
		} finally {
			closeSettingsModal();
			isLoggingOut = false;
			goto('/login');
		}
	}

	function handleSwitchAccount(userId: string) {
		if (switchingAccountId) return;
		if ($currentUser?.id === userId) return;

		switchingAccountId = userId;
		try {
			const switched = switchActiveAccount(userId);
			if (!switched) {
				addToast({ type: 'error', message: 'Saved session expired. Please sign in again.' });
				return;
			}

			closeSettingsModal();
			window.location.assign('/app');
		} finally {
			switchingAccountId = null;
		}
	}

	function handleRemoveSavedAccount(userId: string) {
		if (!$activeInstance) return;
		removeSavedAccount($activeInstance.id, userId);
		addToast({ type: 'info', message: 'Saved account removed' });
	}
</script>

<Modal isOpen={$settingsModalOpen} onclose={handleClose} title="Settings" size="lg">
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
				onclick={() => activeTab = 'developer'}
				class="w-full text-left px-3 py-2 rounded-lg text-sm transition-colors {activeTab === 'developer' ? 'bg-surface-hover text-text-primary' : 'text-text-muted hover:text-text-primary hover:bg-surface'}"
			>
				Developer
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
						<h3 class="text-lg font-semibold text-text-primary mb-2">Session</h3>
						<p class="text-sm text-text-muted mb-3">Sign out from the current account on this device.</p>
						<Button variant="secondary" onclick={handleLogout} disabled={isLoggingOut}>
							<LogOut size={16} />
							{isLoggingOut ? 'Logging out...' : 'Log Out'}
						</Button>
					</div>

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
							{$currentUser?.twoFactorEnabled ? 'Manage 2FA' : 'Enable 2FA'}
						</Button>
					</div>

					<div>
						<h3 class="text-lg font-semibold text-text-primary mb-2">Quick Account Switch</h3>
						<p class="text-sm text-text-muted mb-3">Switch instantly between saved accounts on this instance.</p>

						{#if $activeInstanceSavedAccounts.length > 0}
							<div class="space-y-2">
								{#each $activeInstanceSavedAccounts as account (account.userId)}
									<div class="flex items-center justify-between p-2 rounded-lg border border-border bg-surface">
										<div class="flex items-center gap-3 min-w-0">
											<Avatar src={account.avatarUrl} alt={account.displayName} size="sm" />
											<div class="min-w-0">
												<p class="text-sm text-text-primary truncate">{account.displayName}</p>
												<p class="text-xs text-text-muted truncate">@{account.username}</p>
											</div>
										</div>
										<div class="flex items-center gap-2">
											{#if account.userId === $currentUser?.id}
												<span class="text-xs px-2 py-1 rounded bg-primary/20 text-primary">Current</span>
											{:else}
												<button
													onclick={() => handleSwitchAccount(account.userId)}
													class="text-xs px-2 py-1 rounded bg-surface-hover text-text-primary hover:bg-surface-active"
													disabled={switchingAccountId !== null}
												>
													{switchingAccountId === account.userId ? 'Switching...' : 'Switch'}
												</button>
											{/if}
											<button
												onclick={() => handleRemoveSavedAccount(account.userId)}
												class="text-xs px-2 py-1 rounded text-text-muted hover:text-text-primary hover:bg-surface-hover"
												disabled={switchingAccountId !== null}
											>
												Remove
											</button>
										</div>
									</div>
								{/each}
							</div>
						{:else}
							<p class="text-sm text-text-muted">No saved accounts for this instance yet.</p>
						{/if}
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
						<h3 class="text-lg font-semibold text-text-primary mb-2">Instance Selector</h3>
						<p class="text-sm text-text-muted mb-4">Control when the instance selector is visible</p>
						<div class="flex flex-wrap gap-2">
							<button
								onclick={() => handleInstanceSelectorModeChange('disabled')}
								class="px-4 py-2 rounded-lg text-sm border transition-colors { $instanceSelectorMode === 'disabled'
									? 'bg-primary text-background border-primary'
									: 'bg-surface border-border text-text-muted hover:text-text-primary hover:bg-surface-hover' }"
								aria-pressed={$instanceSelectorMode === 'disabled'}
								disabled={isSavingAppearance}
							>
								Disabled (default)
							</button>
							<button
								onclick={() => handleInstanceSelectorModeChange('auto')}
								class="px-4 py-2 rounded-lg text-sm border transition-colors { $instanceSelectorMode === 'auto'
									? 'bg-primary text-background border-primary'
									: 'bg-surface border-border text-text-muted hover:text-text-primary hover:bg-surface-hover' }"
								aria-pressed={$instanceSelectorMode === 'auto'}
								disabled={isSavingAppearance}
							>
								Auto Hide
							</button>
							<button
								onclick={() => handleInstanceSelectorModeChange('show')}
								class="px-4 py-2 rounded-lg text-sm border transition-colors { $instanceSelectorMode === 'show'
									? 'bg-primary text-background border-primary'
									: 'bg-surface border-border text-text-muted hover:text-text-primary hover:bg-surface-hover' }"
								aria-pressed={$instanceSelectorMode === 'show'}
								disabled={isSavingAppearance}
							>
								Show
							</button>
						</div>
					</div>

				</div>
			{:else if activeTab === 'developer'}
				<div class="space-y-6">
					<div>
						<h3 class="text-lg font-semibold text-text-primary mb-2">Your User ID</h3>
						<div class="flex items-center gap-2 p-2 rounded border border-border bg-surface">
							<p class="flex-1 text-sm text-text-primary truncate">{$currentUser?.id || 'Unavailable'}</p>
							<Button variant="secondary" size="sm" onclick={handleCopyCurrentUserId}>Copy</Button>
						</div>
					</div>

					<div>
						<h3 class="text-lg font-semibold text-text-primary mb-2">Developer Mode</h3>
						<p class="text-sm text-text-muted mb-4">Enable right-click and profile menu options for copying IDs.</p>
						<label class="flex items-center gap-3 cursor-pointer">
							<div class="relative">
								<input
									type="checkbox"
									class="sr-only peer"
									checked={developerModeEnabled}
									onchange={(e) => handleDeveloperModeChange((e.target as HTMLInputElement).checked)}
									disabled={isSavingDeveloperMode}
								/>
								<div class="w-10 h-6 bg-surface-hover rounded-full transition-colors peer-checked:bg-primary"></div>
								<div class="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-4"></div>
							</div>
							<span class="text-text-primary">{developerModeEnabled ? 'Enabled' : 'Disabled'}</span>
						</label>
					</div>

					<div class="pt-4 border-t border-border">
						<p class="text-sm text-text-muted">
							When enabled, you can:
							<br />• Right-click a server to copy server ID
							<br />• Right-click a channel to copy channel ID
							<br />• Use the profile three-dot menu to copy user ID
						</p>
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
